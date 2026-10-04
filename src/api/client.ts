import type {
  AdminAuthResponse,
  ClaimLocation,
  AdminObject,
  GameState,
  JoinPlayerResponse,
  NextMissionResponse,
  ObjectInput,
  ValidationResponse
} from "../../shared/types";

export const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export const PLAYER_TOKEN_KEY = "discover-mahdia-player-token";
export const PLAYER_ID_KEY = "discover-mahdia-player-id";
export const ADMIN_TOKEN_KEY = "discover-mahdia-admin-token";

interface RequestOptions extends RequestInit {
  token?: string | null;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new ApiError(payload.error ?? "Request failed.", response.status, payload.details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
};

export const api = {
  state: () => request<GameState>("/api/state"),
  join: (nickname: string) =>
    request<JoinPlayerResponse>("/api/player/join", {
      method: "POST",
      body: JSON.stringify({ nickname })
    }),
  nextMission: (token: string) =>
    request<NextMissionResponse>("/api/player/next", {
      method: "POST",
      token
    }),
  validateQr: (token: string, qrToken: string) =>
    request<ValidationResponse>("/api/player/validate", {
      method: "POST",
      token,
      body: JSON.stringify({ qrToken })
    }),
  claimMission: (token: string, location: ClaimLocation) =>
    request<ValidationResponse>("/api/player/claim", {
      method: "POST",
      token,
      body: JSON.stringify(location)
    }),
  adminLogin: (username: string, password: string) =>
    request<AdminAuthResponse>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  startGame: (token: string) =>
    request<GameState>("/api/admin/game/start", {
      method: "POST",
      token
    }),
  endGame: (token: string) =>
    request<GameState>("/api/admin/game/end", {
      method: "POST",
      token
    }),
  resetGame: (token: string) =>
    request<GameState>("/api/admin/game/reset", {
      method: "POST",
      token
    }),
  adminObjects: (token: string) => request<AdminObject[]>("/api/admin/objects", { token }),
  createObject: (token: string, input: ObjectInput) =>
    request<AdminObject>("/api/admin/objects", {
      method: "POST",
      token,
      body: JSON.stringify(input)
    }),
  updateObject: (token: string, id: string, input: ObjectInput) =>
    request<AdminObject>(`/api/admin/objects/${id}`, {
      method: "PUT",
      token,
      body: JSON.stringify(input)
    }),
  deleteObject: (token: string, id: string) =>
    request<void>(`/api/admin/objects/${id}`, {
      method: "DELETE",
      token
    }),
  uploadMap: (token: string, file: File) => {
    const body = new FormData();
    body.set("map", file);
    return request<GameState>("/api/admin/upload/map", {
      method: "POST",
      token,
      body
    });
  },
  uploadObjectImage: (token: string, file: File) => {
    const body = new FormData();
    body.set("image", file);
    return request<{ imageUrl: string }>("/api/admin/upload/object-image", {
      method: "POST",
      token,
      body
    });
  },
  downloadQr: async (token: string, objectId: string) => {
    const response = await fetch(`${API_BASE}/api/admin/objects/${objectId}/qr`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new ApiError("QR code download failed.", response.status);
    }
    return response.blob();
  },
  exportResults: async (token: string) => {
    const response = await fetch(`${API_BASE}/api/admin/export`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      throw new ApiError("Export failed.", response.status);
    }
    return response.blob();
  }
};

export const getPlayerSession = () => ({
  token: localStorage.getItem(PLAYER_TOKEN_KEY),
  playerId: localStorage.getItem(PLAYER_ID_KEY)
});

export const savePlayerSession = (token: string, playerId: string) => {
  localStorage.setItem(PLAYER_TOKEN_KEY, token);
  localStorage.setItem(PLAYER_ID_KEY, playerId);
};

export const clearPlayerSession = () => {
  localStorage.removeItem(PLAYER_TOKEN_KEY);
  localStorage.removeItem(PLAYER_ID_KEY);
};
