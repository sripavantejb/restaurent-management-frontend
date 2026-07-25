import { Table, type ITable, normalizeTableStatus } from "@/models/Table";
import type { AiTenantCtx, ToolResult } from "../types";

function base(ctx: AiTenantCtx) {
  return { restaurantId: ctx.restaurantId, branchId: ctx.branchId };
}

async function byStatus(
  ctx: AiTenantCtx,
  statuses: string[],
  title: string
): Promise<ToolResult> {
  const tables = (await Table.find(base(ctx)).lean()) as unknown as ITable[];
  const matched = tables.filter((t) =>
    statuses.includes(normalizeTableStatus(t.status))
  );
  return {
    ok: true,
    summary: `${matched.length} table(s) — ${title}.`,
    blocks: [
      {
        type: "table",
        title,
        data: {
          columns: ["number", "status", "capacity", "vip", "outdoor"],
          rows: matched.map((t) => ({
            number: t.number,
            status: normalizeTableStatus(t.status),
            capacity: t.capacity,
            vip: t.isVip ? "Yes" : "No",
            outdoor: t.isOutdoor ? "Yes" : "No",
          })),
        },
      },
    ],
  };
}

export async function getOccupiedTables(ctx: AiTenantCtx) {
  return byStatus(ctx, ["OCCUPIED", "PREPARING_BILL"], "Occupied / billing");
}

export async function getAvailableTables(ctx: AiTenantCtx) {
  return byStatus(ctx, ["AVAILABLE"], "Available");
}

export async function getReservedTables(ctx: AiTenantCtx) {
  return byStatus(ctx, ["RESERVED"], "Reserved");
}

export async function getCleaningTables(ctx: AiTenantCtx) {
  return byStatus(ctx, ["CLEANING"], "Cleaning");
}

export async function getTableStatus(ctx: AiTenantCtx): Promise<ToolResult> {
  const tables = (await Table.find(base(ctx)).lean()) as unknown as ITable[];
  const counts: Record<string, number> = {};
  for (const t of tables) {
    const s = normalizeTableStatus(t.status);
    counts[s] = (counts[s] ?? 0) + 1;
  }
  const occupied =
    (counts.OCCUPIED ?? 0) + (counts.PREPARING_BILL ?? 0);
  return {
    ok: true,
    summary: `${occupied}/${tables.length} occupied · ${counts.AVAILABLE ?? 0} free · ${counts.CLEANING ?? 0} cleaning.`,
    blocks: [
      {
        type: "kpi",
        title: "Floor occupancy",
        data: Object.entries(counts).map(([label, value]) => ({
          label,
          value: String(value),
        })),
      },
      {
        type: "chart",
        title: "Status mix",
        data: {
          kind: "pie",
          points: Object.entries(counts).map(([x, y]) => ({ x, y })),
        },
      },
    ],
    followUps: ["List occupied tables", "Mark cleaning tables available"],
  };
}
