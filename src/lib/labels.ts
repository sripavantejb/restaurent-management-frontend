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
  FREE: "Free",
  OCCUPIED: "In use",
  BILLED: "Bill due",
  RESERVED: "Reserved",
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
  OWNER: "Owner",
  MANAGER: "Manager",
  CASHIER: "Cashier",
  WAITER: "Waiter",
  CHEF: "Chef",
};

export const SERVICE_TYPE_LABEL: Record<string, string> = {
  WAITER: "Call waiter",
  WATER: "Water",
  CUTLERY: "Cutlery",
  BILL: "Bill request",
};

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
