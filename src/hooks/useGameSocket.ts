import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import type { GameState } from "../../shared/types";
import { API_BASE } from "../api/client";

export const gameStateKey = ["game-state"];

export function useGameSocket() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io(API_BASE || window.location.origin, {
      transports: ["websocket", "polling"]
    });

    socket.on("game:state", (state: GameState) => {
      queryClient.setQueryData(gameStateKey, state);
    });

    return () => {
      socket.disconnect();
    };
  }, [queryClient]);
}
