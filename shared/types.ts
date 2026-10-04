export type GameStatus = "waiting" | "running" | "ended";

export type ObjectStatus = "available" | "reserved" | "found";

export type ActivityType =
  | "player_joined"
  | "game_started"
  | "game_reset"
  | "game_ended"
  | "object_found"
  | "wrong_scan"
  | "achievement"
  | "object_created"
  | "object_updated"
  | "object_deleted"
  | "map_uploaded";

export type AchievementCategory =
  | "speed"
  | "exploration"
  | "history"
  | "collection"
  | "completion";

export interface ScoringConfig {
  baseDiscoveryPoints: number;
  speedBonusPoints: number;
  speedBonusSeconds: number;
  comboBonusPoints: number;
  perfectStreakPoints: number;
  wrongScanPenalty: number;
}

export interface Game {
  id: string;
  title: string;
  status: GameStatus;
  mapUrl: string;
  durationSeconds: number;
  scoring: ScoringConfig;
  startedAt?: string;
  endedAt?: string;
  createdAt: string;
}

export interface Player {
  id: string;
  nickname: string;
  score: number;
  combo: number;
  streak: number;
  wrongScans: number;
  discoveries: number;
  currentObjectId?: string;
  currentAssignedAt?: string;
  achievements: PlayerAchievement[];
  joinedAt: string;
  lastSeenAt: string;
}

export interface PublicObject {
  id: string;
  name: string;
  slug: string;
  imageUrl: string;
  description: string;
  historicalInfo: string;
  facts: string[];
  category: string;
  points: number;
  status: ObjectStatus;
  latitude: number;
  longitude: number;
  claimRadiusMeters: number;
  reservedPlayerId?: string;
  foundPlayerId?: string;
  foundAt?: string;
}

export interface AdminObject extends PublicObject {
  qrToken: string;
  positionX: number;
  positionY: number;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  points: number;
}

export interface PlayerAchievement extends Achievement {
  unlockedAt: string;
}

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  message: string;
  playerId?: string;
  playerName?: string;
  objectId?: string;
  objectName?: string;
  points?: number;
  createdAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  nickname: string;
  score: number;
  discoveries: number;
  combo: number;
  streak: number;
  wrongScans: number;
  achievements: PlayerAchievement[];
}

export interface GameStats {
  totalPlayers: number;
  connectedPlayers: number;
  totalObjects: number;
  remainingObjects: number;
  foundObjects: number;
  reservedObjects: number;
  progressPercent: number;
  totalPoints: number;
  wrongScans: number;
  elapsedSeconds: number;
  remainingSeconds: number;
  fastestDiscoverySeconds?: number;
}

export interface GameState {
  game: Game;
  objects: PublicObject[];
  leaderboard: LeaderboardEntry[];
  players: Player[];
  activities: ActivityEvent[];
  stats: GameStats;
  winner?: LeaderboardEntry;
}

export interface JoinPlayerResponse {
  player: Player;
  token: string;
  state: GameState;
}

export interface ValidationSuccess {
  ok: true;
  object: PublicObject;
  pointsAwarded: number;
  bonuses: {
    base: number;
    speed: number;
    combo: number;
    streak: number;
  };
  achievements: PlayerAchievement[];
  gameComplete: boolean;
  state: GameState;
}

export interface ValidationFailure {
  ok: false;
  reason: string;
  penalty: number;
  state: GameState;
}

export type ValidationResponse = ValidationSuccess | ValidationFailure;

export interface NextMissionResponse {
  player: Player;
  mission?: PublicObject;
  state: GameState;
}

export interface AdminAuthResponse {
  token: string;
}

export interface ObjectInput {
  name: string;
  imageUrl?: string;
  description: string;
  historicalInfo: string;
  facts: string[];
  category: string;
  points: number;
  positionX: number;
  positionY: number;
  latitude: number;
  longitude: number;
  claimRadiusMeters: number;
}

export interface ClaimLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface SocketEvents {
  "game:state": (state: GameState) => void;
  "activity:new": (event: ActivityEvent) => void;
  "achievement:unlocked": (payload: { playerId: string; achievement: PlayerAchievement }) => void;
}

export const defaultAchievements: Achievement[] = [
  {
    id: "first-find",
    name: "First Discovery",
    description: "Validated the first heritage object.",
    icon: "Sparkles",
    category: "exploration",
    points: 25
  },
  {
    id: "speed-runner",
    name: "Swift Explorer",
    description: "Found an object within the speed bonus window.",
    icon: "Zap",
    category: "speed",
    points: 30
  },
  {
    id: "triple-streak",
    name: "Perfect Streak",
    description: "Completed three successful missions without a wrong scan.",
    icon: "Flame",
    category: "collection",
    points: 40
  },
  {
    id: "historian",
    name: "Heritage Keeper",
    description: "Discovered three Mahdia history objects.",
    icon: "Landmark",
    category: "history",
    points: 40
  },
  {
    id: "champion",
    name: "Mahdia Champion",
    description: "Finished the hunt at the top of the leaderboard.",
    icon: "Trophy",
    category: "completion",
    points: 100
  }
];
