export const ROLES = [
  "OWNER",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "CHEF",
  "INVENTORY_MANAGER",
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
  "users.manage",
  "waiter.floor",
  "inventory.view",
  "inventory.edit",
  "inventory.purchase",
  "inventory.approve",
  "inventory.transfer",
  "inventory.finance",
  "ai.use",
  "ai.actions",
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
    "users.manage",
    "waiter.floor",
    "inventory.view",
    "inventory.edit",
    "inventory.purchase",
    "inventory.approve",
    "inventory.transfer",
    "inventory.finance",
    "ai.use",
    "ai.actions",
  ],
  INVENTORY_MANAGER: [
    "dashboard.view",
    "inventory.view",
    "inventory.edit",
    "inventory.purchase",
    "inventory.approve",
    "inventory.transfer",
    "menu.view",
    "branch.switch",
    "ai.use",
    "ai.actions",
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
    "inventory.view",
    "ai.use",
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
    "waiter.floor",
    "payments.create",
    "ai.use",
  ],
  CHEF: [
    "kds.view",
    "kds.update",
    "orders.view",
    "orders.update",
    "inventory.view",
    "ai.use",
  ],
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
    case "WAITER":
      return "/waiter";
    case "INVENTORY_MANAGER":
      return "/inventory";
    default:
      return "/dashboard";
  }
}
