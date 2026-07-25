"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Permission, Role } from "@/lib/rbac";
import { apiUrl } from "@/lib/api-url";
import type { ModuleId, ModuleMap } from "@/lib/platform/modules";
import { isModuleEnabled, moduleForPath } from "@/lib/platform/modules";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  permissions: Permission[];
  restaurantId: string;
  branchId: string;
}

export interface BranchInfo {
  id: string;
  name: string;
  code: string;
}

export interface AuthRestaurant {
  id: string;
  name: string;
  currency: string;
  logoUrl?: string;
  plan?: string;
  modules?: ModuleMap | null;
  qrOrderingEnabled?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  restaurant: AuthRestaurant | null;
  branches: BranchInfo[];
  activeBranchId: string | null;
  loading: boolean;
  setActiveBranchId: (id: string) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (p: Permission) => boolean;
  hasModule: (moduleId: ModuleId | null) => boolean;
  isPathModuleEnabled: (pathname: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

const BRANCH_KEY = "ros_active_branch";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [restaurant, setRestaurant] = useState<AuthRestaurant | null>(null);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [activeBranchId, setActiveBranchIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const res = await fetch(apiUrl("/api/auth/me"), { credentials: "include" });
    if (!res.ok) {
      setUser(null);
      setRestaurant(null);
      setBranches([]);
      setLoading(false);
      return;
    }
    const data = await res.json();
    if (!data.user) {
      setUser(null);
      setRestaurant(null);
      setBranches([]);
      setLoading(false);
      return;
    }
    setUser(data.user);
    setRestaurant(data.restaurant);
    setBranches(data.branches ?? []);
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(BRANCH_KEY) : null;
    const canSwitch = data.user.permissions.includes("branch.switch");
    const next =
      (canSwitch &&
      stored &&
      data.branches.some((b: BranchInfo) => b.id === stored)
        ? stored
        : null) || data.user.branchId;
    setActiveBranchIdState(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setActiveBranchId = (id: string) => {
    setActiveBranchIdState(id);
    localStorage.setItem(BRANCH_KEY, id);
  };

  const logout = async () => {
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    });
    setUser(null);
    window.location.href = "/login";
  };

  const hasPermission = (p: Permission) =>
    !!user?.permissions.includes(p);

  const hasModule = (moduleId: ModuleId | null) =>
    isModuleEnabled(restaurant?.modules ?? null, moduleId);

  const isPathModuleEnabled = (pathname: string) =>
    hasModule(moduleForPath(pathname));

  return (
    <AuthContext.Provider
      value={{
        user,
        restaurant,
        branches,
        activeBranchId,
        loading,
        setActiveBranchId,
        refresh,
        logout,
        hasPermission,
        hasModule,
        isPathModuleEnabled,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export async function apiFetch(
  path: string,
  options: RequestInit & { branchId?: string | null } = {}
) {
  const { branchId, headers, ...rest } = options;
  const h = new Headers(headers);
  if (branchId) h.set("x-branch-id", branchId);
  if (!h.has("Content-Type") && rest.body) {
    h.set("Content-Type", "application/json");
  }
  const res = await fetch(apiUrl(path), {
    ...rest,
    headers: h,
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.hint || "Request failed");
  }
  return data;
}
