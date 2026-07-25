"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/components/AuthProvider";

type SocketLike = {
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  off: (event: string, cb: (...args: unknown[]) => void) => void;
  emit: (event: string, payload?: unknown) => void;
  disconnect: () => void;
};

interface RealtimeState {
  connected: boolean;
  socket: SocketLike | null;
}

const RealtimeContext = createContext<RealtimeState>({
  connected: false,
  socket: null,
});

/** Vercel serverless cannot host Engine.IO / WebSockets. */
function realtimeSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_ENABLE_SOCKETIO === "0") return false;
  if (process.env.NEXT_PUBLIC_ENABLE_SOCKETIO === "1") return true;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return false;
  if (process.env.NEXT_PUBLIC_VERCEL_ENV) return false;
  // Self-hosted / custom domain: opt in via env
  return process.env.NEXT_PUBLIC_ENABLE_SOCKETIO === "1";
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, restaurant, activeBranchId } = useAuth();
  const [socket, setSocket] = useState<SocketLike | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user || !restaurant || !activeBranchId) return;
    if (!realtimeSupported()) return;

    let cancelled = false;
    let s: SocketLike | null = null;

    (async () => {
      try {
        const { io } = await import("socket.io-client");
        if (cancelled) return;
        const client = io({
          path: "/api/socketio",
          transports: ["websocket", "polling"],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 2000,
        });
        s = client as unknown as SocketLike;
        client.on("connect", () => {
          setConnected(true);
          client.emit("join", {
            restaurantId: restaurant.id,
            branchId: activeBranchId,
          });
        });
        client.on("disconnect", () => setConnected(false));
        client.on("connect_error", () => {
          /* avoid noisy retries when custom server is down */
          setConnected(false);
        });
        setSocket(s);
      } catch {
        /* Socket.IO optional */
      }
    })();

    return () => {
      cancelled = true;
      s?.disconnect();
      setSocket(null);
      setConnected(false);
    };
  }, [user, restaurant, activeBranchId]);

  const value = useMemo(() => ({ connected, socket }), [connected, socket]);
  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
