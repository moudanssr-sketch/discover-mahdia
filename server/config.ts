import dotenv from "dotenv";
import type { ScoringConfig } from "../shared/types";

dotenv.config();

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const scoring: ScoringConfig = {
  baseDiscoveryPoints: toNumber(process.env.BASE_DISCOVERY_POINTS, 100),
  speedBonusPoints: toNumber(process.env.SPEED_BONUS_POINTS, 40),
  speedBonusSeconds: toNumber(process.env.SPEED_BONUS_SECONDS, 180),
  comboBonusPoints: toNumber(process.env.COMBO_BONUS_POINTS, 15),
  perfectStreakPoints: toNumber(process.env.PERFECT_STREAK_POINTS, 60),
  wrongScanPenalty: toNumber(process.env.WRONG_SCAN_PENALTY, 20)
};

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: toNumber(process.env.PORT, 4000),
  publicAppUrl: process.env.PUBLIC_APP_URL ?? "http://localhost:5173",
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET ?? "development-only-change-me",
  adminUsername: process.env.ADMIN_USERNAME ?? "admin",
  adminPassword: process.env.ADMIN_PASSWORD ?? "admin",
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH,
  gameDurationSeconds: toNumber(process.env.GAME_DURATION_SECONDS, 3600),
  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  scoring
};

if (config.nodeEnv === "production" && config.jwtSecret === "development-only-change-me") {
  throw new Error("JWT_SECRET must be set in production.");
}
