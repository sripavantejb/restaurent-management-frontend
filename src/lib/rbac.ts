export const ROLES = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
] as const;

export type Role = (typeof ROLES)[number];

export const PERMISSIONS = [
  "dashboard.view",
  "reports.view",
  "pos.bill",
  "kds.view",
  "kds.update",
  "orders.view",
  "orders.create",
  "orders.update",
  "menu.view",
  "menu.edit",
  "tables.view",
  "tables.update",
  "payments.create",
  "branch.switch",
  "qr.manage",
  "sessions.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Role → permission map. Designed so new roles/permissions are additive only.
 * OWNER gets every permission in PERMISSIONS automatically.
 */
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  OWNER: [...PERMISSIONS],
  MANAGER: [
    "dashboard.view",
    "reports.view",
    "pos.bill",
    "kds.view",
    "kds.update",
    "orders.view",
    "orders.create",
    "orders.update",
    "menu.view",
    "menu.edit",
    "tables.view",
    "tables.update",
    "payments.create",
    "qr.manage",
    "sessions.manage",
  ],
  CASHIER: [
    "pos.bill",
    "orders.view",
    "orders.create",
    "orders.update",
    "menu.view",
    "tables.view",
    "payments.create",
    "sessions.manage",
  ],
  WAITER: [
    "pos.bill",
    "orders.view",
    "orders.create",
    "orders.update",
    "menu.view",
    "tables.view",
    "tables.update",
    "sessions.manage",
  ],
  CHEF: ["kds.view", "kds.update", "orders.view", "orders.update"],
};

export function permissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(
  permissions: readonly string[],
  required: Permission | Permission[]
): boolean {
  const needed = Array.isArray(required) ? required : [required];
  return needed.every((p) => permissions.includes(p));
}

export function homePathForRole(role: Role): string {
  switch (role) {
    case "CASHIER":
      return "/pos";
    case "CHEF":
      return "/kds";
    default:
      return "/dashboard";
  }
}
