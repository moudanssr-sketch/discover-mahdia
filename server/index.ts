import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import morgan from "morgan";
import multer from "multer";
import QRCode from "qrcode";
import { Server } from "socket.io";
import { z } from "zod";
import type { ObjectInput } from "../shared/types";
import { requireAdmin, requirePlayer, signAdminToken, signPlayerToken, verifyAdminPassword } from "./auth";
import type { AuthenticatedRequest } from "./auth";
import { config } from "./config";
import { createStore } from "./store";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const server = http.createServer(app);
const store = createStore();

fs.mkdirSync(config.uploadDir, { recursive: true });

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin,
    credentials: true
  }
});

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, config.uploadDir),
  filename: (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`;
    callback(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      callback(new Error("Only image uploads are allowed."));
      return;
    }
    callback(null, true);
  }
});

const asyncHandler =
  (handler: (request: Request, response: Response, next: NextFunction) => Promise<void>) =>
  (request: Request, response: Response, next: NextFunction) => {
    handler(request, response, next).catch(next);
  };

const objectInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  imageUrl: z.string().trim().optional().default(""),
  description: z.string().trim().min(10).max(280),
  historicalInfo: z.string().trim().min(20).max(1600),
  facts: z.array(z.string().trim().min(2)).min(1).max(8),
  category: z.string().trim().min(2).max(40),
  points: z.coerce.number().int().min(1).max(1000),
  positionX: z.coerce.number().min(0).max(100),
  positionY: z.coerce.number().min(0).max(100),
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  claimRadiusMeters: z.coerce.number().int().min(3).max(500)
});

const emitState = async () => {
  io.emit("game:state", await store.getState());
};

const parseObjectInput = (body: unknown): ObjectInput => objectInputSchema.parse(body);

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: config.nodeEnv === "production" ? undefined : false
  })
);
app.use(
  cors({
    origin: config.clientOrigin,
    credentials: true
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(path.resolve(config.uploadDir)));

app.get(
  "/api/health",
  asyncHandler(async (_request, response) => {
    response.json({ ok: true, mode: config.databaseUrl ? "postgres" : "memory" });
  })
);

app.get(
  "/api/state",
  asyncHandler(async (_request, response) => {
    response.json(await store.getState());
  })
);

app.post(
  "/api/player/join",
  asyncHandler(async (request, response) => {
    const schema = z.object({ nickname: z.string().trim().min(2).max(24) });
    const { nickname } = schema.parse(request.body);
    const result = await store.joinPlayer(nickname);
    const token = signPlayerToken(result.player.id);
    await emitState();
    response.status(201).json({ ...result, token });
  })
);

app.post(
  "/api/player/next",
  requirePlayer,
  asyncHandler(async (request, response) => {
    const playerId = (request as AuthenticatedRequest).player?.id ?? "";
    const result = await store.assignNextMission(playerId);
    await emitState();
    response.json(result);
  })
);

app.post(
  "/api/player/validate",
  requirePlayer,
  asyncHandler(async (request, response) => {
    const playerId = (request as AuthenticatedRequest).player?.id ?? "";
    const schema = z.object({ qrToken: z.string().trim().min(8) });
    const { qrToken } = schema.parse(request.body);
    const result = await store.validateDiscovery(playerId, qrToken);
    if (result.ok) {
      for (const achievement of result.achievements) {
        io.emit("achievement:unlocked", { playerId, achievement });
      }
    }
    await emitState();
    response.json(result);
  })
);

app.post(
  "/api/player/claim",
  requirePlayer,
  asyncHandler(async (request, response) => {
    const playerId = (request as AuthenticatedRequest).player?.id ?? "";
    const schema = z.object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      accuracy: z.coerce.number().min(0).optional()
    });
    const result = await store.claimCurrentMission(playerId, schema.parse(request.body));
    if (result.ok) {
      for (const achievement of result.achievements) {
        io.emit("achievement:unlocked", { playerId, achievement });
      }
    }
    await emitState();
    response.json(result);
  })
);

app.post(
  "/api/admin/login",
  asyncHandler(async (request, response) => {
    const schema = z.object({
      username: z.string().trim().min(1),
      password: z.string().min(1)
    });
    const { username, password } = schema.parse(request.body);
    const ok = await verifyAdminPassword(username, password);
    if (!ok) {
      response.status(401).json({ error: "Invalid admin credentials." });
      return;
    }
    response.json({ token: signAdminToken(username) });
  })
);

app.post(
  "/api/admin/game/start",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    const state = await store.startGame();
    await emitState();
    response.json(state);
  })
);

app.post(
  "/api/admin/game/end",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    const state = await store.endGame();
    await emitState();
    response.json(state);
  })
);

app.post(
  "/api/admin/game/reset",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    const state = await store.resetGame();
    await emitState();
    response.json(state);
  })
);

app.get(
  "/api/admin/objects",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    response.json(await store.listAdminObjects());
  })
);

app.post(
  "/api/admin/objects",
  requireAdmin,
  asyncHandler(async (request, response) => {
    const object = await store.createObject(parseObjectInput(request.body));
    await emitState();
    response.status(201).json(object);
  })
);

app.put(
  "/api/admin/objects/:id",
  requireAdmin,
  asyncHandler(async (request, response) => {
    const object = await store.updateObject(request.params.id, parseObjectInput(request.body));
    await emitState();
    response.json(object);
  })
);

app.delete(
  "/api/admin/objects/:id",
  requireAdmin,
  asyncHandler(async (request, response) => {
    await store.deleteObject(request.params.id);
    await emitState();
    response.status(204).end();
  })
);

app.get(
  "/api/admin/objects/:id/qr",
  requireAdmin,
  asyncHandler(async (request, response) => {
    const object = await store.getAdminObject(request.params.id);
    if (!object) {
      response.status(404).json({ error: "Object not found." });
      return;
    }
    const scanUrl = `${config.publicAppUrl.replace(/\/$/, "")}/scan/${object.qrToken}`;
    const buffer = await QRCode.toBuffer(scanUrl, {
      width: 960,
      margin: 2,
      color: {
        dark: "#07111f",
        light: "#f5f0df"
      }
    });
    response.setHeader("Content-Type", "image/png");
    response.setHeader("Content-Disposition", `attachment; filename="${object.slug}-qr.png"`);
    response.send(buffer);
  })
);

app.post(
  "/api/admin/upload/map",
  requireAdmin,
  upload.single("map"),
  asyncHandler(async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ error: "Missing map file." });
      return;
    }
    const state = await store.updateMap(`/uploads/${file.filename}`);
    await emitState();
    response.json(state);
  })
);

app.post(
  "/api/admin/upload/object-image",
  requireAdmin,
  upload.single("image"),
  asyncHandler(async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ error: "Missing image file." });
      return;
    }
    response.status(201).json({ imageUrl: `/uploads/${file.filename}` });
  })
);

app.get(
  "/api/admin/export",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    const results = await store.exportResults();
    response.setHeader("Content-Disposition", `attachment; filename="discover-mahdia-results-${Date.now()}.json"`);
    response.json(results);
  })
);

app.get(
  "/api/admin/stats",
  requireAdmin,
  asyncHandler(async (_request, response) => {
    response.json((await store.getState()).stats);
  })
);

const clientDistCandidates = [path.resolve(__dirname, "../dist/client"), path.resolve(__dirname, "../client")];
const clientDist = clientDistCandidates.find((candidate) => fs.existsSync(path.join(candidate, "index.html")));
if (clientDist) {
  app.use(express.static(clientDist));
  app.get("*", (_request, response) => {
    response.sendFile(path.join(clientDist, "index.html"));
  });
}

app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "Invalid request payload.", details: error.flatten() });
    return;
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message.toLowerCase().includes("not found") ? 404 : 500;
  response.status(status).json({ error: message });
});

let socketCount = 0;

io.on("connection", async (socket) => {
  socketCount += 1;
  store.setConnectedPlayers(socketCount);
  socket.emit("game:state", await store.getState());
  await emitState();

  socket.on("disconnect", async () => {
    socketCount = Math.max(0, socketCount - 1);
    store.setConnectedPlayers(socketCount);
    await emitState();
  });
});

await store.initialize();

server.listen(config.port, () => {
  console.log(`Discover Mahdia server running on http://localhost:${config.port}`);
});
