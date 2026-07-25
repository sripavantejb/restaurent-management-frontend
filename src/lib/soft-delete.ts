import { Schema, type Model } from "mongoose";

/**
 * Soft-delete: sets deletedAt instead of removing the document.
 * Queries exclude soft-deleted docs unless `{ includeDeleted: true }` is passed.
 */
export function softDeletePlugin(schema: Schema) {
  if (!schema.path("deletedAt")) {
    schema.add({
      deletedAt: { type: Date, default: null, index: true },
    });
  }

  schema.pre(
    [
      "find",
      "findOne",
      "countDocuments",
      "findOneAndUpdate",
      "updateMany",
      "updateOne",
    ],
    function () {
      const opts = this.getOptions?.() ?? {};
      if ((opts as { includeDeleted?: boolean }).includeDeleted) return;
      const filter = this.getFilter();
      if (filter.deletedAt === undefined) {
        filter.deletedAt = null;
      }
    }
  );

  schema.methods.softDelete = async function softDelete() {
    this.deletedAt = new Date();
    return this.save();
  };

  schema.statics.softDeleteById = async function softDeleteById(
    id: unknown
  ) {
    return this.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { new: true }
    );
  };
}

export type SoftDeleteModel<T> = Model<T> & {
  softDeleteById(id: unknown): Promise<T | null>;
};
