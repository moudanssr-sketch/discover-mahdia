import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import type { Pool as PgPool } from "pg";
import { nanoid } from "nanoid";
import type {
  ActivityEvent,
  ActivityType,
  AdminObject,
  ClaimLocation,
  Game,
  GameState,
  JoinPlayerResponse,
  LeaderboardEntry,
  NextMissionResponse,
  ObjectInput,
  Player,
  PlayerAchievement,
  PublicObject,
  ScoringConfig,
  ValidationFailure,
  ValidationResponse,
  ValidationSuccess
} from "../shared/types";
import { defaultAchievements } from "../shared/types";
import { config } from "./config";
import { buildSeedObjects, createQrToken, seedObjectInputs, slugify } from "./seed";

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Queryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; rowCount: number | null }>;
};

export interface GameStore {
  initialize(): Promise<void>;
  setConnectedPlayers(count: number): void;
  getState(): Promise<GameState>;
  joinPlayer(nickname: string): Promise<Omit<JoinPlayerResponse, "token">>;
  assignNextMission(playerId: string): Promise<NextMissionResponse>;
  validateDiscovery(playerId: string, qrToken: string): Promise<ValidationResponse>;
  claimCurrentMission(playerId: string, location: ClaimLocation): Promise<ValidationResponse>;
  startGame(): Promise<GameState>;
  endGame(): Promise<GameState>;
  resetGame(): Promise<GameState>;
  updateMap(mapUrl: string): Promise<GameState>;
  listAdminObjects(): Promise<AdminObject[]>;
  getAdminObject(id: string): Promise<AdminObject | undefined>;
  createObject(input: ObjectInput): Promise<AdminObject>;
  updateObject(id: string, input: ObjectInput): Promise<AdminObject>;
  deleteObject(id: string): Promise<void>;
  exportResults(): Promise<GameState>;
}

const nowIso = () => new Date().toISOString();

const dateToIso = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  return new Date(value as string | number | Date).toISOString();
};

const distanceMeters = (from: ClaimLocation, to: { latitude: number; longitude: number }) => {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(deltaLongitude / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

const compact = <T>(items: Array<T | undefined>) => items.filter(Boolean) as T[];

const toPublicObject = (object: AdminObject): PublicObject => ({
  id: object.id,
  name: object.name,
  slug: object.slug,
  imageUrl: object.imageUrl,
  description: object.description,
  historicalInfo: object.historicalInfo,
  facts: object.facts,
  category: object.category,
  points: object.points,
  status: object.status,
  latitude: object.latitude,
  longitude: object.longitude,
  claimRadiusMeters: object.claimRadiusMeters,
  reservedPlayerId: object.reservedPlayerId,
  foundPlayerId: object.foundPlayerId,
  foundAt: object.foundAt
});

const sortLeaderboard = (players: Player[]): LeaderboardEntry[] =>
  [...players]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.discoveries !== left.discoveries) {
        return right.discoveries - left.discoveries;
      }
      return new Date(left.joinedAt).getTime() - new Date(right.joinedAt).getTime();
    })
    .map((player, index) => ({
      rank: index + 1,
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      discoveries: player.discoveries,
      combo: player.combo,
      streak: player.streak,
      wrongScans: player.wrongScans,
      achievements: player.achievements
    }));

const composeState = (
  game: Game,
  objects: AdminObject[],
  players: Player[],
  activities: ActivityEvent[],
  connectedPlayers: number
): GameState => {
  const publicObjects = objects.map(toPublicObject);
  const leaderboard = sortLeaderboard(players);
  const foundObjects = objects.filter((object) => object.status === "found").length;
  const reservedObjects = objects.filter((object) => object.status === "reserved").length;
  const startedAt = game.startedAt ? new Date(game.startedAt).getTime() : Date.now();
  const endedAt = game.endedAt ? new Date(game.endedAt).getTime() : Date.now();
  const elapsedSeconds =
    game.status === "waiting" ? 0 : Math.max(0, Math.floor(((game.status === "ended" ? endedAt : Date.now()) - startedAt) / 1000));
  const remainingSeconds = game.status === "running" ? Math.max(0, game.durationSeconds - elapsedSeconds) : 0;

  return {
    game,
    objects: publicObjects,
    leaderboard,
    players,
    activities,
    stats: {
      totalPlayers: players.length,
      connectedPlayers,
      totalObjects: objects.length,
      remainingObjects: objects.length - foundObjects,
      foundObjects,
      reservedObjects,
      progressPercent: objects.length === 0 ? 100 : Math.round((foundObjects / objects.length) * 100),
      totalPoints: players.reduce((sum, player) => sum + player.score, 0),
      wrongScans: players.reduce((sum, player) => sum + player.wrongScans, 0),
      elapsedSeconds,
      remainingSeconds
    },
    winner: game.status === "ended" ? leaderboard[0] : undefined
  };
};

const parseFacts = (facts: unknown): string[] => {
  if (Array.isArray(facts)) {
    return facts.map(String);
  }
  if (typeof facts === "string") {
    try {
      const parsed = JSON.parse(facts);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const achievementById = (id: string) => defaultAchievements.find((achievement) => achievement.id === id);

export class MemoryStore implements GameStore {
  private connectedPlayers = 0;

  private game: Game = {
    id: "memory-game",
    title: "Discover Mahdia",
    status: "running",
    mapUrl: "/mahdia-map.svg",
    durationSeconds: config.gameDurationSeconds,
    scoring: config.scoring,
    startedAt: nowIso(),
    createdAt: nowIso()
  };

  private objects = buildSeedObjects();
  private players: Player[] = [];
  private activities: ActivityEvent[] = [];

  async initialize() {
    this.addActivity("game_started", "Discover Mahdia is ready for explorers.");
  }

  setConnectedPlayers(count: number) {
    this.connectedPlayers = count;
  }

  async getState() {
    return composeState(this.game, this.objects, this.players, this.activities, this.connectedPlayers);
  }

  async joinPlayer(nickname: string) {
    const player: Player = {
      id: nanoid(14),
      nickname,
      score: 0,
      combo: 0,
      streak: 0,
      wrongScans: 0,
      discoveries: 0,
      achievements: [],
      joinedAt: nowIso(),
      lastSeenAt: nowIso()
    };

    this.players.push(player);
    this.addActivity("player_joined", `${nickname} joined the hunt.`, player.id);
    if (this.game.status === "running") {
      await this.assignNextMission(player.id);
    }

    return { player: this.requirePlayer(player.id), state: await this.getState() };
  }

  async assignNextMission(playerId: string) {
    const player = this.requirePlayer(playerId);
    player.lastSeenAt = nowIso();

    const currentMission = player.currentObjectId
      ? this.objects.find((object) => object.id === player.currentObjectId && object.status === "reserved")
      : undefined;

    if (currentMission || this.game.status !== "running") {
      return { player, mission: currentMission ? toPublicObject(currentMission) : undefined, state: await this.getState() };
    }

    const available = this.objects.filter((object) => object.status === "available");
    const mission = available[Math.floor(Math.random() * available.length)];

    if (!mission) {
      await this.finishIfComplete();
      return { player, state: await this.getState() };
    }

    mission.status = "reserved";
    mission.reservedPlayerId = player.id;
    player.currentObjectId = mission.id;
    player.currentAssignedAt = nowIso();

    return { player, mission: toPublicObject(mission), state: await this.getState() };
  }

  async validateDiscovery(playerId: string, qrToken: string) {
    const player = this.requirePlayer(playerId);
    const object = this.objects.find((candidate) => candidate.qrToken === qrToken);
    const failureReason = this.validationFailureReason(player, object);

    if (failureReason) {
      return this.applyPenalty(player, failureReason);
    }

    const mission = object as AdminObject;
    const bonuses = this.calculateBonuses(player, mission);
    const pointsAwarded = bonuses.base + bonuses.speed + bonuses.combo + bonuses.streak;

    mission.status = "found";
    mission.foundPlayerId = player.id;
    mission.reservedPlayerId = undefined;
    mission.foundAt = nowIso();
    player.score += pointsAwarded;
    player.combo += 1;
    player.streak += 1;
    player.discoveries += 1;
    player.currentObjectId = undefined;
    player.currentAssignedAt = undefined;
    player.lastSeenAt = nowIso();

    const achievements = this.unlockAchievements(player, bonuses.speed > 0);
    this.addActivity("object_found", `${player.nickname} discovered ${mission.name}.`, player.id, mission.id, pointsAwarded);
    achievements.forEach((achievement) =>
      this.addActivity("achievement", `${player.nickname} unlocked ${achievement.name}.`, player.id, undefined, achievement.points)
    );
    await this.finishIfComplete();

    const response: ValidationSuccess = {
      ok: true,
      object: toPublicObject(mission),
      pointsAwarded,
      bonuses,
      achievements,
      gameComplete: this.game.status === "ended",
      state: await this.getState()
    };
    return response;
  }

  async claimCurrentMission(playerId: string, location: ClaimLocation) {
    const player = this.requirePlayer(playerId);
    const mission = this.objects.find((object) => object.id === player.currentObjectId);
    if (!mission) {
      const response: ValidationFailure = {
        ok: false,
        reason: "No virtual object is ready to claim.",
        penalty: 0,
        state: await this.getState()
      };
      return response;
    }
    const distance = distanceMeters(location, mission);
    if (distance > mission.claimRadiusMeters) {
      const response: ValidationFailure = {
        ok: false,
        reason: `Move closer to the virtual object. You are ${Math.round(distance)}m away.`,
        penalty: 0,
        state: await this.getState()
      };
      return response;
    }
    return this.validateDiscovery(playerId, mission.qrToken);
  }

  async startGame() {
    this.game.status = "running";
    this.game.startedAt = nowIso();
    this.game.endedAt = undefined;
    this.addActivity("game_started", "The treasure hunt has started.");
    await Promise.all(this.players.map((player) => this.assignNextMission(player.id)));
    return this.getState();
  }

  async endGame() {
    this.game.status = "ended";
    this.game.endedAt = nowIso();
    this.unlockChampion();
    this.addActivity("game_ended", "The treasure hunt has ended.");
    return this.getState();
  }

  async resetGame() {
    this.game.status = "waiting";
    this.game.startedAt = undefined;
    this.game.endedAt = undefined;
    this.objects = this.objects.map((object) => ({
      ...object,
      status: "available",
      reservedPlayerId: undefined,
      foundPlayerId: undefined,
      foundAt: undefined
    }));
    this.players = this.players.map((player) => ({
      ...player,
      score: 0,
      combo: 0,
      streak: 0,
      wrongScans: 0,
      discoveries: 0,
      currentObjectId: undefined,
      currentAssignedAt: undefined,
      achievements: []
    }));
    this.activities = [];
    this.addActivity("game_reset", "The game has been reset.");
    return this.getState();
  }

  async updateMap(mapUrl: string) {
    this.game.mapUrl = mapUrl;
    this.addActivity("map_uploaded", "A new gallery map was uploaded.");
    return this.getState();
  }

  async listAdminObjects() {
    return this.objects;
  }

  async getAdminObject(id: string) {
    return this.objects.find((object) => object.id === id);
  }

  async createObject(input: ObjectInput) {
    const object: AdminObject = {
      id: nanoid(12),
      slug: this.uniqueSlug(input.name),
      qrToken: createQrToken(),
      status: "available",
      reservedPlayerId: undefined,
      foundPlayerId: undefined,
      foundAt: undefined,
      ...input,
      imageUrl: input.imageUrl || "/mahdia-map.svg",
      latitude: input.latitude,
      longitude: input.longitude,
      claimRadiusMeters: input.claimRadiusMeters
    };
    this.objects.push(object);
    this.addActivity("object_created", `${object.name} was added to the gallery.`, undefined, object.id);
    return object;
  }

  async updateObject(id: string, input: ObjectInput) {
    const index = this.objects.findIndex((object) => object.id === id);
    if (index === -1) {
      throw new Error("Object not found.");
    }

    const current = this.objects[index];
    const updated: AdminObject = {
      ...current,
      ...input,
      imageUrl: input.imageUrl || current.imageUrl,
      slug: current.name === input.name ? current.slug : this.uniqueSlug(input.name, current.id)
    };
    this.objects[index] = updated;
    this.addActivity("object_updated", `${updated.name} was updated.`, undefined, updated.id);
    return updated;
  }

  async deleteObject(id: string) {
    const object = await this.getAdminObject(id);
    this.objects = this.objects.filter((candidate) => candidate.id !== id);
    this.players.forEach((player) => {
      if (player.currentObjectId === id) {
        player.currentObjectId = undefined;
        player.currentAssignedAt = undefined;
      }
    });
    if (object) {
      this.addActivity("object_deleted", `${object.name} was removed from the gallery.`, undefined, id);
    }
  }

  async exportResults() {
    return this.getState();
  }

  private validationFailureReason(player: Player, object: AdminObject | undefined) {
    if (!object) {
      return "This QR code does not belong to the active game.";
    }
    if (object.status === "found") {
      return `${object.name} has already been discovered.`;
    }
    if (object.id !== player.currentObjectId) {
      return "This QR code does not match your current mission.";
    }
    if (object.status !== "reserved" || object.reservedPlayerId !== player.id) {
      return "This object is not reserved for your player session.";
    }
    return undefined;
  }

  private async applyPenalty(player: Player, reason: string) {
    const penalty = this.game.scoring.wrongScanPenalty;
    player.score = Math.max(0, player.score - penalty);
    player.combo = 0;
    player.streak = 0;
    player.wrongScans += 1;
    player.lastSeenAt = nowIso();
    this.addActivity("wrong_scan", `${player.nickname} scanned an incorrect object.`, player.id, undefined, -penalty);
    const response: ValidationFailure = {
      ok: false,
      reason,
      penalty,
      state: await this.getState()
    };
    return response;
  }

  private calculateBonuses(player: Player, object: AdminObject) {
    const scoringConfig = this.game.scoring;
    const assignedAt = player.currentAssignedAt ? new Date(player.currentAssignedAt).getTime() : Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - assignedAt) / 1000));
    const speed = elapsedSeconds <= scoringConfig.speedBonusSeconds ? scoringConfig.speedBonusPoints : 0;
    const combo = player.combo > 0 ? player.combo * scoringConfig.comboBonusPoints : 0;
    const streak = (player.streak + 1) % 3 === 0 ? scoringConfig.perfectStreakPoints : 0;

    return {
      base: object.points || scoringConfig.baseDiscoveryPoints,
      speed,
      combo,
      streak
    };
  }

  private unlockAchievements(player: Player, receivedSpeedBonus: boolean) {
    const unlocked = compact([
      player.discoveries >= 1 ? this.unlockAchievement(player, "first-find") : undefined,
      receivedSpeedBonus ? this.unlockAchievement(player, "speed-runner") : undefined,
      player.streak >= 3 ? this.unlockAchievement(player, "triple-streak") : undefined,
      player.discoveries >= 3 ? this.unlockAchievement(player, "historian") : undefined
    ]);
    return unlocked;
  }

  private unlockAchievement(player: Player, achievementId: string) {
    if (player.achievements.some((achievement) => achievement.id === achievementId)) {
      return undefined;
    }

    const achievement = achievementById(achievementId);
    if (!achievement) {
      return undefined;
    }

    const unlocked: PlayerAchievement = { ...achievement, unlockedAt: nowIso() };
    player.achievements.push(unlocked);
    return unlocked;
  }

  private unlockChampion() {
    const winner = sortLeaderboard(this.players)[0];
    if (!winner) {
      return;
    }
    const player = this.players.find((candidate) => candidate.id === winner.playerId);
    if (player) {
      this.unlockAchievement(player, "champion");
    }
  }

  private async finishIfComplete() {
    if (this.objects.length > 0 && this.objects.every((object) => object.status === "found")) {
      await this.endGame();
    }
  }

  private requirePlayer(playerId: string) {
    const player = this.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new Error("Player not found.");
    }
    return player;
  }

  private uniqueSlug(name: string, currentId?: string) {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;

    while (this.objects.some((object) => object.slug === candidate && object.id !== currentId)) {
      candidate = `${base}-${counter}`;
      counter += 1;
    }

    return candidate;
  }

  private addActivity(type: ActivityType, message: string, playerId?: string, objectId?: string, points?: number) {
    const player = playerId ? this.players.find((candidate) => candidate.id === playerId) : undefined;
    const object = objectId ? this.objects.find((candidate) => candidate.id === objectId) : undefined;
    this.activities = [
      {
        id: nanoid(12),
        type,
        message,
        playerId,
        playerName: player?.nickname,
        objectId,
        objectName: object?.name,
        points,
        createdAt: nowIso()
      },
      ...this.activities
    ].slice(0, 60);
  }
}

export class PostgresStore implements GameStore {
  private pool: PgPool;
  private connectedPlayers = 0;

  constructor(databaseUrl: string) {
    this.pool = new Pool({
      connectionString: databaseUrl,
      ssl: databaseUrl.includes("supabase.co") ? { rejectUnauthorized: false } : undefined
    });
  }

  async initialize() {
    await this.applySchema();
    await this.ensureGame();
  }

  setConnectedPlayers(count: number) {
    this.connectedPlayers = count;
  }

  async getState() {
    const game = await this.ensureGame();
    const [objects, players, activities] = await Promise.all([
      this.loadObjects(game.id),
      this.loadPlayers(game.id),
      this.loadActivities(game.id)
    ]);
    return composeState(game, objects, players, activities, this.connectedPlayers);
  }

  async joinPlayer(nickname: string) {
    const game = await this.ensureGame();
    const result = await this.pool.query(
      `INSERT INTO players (game_id, nickname)
       VALUES ($1, $2)
       RETURNING *`,
      [game.id, nickname]
    );
    const player = this.rowToPlayer(result.rows[0], []);
    await this.insertActivity(game.id, "player_joined", `${nickname} joined the hunt.`, player.id);

    if (game.status === "running") {
      await this.assignNextMission(player.id);
    }

    const state = await this.getState();
    const freshPlayer = state.players.find((candidate) => candidate.id === player.id) ?? player;
    return { player: freshPlayer, state };
  }

  async assignNextMission(playerId: string) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const game = await this.ensureGame(client);
      const playerResult = await client.query("SELECT * FROM players WHERE id = $1 AND game_id = $2 FOR UPDATE", [
        playerId,
        game.id
      ]);
      const playerRow = playerResult.rows[0];

      if (!playerRow) {
        throw new Error("Player not found.");
      }

      let missionRow: Record<string, unknown> | undefined;
      if (playerRow.current_object_id) {
        const currentResult = await client.query("SELECT * FROM objects WHERE id = $1", [playerRow.current_object_id]);
        missionRow = currentResult.rows[0];
      } else if (game.status === "running") {
        const availableResult = await client.query(
          `SELECT * FROM objects
           WHERE game_id = $1 AND status = 'available'
           ORDER BY random()
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [game.id]
        );
        missionRow = availableResult.rows[0];

        if (missionRow) {
          const missionId = String(missionRow.id);
          const updatedObject = await client.query(
            `UPDATE objects
             SET status = 'reserved', reserved_player_id = $1, updated_at = now()
             WHERE id = $2
             RETURNING *`,
            [playerId, missionId]
          );
          missionRow = updatedObject.rows[0];
          await client.query(
            `UPDATE players
             SET current_object_id = $1, current_assigned_at = now(), last_seen_at = now()
             WHERE id = $2`,
            [missionId, playerId]
          );
        }
      }

      await client.query("COMMIT");
      const state = await this.getState();
      const player = state.players.find((candidate) => candidate.id === playerId);
      if (!player) {
        throw new Error("Player not found.");
      }
      const assignedMission = missionRow;
      return {
        player,
        mission: assignedMission ? toPublicObject(this.rowToAdminObject(assignedMission)) : undefined,
        state
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async validateDiscovery(playerId: string, qrToken: string) {
    const client = await this.pool.connect();
    let response: ValidationResponse | undefined;

    try {
      await client.query("BEGIN");
      const game = await this.ensureGame(client);
      const playerResult = await client.query("SELECT * FROM players WHERE id = $1 AND game_id = $2 FOR UPDATE", [
        playerId,
        game.id
      ]);
      const objectResult = await client.query("SELECT * FROM objects WHERE qr_token = $1 AND game_id = $2 FOR UPDATE", [
        qrToken,
        game.id
      ]);
      const playerRow = playerResult.rows[0];
      const objectRow = objectResult.rows[0];

      if (!playerRow) {
        throw new Error("Player not found.");
      }

      const failureReason = this.validationFailureReason(playerRow, objectRow);
      if (failureReason) {
        const penalty = game.scoring.wrongScanPenalty;
        await client.query(
          `UPDATE players
           SET score = GREATEST(score - $1, 0),
               combo = 0,
               streak = 0,
               wrong_scans = wrong_scans + 1,
               last_seen_at = now()
           WHERE id = $2`,
          [penalty, playerId]
        );
        await this.insertActivity(
          game.id,
          "wrong_scan",
          `${String(playerRow.nickname)} scanned an incorrect object.`,
          playerId,
          undefined,
          -penalty,
          client
        );
        await client.query("COMMIT");
        response = {
          ok: false,
          reason: failureReason,
          penalty,
          state: await this.getState()
        };
        return response;
      }

      const scoringConfig = game.scoring;
      const assignedAt = playerRow.current_assigned_at ? new Date(playerRow.current_assigned_at as string).getTime() : Date.now();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - assignedAt) / 1000));
      const bonuses = {
        base: Number(objectRow.points) || scoringConfig.baseDiscoveryPoints,
        speed: elapsedSeconds <= scoringConfig.speedBonusSeconds ? scoringConfig.speedBonusPoints : 0,
        combo: Number(playerRow.combo) > 0 ? Number(playerRow.combo) * scoringConfig.comboBonusPoints : 0,
        streak: (Number(playerRow.streak) + 1) % 3 === 0 ? scoringConfig.perfectStreakPoints : 0
      };
      const pointsAwarded = bonuses.base + bonuses.speed + bonuses.combo + bonuses.streak;

      const updatedObject = await client.query(
        `UPDATE objects
         SET status = 'found',
             found_player_id = $1,
             reserved_player_id = NULL,
             found_at = now(),
             updated_at = now()
         WHERE id = $2
         RETURNING *`,
        [playerId, objectRow.id]
      );
      const updatedPlayer = await client.query(
        `UPDATE players
         SET score = score + $1,
             combo = combo + 1,
             streak = streak + 1,
             discoveries = discoveries + 1,
             current_object_id = NULL,
             current_assigned_at = NULL,
             last_seen_at = now()
         WHERE id = $2
         RETURNING *`,
        [pointsAwarded, playerId]
      );

      await this.insertActivity(
        game.id,
        "object_found",
        `${String(playerRow.nickname)} discovered ${String(objectRow.name)}.`,
        playerId,
        String(objectRow.id),
        pointsAwarded,
        client
      );

      const achievements = await this.unlockAchievements(client, game.id, updatedPlayer.rows[0], bonuses.speed > 0);
      for (const achievement of achievements) {
        await this.insertActivity(
          game.id,
          "achievement",
          `${String(playerRow.nickname)} unlocked ${achievement.name}.`,
          playerId,
          undefined,
          achievement.points,
          client
        );
      }

      const remainingResult = await client.query("SELECT COUNT(*)::int AS count FROM objects WHERE game_id = $1 AND status <> 'found'", [
        game.id
      ]);
      const gameComplete = Number(remainingResult.rows[0]?.count ?? 0) === 0;
      if (gameComplete) {
        await this.endGameInTransaction(client, game.id);
      }

      await client.query("COMMIT");
      response = {
        ok: true,
        object: toPublicObject(this.rowToAdminObject(updatedObject.rows[0])),
        pointsAwarded,
        bonuses,
        achievements,
        gameComplete,
        state: await this.getState()
      };
      return response;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  async claimCurrentMission(playerId: string, location: ClaimLocation) {
    const game = await this.ensureGame();
    const result = await this.pool.query(
      `SELECT o.qr_token, o.latitude, o.longitude, o.claim_radius_meters
       FROM players p
       JOIN objects o ON o.id = p.current_object_id AND o.game_id = p.game_id
       WHERE p.id = $1 AND p.game_id = $2`,
      [playerId, game.id]
    );
    const qrToken = result.rows[0]?.qr_token;
    if (!qrToken) {
      const response: ValidationFailure = {
        ok: false,
        reason: "No virtual object is ready to claim.",
        penalty: 0,
        state: await this.getState()
      };
      return response;
    }
    const distance = distanceMeters(location, {
      latitude: Number(result.rows[0].latitude),
      longitude: Number(result.rows[0].longitude)
    });
    const claimRadiusMeters = Number(result.rows[0].claim_radius_meters);
    if (distance > claimRadiusMeters) {
      const response: ValidationFailure = {
        ok: false,
        reason: `Move closer to the virtual object. You are ${Math.round(distance)}m away.`,
        penalty: 0,
        state: await this.getState()
      };
      return response;
    }
    return this.validateDiscovery(playerId, String(qrToken));
  }

  async startGame() {
    const game = await this.ensureGame();
    await this.pool.query(
      `UPDATE games
       SET status = 'running',
           started_at = COALESCE(started_at, now()),
           ended_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [game.id]
    );
    await this.insertActivity(game.id, "game_started", "The treasure hunt has started.");
    const players = await this.loadPlayers(game.id);
    await Promise.all(players.map((player) => this.assignNextMission(player.id)));
    return this.getState();
  }

  async endGame() {
    const game = await this.ensureGame();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await this.endGameInTransaction(client, game.id);
      await client.query("COMMIT");
      return this.getState();
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async resetGame() {
    const game = await this.ensureGame();
    await this.pool.query("DELETE FROM history_events WHERE game_id = $1", [game.id]);
    await this.pool.query("DELETE FROM player_achievements WHERE player_id IN (SELECT id FROM players WHERE game_id = $1)", [game.id]);
    await this.pool.query(
      `UPDATE players
       SET score = 0,
           combo = 0,
           streak = 0,
           wrong_scans = 0,
           discoveries = 0,
           current_object_id = NULL,
           current_assigned_at = NULL
       WHERE game_id = $1`,
      [game.id]
    );
    await this.pool.query(
      `UPDATE objects
       SET status = 'available',
           reserved_player_id = NULL,
           found_player_id = NULL,
           found_at = NULL,
           updated_at = now()
       WHERE game_id = $1`,
      [game.id]
    );
    await this.pool.query(
      `UPDATE games
       SET status = 'waiting',
           started_at = NULL,
           ended_at = NULL,
           updated_at = now()
       WHERE id = $1`,
      [game.id]
    );
    await this.insertActivity(game.id, "game_reset", "The game has been reset.");
    return this.getState();
  }

  async updateMap(mapUrl: string) {
    const game = await this.ensureGame();
    await this.pool.query("UPDATE games SET map_url = $1, updated_at = now() WHERE id = $2", [mapUrl, game.id]);
    await this.insertActivity(game.id, "map_uploaded", "A new gallery map was uploaded.");
    return this.getState();
  }

  async listAdminObjects() {
    const game = await this.ensureGame();
    return this.loadObjects(game.id);
  }

  async getAdminObject(id: string) {
    const game = await this.ensureGame();
    const result = await this.pool.query("SELECT * FROM objects WHERE id = $1 AND game_id = $2", [id, game.id]);
    return result.rows[0] ? this.rowToAdminObject(result.rows[0]) : undefined;
  }

  async createObject(input: ObjectInput) {
    const game = await this.ensureGame();
    const slug = await this.uniqueSlug(input.name, game.id);
    const result = await this.pool.query(
      `INSERT INTO objects
        (game_id, name, slug, image_url, description, historical_info, facts, category, points, qr_token, position_x, position_y, latitude, longitude, claim_radius_meters)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        game.id,
        input.name,
        slug,
        input.imageUrl || "/mahdia-map.svg",
        input.description,
        input.historicalInfo,
        JSON.stringify(input.facts),
        input.category,
        input.points,
        createQrToken(),
        input.positionX,
        input.positionY,
        input.latitude,
        input.longitude,
        input.claimRadiusMeters
      ]
    );
    const object = this.rowToAdminObject(result.rows[0]);
    await this.insertActivity(game.id, "object_created", `${object.name} was added to the gallery.`, undefined, object.id);
    return object;
  }

  async updateObject(id: string, input: ObjectInput) {
    const game = await this.ensureGame();
    const current = await this.getAdminObject(id);
    if (!current) {
      throw new Error("Object not found.");
    }
    const slug = current.name === input.name ? current.slug : await this.uniqueSlug(input.name, game.id, id);
    const result = await this.pool.query(
      `UPDATE objects
       SET name = $1,
           slug = $2,
           image_url = $3,
           description = $4,
           historical_info = $5,
           facts = $6::jsonb,
           category = $7,
           points = $8,
           position_x = $9,
           position_y = $10,
           latitude = $11,
           longitude = $12,
           claim_radius_meters = $13,
           updated_at = now()
       WHERE id = $14 AND game_id = $15
       RETURNING *`,
      [
        input.name,
        slug,
        input.imageUrl || current.imageUrl,
        input.description,
        input.historicalInfo,
        JSON.stringify(input.facts),
        input.category,
        input.points,
        input.positionX,
        input.positionY,
        input.latitude,
        input.longitude,
        input.claimRadiusMeters,
        id,
        game.id
      ]
    );
    const object = this.rowToAdminObject(result.rows[0]);
    await this.insertActivity(game.id, "object_updated", `${object.name} was updated.`, undefined, object.id);
    return object;
  }

  async deleteObject(id: string) {
    const game = await this.ensureGame();
    const object = await this.getAdminObject(id);
    await this.pool.query("DELETE FROM objects WHERE id = $1 AND game_id = $2", [id, game.id]);
    if (object) {
      await this.insertActivity(game.id, "object_deleted", `${object.name} was removed from the gallery.`, undefined, id);
    }
  }

  async exportResults() {
    return this.getState();
  }

  private async ensureGame(client: Queryable = this.pool): Promise<Game> {
    const existing = await client.query("SELECT * FROM games ORDER BY created_at DESC LIMIT 1");
    let row = existing.rows[0];

    if (!row) {
      const created = await client.query(
        `INSERT INTO games (title, status, map_url, duration_seconds, scoring_config)
         VALUES ($1, 'waiting', $2, $3, $4::jsonb)
         RETURNING *`,
        ["Discover Mahdia", "/mahdia-map.svg", config.gameDurationSeconds, JSON.stringify(config.scoring)]
      );
      row = created.rows[0];
    }

    await this.ensureSeedObjects(String(row.id), client);
    return this.rowToGame(row);
  }

  private async applySchema() {
    const candidates = [path.resolve(__dirname, "../database/schema.sql"), path.resolve(process.cwd(), "database/schema.sql")];
    const schemaPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!schemaPath) {
      throw new Error("database/schema.sql was not found.");
    }
    await this.pool.query(fs.readFileSync(schemaPath, "utf8"));
  }

  private async ensureSeedObjects(gameId: string, client: Queryable) {
    const count = await client.query("SELECT COUNT(*)::int AS count FROM objects WHERE game_id = $1", [gameId]);
    if (Number(count.rows[0]?.count ?? 0) > 0) {
      return;
    }

    for (const input of seedObjectInputs) {
      await client.query(
        `INSERT INTO objects
          (game_id, name, slug, image_url, description, historical_info, facts, category, points, qr_token, position_x, position_y, latitude, longitude, claim_radius_meters)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          gameId,
          input.name,
          slugify(input.name),
          input.imageUrl || "/mahdia-map.svg",
          input.description,
          input.historicalInfo,
          JSON.stringify(input.facts),
          input.category,
          input.points,
          createQrToken(),
          input.positionX,
          input.positionY,
          input.latitude,
          input.longitude,
          input.claimRadiusMeters
        ]
      );
    }
  }

  private async loadObjects(gameId: string) {
    const result = await this.pool.query("SELECT * FROM objects WHERE game_id = $1 ORDER BY created_at ASC", [gameId]);
    return result.rows.map((row) => this.rowToAdminObject(row));
  }

  private async loadPlayers(gameId: string) {
    const [playerResult, achievementResult] = await Promise.all([
      this.pool.query("SELECT * FROM players WHERE game_id = $1 ORDER BY joined_at ASC", [gameId]),
      this.pool.query(
        `SELECT pa.player_id, pa.unlocked_at, a.*
         FROM player_achievements pa
         JOIN achievements a ON a.id = pa.achievement_id
         JOIN players p ON p.id = pa.player_id
         WHERE p.game_id = $1
         ORDER BY pa.unlocked_at ASC`,
        [gameId]
      )
    ]);
    const achievementsByPlayer = new Map<string, PlayerAchievement[]>();
    for (const row of achievementResult.rows) {
      const playerId = String(row.player_id);
      const current = achievementsByPlayer.get(playerId) ?? [];
      current.push(this.rowToPlayerAchievement(row));
      achievementsByPlayer.set(playerId, current);
    }
    return playerResult.rows.map((row) => this.rowToPlayer(row, achievementsByPlayer.get(String(row.id)) ?? []));
  }

  private async loadActivities(gameId: string) {
    const result = await this.pool.query(
      `SELECT h.*, p.nickname AS player_name, o.name AS object_name
       FROM history_events h
       LEFT JOIN players p ON p.id = h.player_id
       LEFT JOIN objects o ON o.id = h.object_id
       WHERE h.game_id = $1
       ORDER BY h.created_at DESC
       LIMIT 60`,
      [gameId]
    );
    return result.rows.map((row) => this.rowToActivity(row));
  }

  private async insertActivity(
    gameId: string,
    type: ActivityType,
    message: string,
    playerId?: string,
    objectId?: string,
    points?: number,
    client: Queryable = this.pool
  ) {
    await client.query(
      `INSERT INTO history_events (game_id, player_id, object_id, type, message, points)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [gameId, playerId ?? null, objectId ?? null, type, message, points ?? null]
    );
  }

  private validationFailureReason(playerRow: Record<string, unknown>, objectRow: Record<string, unknown> | undefined) {
    if (!objectRow) {
      return "This QR code does not belong to the active game.";
    }
    if (objectRow.status === "found") {
      return `${String(objectRow.name)} has already been discovered.`;
    }
    if (objectRow.id !== playerRow.current_object_id) {
      return "This QR code does not match your current mission.";
    }
    if (objectRow.status !== "reserved" || objectRow.reserved_player_id !== playerRow.id) {
      return "This object is not reserved for your player session.";
    }
    return undefined;
  }

  private async unlockAchievements(
    client: Queryable,
    gameId: string,
    playerRow: Record<string, unknown>,
    receivedSpeedBonus: boolean
  ) {
    const achievements = compact([
      Number(playerRow.discoveries) >= 1 ? "first-find" : undefined,
      receivedSpeedBonus ? "speed-runner" : undefined,
      Number(playerRow.streak) >= 3 ? "triple-streak" : undefined,
      Number(playerRow.discoveries) >= 3 ? "historian" : undefined
    ]);
    const unlocked: PlayerAchievement[] = [];

    for (const achievementId of achievements) {
      const result = await client.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING
         RETURNING unlocked_at`,
        [playerRow.id, achievementId]
      );
      if (result.rowCount) {
        const achievement = achievementById(achievementId);
        if (achievement) {
          unlocked.push({ ...achievement, unlockedAt: dateToIso(result.rows[0]?.unlocked_at) ?? nowIso() });
        }
      }
    }

    await this.refreshStatistics(client, gameId);
    return unlocked;
  }

  private async endGameInTransaction(client: Queryable, gameId: string) {
    await client.query(
      `UPDATE games
       SET status = 'ended',
           ended_at = COALESCE(ended_at, now()),
           updated_at = now()
       WHERE id = $1`,
      [gameId]
    );
    const winner = await client.query(
      `SELECT id, nickname FROM players
       WHERE game_id = $1
       ORDER BY score DESC, discoveries DESC, joined_at ASC
       LIMIT 1`,
      [gameId]
    );
    if (winner.rows[0]) {
      await client.query(
        `INSERT INTO player_achievements (player_id, achievement_id)
         VALUES ($1, 'champion')
         ON CONFLICT DO NOTHING`,
        [winner.rows[0].id]
      );
    }
    await this.insertActivity(gameId, "game_ended", "The treasure hunt has ended.", undefined, undefined, undefined, client);
    await this.refreshStatistics(client, gameId);
  }

  private async refreshStatistics(client: Queryable, gameId: string) {
    await client.query(
      `INSERT INTO game_statistics
        (game_id, total_players, total_objects, found_objects, total_points, wrong_scans, fastest_discovery_seconds, updated_at)
       SELECT
        $1,
        (SELECT COUNT(*)::int FROM players WHERE game_id = $1),
        (SELECT COUNT(*)::int FROM objects WHERE game_id = $1),
        (SELECT COUNT(*)::int FROM objects WHERE game_id = $1 AND status = 'found'),
        (SELECT COALESCE(SUM(score), 0)::int FROM players WHERE game_id = $1),
        (SELECT COALESCE(SUM(wrong_scans), 0)::int FROM players WHERE game_id = $1),
        NULL,
        now()
       ON CONFLICT (game_id) DO UPDATE
       SET total_players = EXCLUDED.total_players,
           total_objects = EXCLUDED.total_objects,
           found_objects = EXCLUDED.found_objects,
           total_points = EXCLUDED.total_points,
           wrong_scans = EXCLUDED.wrong_scans,
           updated_at = now()`,
      [gameId]
    );
  }

  private async uniqueSlug(name: string, gameId: string, currentId?: string) {
    const base = slugify(name);
    let candidate = base;
    let counter = 2;

    while (true) {
      const result = await this.pool.query(
        "SELECT id FROM objects WHERE game_id = $1 AND slug = $2 AND ($3::uuid IS NULL OR id <> $3::uuid)",
        [gameId, candidate, currentId ?? null]
      );
      if (!result.rowCount) {
        return candidate;
      }
      candidate = `${base}-${counter}`;
      counter += 1;
    }
  }

  private rowToGame(row: Record<string, unknown>): Game {
    return {
      id: String(row.id),
      title: String(row.title ?? "Discover Mahdia"),
      status: row.status as Game["status"],
      mapUrl: String(row.map_url ?? "/mahdia-map.svg"),
      durationSeconds: Number(row.duration_seconds ?? config.gameDurationSeconds),
      scoring: { ...config.scoring, ...((row.scoring_config as Partial<ScoringConfig>) ?? {}) },
      startedAt: dateToIso(row.started_at),
      endedAt: dateToIso(row.ended_at),
      createdAt: dateToIso(row.created_at) ?? nowIso()
    };
  }

  private rowToPlayer(row: Record<string, unknown>, achievements: PlayerAchievement[]): Player {
    return {
      id: String(row.id),
      nickname: String(row.nickname),
      score: Number(row.score ?? 0),
      combo: Number(row.combo ?? 0),
      streak: Number(row.streak ?? 0),
      wrongScans: Number(row.wrong_scans ?? 0),
      discoveries: Number(row.discoveries ?? 0),
      currentObjectId: row.current_object_id ? String(row.current_object_id) : undefined,
      currentAssignedAt: dateToIso(row.current_assigned_at),
      achievements,
      joinedAt: dateToIso(row.joined_at) ?? nowIso(),
      lastSeenAt: dateToIso(row.last_seen_at) ?? nowIso()
    };
  }

  private rowToAdminObject(row: Record<string, unknown>): AdminObject {
    return {
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
      imageUrl: String(row.image_url ?? "/mahdia-map.svg"),
      description: String(row.description),
      historicalInfo: String(row.historical_info),
      facts: parseFacts(row.facts),
      category: String(row.category ?? "heritage"),
      points: Number(row.points ?? 100),
      qrToken: String(row.qr_token),
      status: row.status as AdminObject["status"],
      reservedPlayerId: row.reserved_player_id ? String(row.reserved_player_id) : undefined,
      foundPlayerId: row.found_player_id ? String(row.found_player_id) : undefined,
      foundAt: dateToIso(row.found_at),
      positionX: Number(row.position_x ?? 50),
      positionY: Number(row.position_y ?? 50),
      latitude: Number(row.latitude ?? 35.5047),
      longitude: Number(row.longitude ?? 11.0622),
      claimRadiusMeters: Number(row.claim_radius_meters ?? 25)
    };
  }

  private rowToActivity(row: Record<string, unknown>): ActivityEvent {
    return {
      id: String(row.id),
      type: row.type as ActivityType,
      message: String(row.message),
      playerId: row.player_id ? String(row.player_id) : undefined,
      playerName: row.player_name ? String(row.player_name) : undefined,
      objectId: row.object_id ? String(row.object_id) : undefined,
      objectName: row.object_name ? String(row.object_name) : undefined,
      points: row.points === null || row.points === undefined ? undefined : Number(row.points),
      createdAt: dateToIso(row.created_at) ?? nowIso()
    };
  }

  private rowToPlayerAchievement(row: Record<string, unknown>): PlayerAchievement {
    return {
      id: String(row.id),
      name: String(row.name),
      description: String(row.description),
      icon: String(row.icon),
      category: row.category as PlayerAchievement["category"],
      points: Number(row.points ?? 0),
      unlockedAt: dateToIso(row.unlocked_at) ?? nowIso()
    };
  }
}

export const createStore = (): GameStore =>
  config.databaseUrl ? new PostgresStore(config.databaseUrl) : new MemoryStore();
