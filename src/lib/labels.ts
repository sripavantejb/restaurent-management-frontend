/**
 * Human-readable labels for enums shown in the UI.
 * Keep API comparisons on raw codes; never render codes directly.
 */

export const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PLACED: "New order",
  PREPARING: "Cooking",
  READY: "Ready",
  SERVED: "Served",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TABLE_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Available",
  FREE: "Available",
  OCCUPIED: "Occupied",
  RESERVED: "Reserved",
  PREPARING_BILL: "Preparing bill",
  BILLED: "Preparing bill",
  CLEANING: "Cleaning",
  BLOCKED: "Blocked",
  OUT_OF_SERVICE: "Out of service",
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  OPEN: "Ordering",
  BILL_REQUESTED: "Bill requested",
  BILLED: "Billed",
  CLOSED: "Closed",
  ABANDONED: "Abandoned",
  PAID: "Paid",
};

export const ITEM_STATUS_LABEL: Record<string, string> = {
  QUEUED: "Waiting",
  COOKING: "Cooking",
  READY: "Ready",
};

export const APPROVAL_STATUS_LABEL: Record<string, string> = {
  NONE: "",
  PENDING: "Awaiting approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const ORDER_TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Dine-in",
  TAKEAWAY: "Takeaway",
  DELIVERY: "Delivery",
};

export const PAY_METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  CARD: "Card",
  UPI: "UPI",
};

export const ROLE_LABEL: Record<string, string> = {
  INVENTORY_MANAGER: "Inventory Manager",
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  CHEF: "Chef",
};

export const SERVICE_TYPES = [
  "WAITER",
  "WATER",
  "WATER_BOTTLE",
  "CUTLERY",
  "COOLING",
  "TISSUE",
  "GET_BILL",
  "BILL",
] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_TYPE_LABEL: Record<ServiceType, string> = {
  WAITER: "Call waiter",
  WATER: "Water",
  WATER_BOTTLE: "Water bottle",
  CUTLERY: "Cutlery",
  COOLING: "Cooling / AC",
  TISSUE: "Tissues",
  GET_BILL: "Get bill",
  BILL: "Pay at counter",
};

/** Guest track chips (excludes Pay at counter — that stays in the bill section). */
export const GUEST_SERVICE_ACTIONS: ServiceType[] = [
  "WAITER",
  "WATER",
  "WATER_BOTTLE",
  "CUTLERY",
  "COOLING",
  "TISSUE",
  "GET_BILL",
];

export const SERVICE_STATUS_LABEL: Record<string, string> = {
  OPEN: "New",
  ACKNOWLEDGED: "On the way",
  DONE: "Done",
};

export const KDS_COLUMN_LABEL: Record<string, string> = {
  NEW: "New",
  COOKING: "Cooking",
  READY: "Ready",
  SERVED: "Served",
};

export const RESTAURANT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
};

export const PLAN_LABEL: Record<string, string> = {
  STARTER: "Starter",
  GROWTH: "Growth",
  ENTERPRISE: "Enterprise",
};

export const BILLING_STATUS_LABEL: Record<string, string> = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  PAST_DUE: "Past due",
  CANCELLED: "Cancelled",
};

export const TABLE_SHAPE_LABEL: Record<string, string> = {
  SQUARE: "Square",
  ROUND: "Round",
  RECT: "Rectangle",
};

function titleCaseCode(code: string): string {
  return code
    .toLowerCase()
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Resolve a display label; falls back to readable title-case of the code. */
export function label(
  map: Record<string, string>,
  code: string | null | undefined,
  fallback?: string
): string {
  if (!code) return fallback ?? "";
  if (map[code]) return map[code];
  return fallback ?? titleCaseCode(code);
}

/** Session status first, then table status — for floor / list chips. */
export function tableDisplayStatus(
  tableStatus: string,
  sessionStatus?: string | null
): string {
  if (sessionStatus === "BILL_REQUESTED") {
    return SESSION_STATUS_LABEL.BILL_REQUESTED;
  }
  if (sessionStatus && SESSION_STATUS_LABEL[sessionStatus]) {
    return label(SESSION_STATUS_LABEL, sessionStatus);
  }
  return label(TABLE_STATUS_LABEL, tableStatus);
}

/** Legacy FREE counts as available. */
export function isTableAvailable(status: string): boolean {
  return status === "AVAILABLE" || status === "FREE";
}

export function isTableSelectable(status: string): boolean {
  return (
    isTableAvailable(status) ||
    status === "OCCUPIED" ||
    status === "PREPARING_BILL" ||
    status === "BILLED" ||
    status === "CLEANING"
  );
}
