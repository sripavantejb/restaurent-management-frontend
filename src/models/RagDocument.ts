import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";

export const RAG_SOURCE_TYPES = [
  "MENU_ITEM",
  "RECIPE",
  "INVENTORY",
  "RESTAURANT",
  "UPLOAD",
] as const;
export type RagSourceType = (typeof RAG_SOURCE_TYPES)[number];

export const RAG_DOC_STATUSES = ["READY", "INDEXING", "FAILED"] as const;
export type RagDocStatus = (typeof RAG_DOC_STATUSES)[number];

export interface IRagDocument {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  sourceType: RagSourceType;
  sourceId?: mongoose.Types.ObjectId | null;
  title: string;
  status: RagDocStatus;
  contentHash: string;
  errorMessage?: string;
  chunkCount: number;
}

const RagDocumentSchema = new Schema(
  {
    sourceType: {
      type: String,
      enum: RAG_SOURCE_TYPES,
      required: true,
      index: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: RAG_DOC_STATUSES,
      default: "INDEXING",
      index: true,
    },
    contentHash: { type: String, default: "", index: true },
    errorMessage: { type: String, default: "" },
    chunkCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

RagDocumentSchema.plugin(tenantPlugin);
RagDocumentSchema.index({ restaurantId: 1, sourceType: 1 });
RagDocumentSchema.index(
  { restaurantId: 1, branchId: 1, sourceType: 1, sourceId: 1 },
  { unique: true, partialFilterExpression: { sourceId: { $type: "objectId" } } }
);

export const RagDocument: Model<IRagDocument> =
  (models.RagDocument as Model<IRagDocument>) ||
  model<IRagDocument>("RagDocument", RagDocumentSchema);
