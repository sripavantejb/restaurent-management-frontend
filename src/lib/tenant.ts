import { Schema, Types, type Model } from "mongoose";

export interface TenantIds {
  restaurantId: Types.ObjectId;
  branchId: Types.ObjectId;
}

export interface TenantContext extends TenantIds {
  userId: Types.ObjectId;
  role: string;
  permissions: string[];
}

type FilterQuery = Record<string, unknown>;

function injectTenantFilter(
  this: { getOptions: () => { skipTenant?: boolean }; getFilter: () => FilterQuery },
  tenant: TenantIds | undefined
) {
  const opts = this.getOptions?.() ?? {};
  if (opts.skipTenant || !tenant) return;
  const filter = this.getFilter();
  filter.restaurantId = tenant.restaurantId;
  filter.branchId = tenant.branchId;
}

/**
 * Auto-injects restaurantId + branchId on find/update/delete/aggregate.
 * Pass `{ skipTenant: true }` in query options only for seed/admin scripts.
 */
export function tenantPlugin(schema: Schema) {
  if (!schema.path("restaurantId")) {
    schema.add({
      restaurantId: {
        type: Schema.Types.ObjectId,
        ref: "Restaurant",
        required: true,
        index: true,
      },
    });
  }
  if (!schema.path("branchId")) {
    schema.add({
      branchId: {
        type: Schema.Types.ObjectId,
        ref: "Branch",
        required: true,
        index: true,
      },
    });
  }

  const queryHooks = [
    "find",
    "findOne",
    "findOneAndUpdate",
    "findOneAndDelete",
    "findOneAndReplace",
    "countDocuments",
    "deleteMany",
    "deleteOne",
    "updateMany",
    "updateOne",
  ] as const;

  for (const hook of queryHooks) {
    schema.pre(hook, function () {
      const tenant = (this as unknown as { _tenant?: TenantIds })._tenant
        ?? (globalThis as unknown as { __tenant?: TenantIds }).__tenant;
      injectTenantFilter.call(this as never, tenant);
    });
  }

  schema.pre("aggregate", function () {
    const tenant =
      (this as unknown as { options?: { skipTenant?: boolean; tenant?: TenantIds } }).options
        ?.tenant ??
      (globalThis as unknown as { __tenant?: TenantIds }).__tenant;
    const skip =
      (this as unknown as { options?: { skipTenant?: boolean } }).options?.skipTenant;
    if (skip || !tenant) return;
    this.pipeline().unshift({
      $match: {
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      },
    });
  });
}

/** Bind tenant onto a model query chain helper. */
export function withTenant<T>(
  model: Model<T>,
  tenant: TenantIds
): Model<T> {
  (globalThis as unknown as { __tenant?: TenantIds }).__tenant = tenant;
  return model;
}

export function setRequestTenant(tenant: TenantIds | null) {
  (globalThis as unknown as { __tenant?: TenantIds | null }).__tenant = tenant;
}

export function clearRequestTenant() {
  (globalThis as unknown as { __tenant?: TenantIds | null }).__tenant = null;
}
