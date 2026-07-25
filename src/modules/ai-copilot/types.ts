import type { Permission } from "@/lib/rbac";
import type { Types } from "mongoose";

export interface AiTenantCtx {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
  userId: Types.ObjectId;
  role: string;
  permissions: readonly string[];
}

export interface ToolResultBlock {
  type: "kpi" | "table" | "chart" | "list" | "insight" | "action";
  title?: string;
  data: unknown;
}

export interface ToolResult {
  ok: boolean;
  summary: string;
  blocks?: ToolResultBlock[];
  followUps?: string[];
  error?: string;
  data?: Record<string, unknown>;
}

export type ToolHandler = (
  ctx: AiTenantCtx,
  args: Record<string, unknown>
) => Promise<ToolResult>;

export interface AiToolDefinition {
  name: string;
  description: string;
  permissions: Permission[];
  /** Mutating tools require ai.actions as well */
  isAction?: boolean;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: ToolHandler;
  auditEntity?: string;
}

export interface UiMessageBlock {
  type: string;
  title?: string;
  data: unknown;
}

export interface StreamEvent {
  type:
    | "delta"
    | "block"
    | "tool_start"
    | "tool_end"
    | "done"
    | "error"
    | "conversation";
  content?: string;
  block?: UiMessageBlock;
  tool?: string;
  conversationId?: string;
  messageId?: string;
  error?: string;
}
