"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiUrl } from "@/lib/api-url";

export interface PlatformAdminUser {
  id: string;
  name: string;
  email: string;
}

interface PlatformAuthState {
  admin: PlatformAdminUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthState | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(apiUrl("/api/platform/auth/me"), {
      credentials: "include",
    });
    if (!res.ok) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setAdmin(data.admin);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    await fetch(apiUrl("/api/platform/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    setAdmin(null);
    window.location.href = "/admin/login";
  };

  return (
    <PlatformAuthContext.Provider value={{ admin, loading, refresh, logout }}>
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) {
    throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  }
  return ctx;
}

export async function platformFetch(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), {
    ...options,
    headers,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.hint || "Request failed");
  }
  return data;
}
