import type { NextFunction, Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config";

export interface AuthenticatedRequest extends Request {
  admin?: { username: string };
  player?: { id: string };
}

interface AdminTokenPayload {
  sub: string;
  role: "admin";
}

interface PlayerTokenPayload {
  sub: string;
  role: "player";
}

export const verifyAdminPassword = async (username: string, password: string) => {
  if (username !== config.adminUsername) {
    return false;
  }

  if (config.adminPasswordHash) {
    return bcrypt.compare(password, config.adminPasswordHash);
  }

  return password === config.adminPassword;
};

export const signAdminToken = (username: string) =>
  jwt.sign({ sub: username, role: "admin" } satisfies AdminTokenPayload, config.jwtSecret, {
    expiresIn: "8h"
  });

export const signPlayerToken = (playerId: string) =>
  jwt.sign({ sub: playerId, role: "player" } satisfies PlayerTokenPayload, config.jwtSecret, {
    expiresIn: "6h"
  });

const bearerToken = (request: Request) => {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return undefined;
  }
  return header.slice("Bearer ".length);
};

export const requireAdmin = (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Missing admin token." });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AdminTokenPayload;
    if (payload.role !== "admin") {
      response.status(403).json({ error: "Invalid admin role." });
      return;
    }
    request.admin = { username: payload.sub };
    next();
  } catch {
    response.status(401).json({ error: "Invalid admin token." });
  }
};

export const requirePlayer = (request: AuthenticatedRequest, response: Response, next: NextFunction) => {
  const token = bearerToken(request);
  if (!token) {
    response.status(401).json({ error: "Missing player token." });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as PlayerTokenPayload;
    if (payload.role !== "player") {
      response.status(403).json({ error: "Invalid player role." });
      return;
    }
    request.player = { id: payload.sub };
    next();
  } catch {
    response.status(401).json({ error: "Invalid player token." });
  }
};
