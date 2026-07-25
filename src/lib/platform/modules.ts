import type { PlanId } from "@/lib/billing/plans";

export const MODULE_IDS = [
  "pos",
  "kds",
  "tables",
  "orders",
  "menu",
  "inventory",
  "finance",
  "crm",
  "hr",
  "ai",
  "qr",
  "reservations",
  "marketing",
  "reports",
  "staff",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleMap = Record<ModuleId, boolean>;

export const MODULE_LABELS: Record<ModuleId, string> = {
  pos: "POS",
  kds: "KDS",
  tables: "Tables",
  orders: "Orders",
  menu: "Menu",
  inventory: "Inventory",
  finance: "Finance",
  crm: "CRM",
  hr: "HR",
  ai: "AI Copilot",
  qr: "QR Ordering",
  reservations: "Reservations",
  marketing: "Marketing",
  reports: "Reports",
  staff: "Waiters / Staff",
};

/** Paths (prefix) → module. Unlisted routes (dashboard, settings) always allowed. */
export const PATH_MODULE: { prefix: string; module: ModuleId }[] = [
  { prefix: "/ai", module: "ai" },
  { prefix: "/pos", module: "pos" },
  { prefix: "/kds", module: "kds" },
  { prefix: "/orders", module: "orders" },
  { prefix: "/menu", module: "menu" },
  { prefix: "/inventory", module: "inventory" },
  { prefix: "/tables", module: "tables" },
  { prefix: "/reservations", module: "reservations" },
  { prefix: "/crm", module: "crm" },
  { prefix: "/finance", module: "finance" },
  { prefix: "/hr", module: "hr" },
  { prefix: "/marketing", module: "marketing" },
  { prefix: "/reports", module: "reports" },
  { prefix: "/staff", module: "staff" },
  { prefix: "/qr", module: "qr" },
];

const STARTER_ON: ModuleId[] = [
  "pos",
  "orders",
  "menu",
  "tables",
  "kds",
  "reports",
  "staff",
];

const GROWTH_OFF: ModuleId[] = []; // all on except we can leave marketing optional — all on

function fromList(on: ModuleId[]): ModuleMap {
  const m = {} as ModuleMap;
  for (const id of MODULE_IDS) m[id] = on.includes(id);
  return m;
}

/** Default modules enabled per plan (before admin overrides). */
export function defaultModulesForPlan(plan: PlanId | string | null | undefined): ModuleMap {
  const p = plan === "ENTERPRISE" || plan === "GROWTH" || plan === "STARTER" ? plan : "STARTER";
  if (p === "ENTERPRISE") {
    return fromList([...MODULE_IDS]);
  }
  if (p === "GROWTH") {
    // Growth: everything on
    void GROWTH_OFF;
    return fromList([...MODULE_IDS]);
  }
  return fromList(STARTER_ON);
}

/**
 * Merge plan defaults with stored overrides.
 * Stored map may be partial; missing keys fall back to plan default.
 */
export function resolveModules(
  plan: PlanId | string | null | undefined,
  stored?: Partial<Record<string, boolean>> | null
): ModuleMap {
  const base = defaultModulesForPlan(plan);
  if (!stored || typeof stored !== "object") return base;
  const out = { ...base };
  for (const id of MODULE_IDS) {
    if (typeof stored[id] === "boolean") out[id] = stored[id]!;
  }
  return out;
}

export function countEnabledModules(modules: ModuleMap): number {
  return MODULE_IDS.filter((id) => modules[id]).length;
}

export function moduleForPath(pathname: string): ModuleId | null {
  const hit = PATH_MODULE.find(
    (p) => pathname === p.prefix || pathname.startsWith(p.prefix + "/")
  );
  return hit?.module ?? null;
}

export function isModuleEnabled(
  modules: ModuleMap | null | undefined,
  moduleId: ModuleId | null
): boolean {
  if (!moduleId) return true;
  if (!modules) return true;
  return modules[moduleId] !== false;
}

export type LimitOverrides = {
  maxBranches?: number | null;
  maxStaff?: number | null;
  maxTables?: number | null;
};

export function resolveLimits(
  planLimits: { maxBranches: number; maxStaff: number; maxTables: number },
  overrides?: LimitOverrides | null
) {
  return {
    maxBranches:
      overrides?.maxBranches != null && overrides.maxBranches !== undefined
        ? overrides.maxBranches
        : planLimits.maxBranches,
    maxStaff:
      overrides?.maxStaff != null && overrides.maxStaff !== undefined
        ? overrides.maxStaff
        : planLimits.maxStaff,
    maxTables:
      overrides?.maxTables != null && overrides.maxTables !== undefined
        ? overrides.maxTables
        : planLimits.maxTables,
  };
}

export const MODULE_ZOD_KEYS = MODULE_IDS;
