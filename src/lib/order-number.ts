import mongoose, { Schema, models, model, type Model } from "mongoose";

interface ICounter {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const Counter: Model<ICounter> =
  (models.Counter as Model<ICounter>) ||
  model<ICounter>("Counter", CounterSchema);

/**
 * Atomically allocate the next order number for a branch.
 * Format: `{branchCode}-{0001}`
 */
export async function allocateOrderNumber(
  restaurantId: string | mongoose.Types.ObjectId,
  branchId: string | mongoose.Types.ObjectId,
  branchCode: string
): Promise<string> {
  const key = `order:${String(restaurantId)}:${String(branchId)}`;
  const doc = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  const seq = doc?.seq ?? 1;
  const code =
    (branchCode || "B1").toUpperCase().replace(/[^A-Z0-9]/gi, "") || "B1";
  return `${code}-${String(seq).padStart(4, "0")}`;
}
