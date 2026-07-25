import { Types } from "mongoose";
import { Branch } from "@/models/Branch";
import { User } from "@/models/User";
import { Table } from "@/models/Table";
import { Restaurant } from "@/models/Restaurant";
import {
  limitsForPlan,
  isUnlimited,
  type PlanLimits,
} from "@/lib/billing/plans";
import {
  resolveLimits,
  type LimitOverrides,
} from "@/lib/platform/modules";

export type LimitKind = "branches" | "staff" | "tables";

export async function getRestaurantLimits(
  restaurantId: Types.ObjectId | string
): Promise<{
  plan: string;
  limits: PlanLimits;
  billingStatus: string;
  limitOverrides: LimitOverrides;
}> {
  const r = await Restaurant.findById(restaurantId)
    .select("plan billingStatus limitOverrides")
    .lean<{
      plan?: string;
      billingStatus?: string;
      limitOverrides?: LimitOverrides;
    } | null>();
  const plan = r?.plan ?? "STARTER";
  const planLimits = limitsForPlan(plan);
  const limitOverrides = r?.limitOverrides ?? {};
  return {
    plan,
    billingStatus: r?.billingStatus ?? "TRIAL",
    limitOverrides,
    limits: resolveLimits(planLimits, limitOverrides),
  };
}

export async function assertWithinLimit(
  restaurantId: Types.ObjectId | string,
  kind: LimitKind
): Promise<{ ok: true } | { ok: false; message: string; hint: string }> {
  const { plan, limits } = await getRestaurantLimits(restaurantId);
  const rid =
    typeof restaurantId === "string"
      ? new Types.ObjectId(restaurantId)
      : restaurantId;

  if (kind === "branches") {
    if (isUnlimited(limits.maxBranches)) return { ok: true };
    const count = await Branch.countDocuments({ restaurantId: rid });
    if (count >= limits.maxBranches) {
      return {
        ok: false,
        message: `${plan} plan allows ${limits.maxBranches} branch(es)`,
        hint: "Ask the platform admin to upgrade this restaurant’s plan or raise the limit override.",
      };
    }
  }

  if (kind === "staff") {
    if (isUnlimited(limits.maxStaff)) return { ok: true };
    const count = await User.countDocuments({ restaurantId: rid });
    if (count >= limits.maxStaff) {
      return {
        ok: false,
        message: `${plan} plan allows ${limits.maxStaff} staff accounts`,
        hint: "Ask the platform admin to upgrade this restaurant’s plan or raise the limit override.",
      };
    }
  }

  if (kind === "tables") {
    if (isUnlimited(limits.maxTables)) return { ok: true };
    const count = await Table.countDocuments({ restaurantId: rid });
    if (count >= limits.maxTables) {
      return {
        ok: false,
        message: `${plan} plan allows ${limits.maxTables} tables`,
        hint: "Ask the platform admin to upgrade this restaurant’s plan or raise the limit override.",
      };
    }
  }

  return { ok: true };
}

/** Staff may use the product when trial/active (or past_due within grace). */
export function billingAllowsLogin(
  billingStatus: string | undefined | null,
  trialEndsAt?: Date | null
): { ok: true } | { ok: false; message: string; hint: string } {
  const status = billingStatus || "TRIAL";
  if (status === "CANCELLED") {
    return {
      ok: false,
      message: "Subscription cancelled",
      hint: "Contact RestaurantOS support or renew via the platform admin.",
    };
  }
  if (status === "TRIAL" && trialEndsAt && trialEndsAt.getTime() < Date.now()) {
    return {
      ok: false,
      message: "Trial expired",
      hint: "Ask the platform admin to start a Razorpay subscription for this restaurant.",
    };
  }
  return { ok: true };
}
