import mongoose, { Schema, models, model, type Model } from "mongoose";
import { tenantPlugin } from "@/lib/tenant";
import {
  RAG_SOURCE_TYPES,
  type RagSourceType,
} from "@/models/RagDocument";

export interface IRagChunk {
  _id: mongoose.Types.ObjectId;
  restaurantId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  documentId: mongoose.Types.ObjectId;
  sourceType: RagSourceType;
  text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  contentHash: string;
}

const RagChunkSchema = new Schema(
  {
    documentId: {
      type: Schema.Types.ObjectId,
      ref: "RagDocument",
      required: true,
      index: true,
    },
    sourceType: {
      type: String,
      enum: RAG_SOURCE_TYPES,
      required: true,
      index: true,
    },
    text: { type: String, required: true },
    embedding: { type: [Number], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    contentHash: { type: String, default: "", index: true },
  },
  { timestamps: true }
);

RagChunkSchema.plugin(tenantPlugin);
RagChunkSchema.index({ restaurantId: 1, sourceType: 1 });
RagChunkSchema.index({ restaurantId: 1, documentId: 1 });

export const RagChunk: Model<IRagChunk> =
  (models.RagChunk as Model<IRagChunk>) ||
  model<IRagChunk>("RagChunk", RagChunkSchema);
