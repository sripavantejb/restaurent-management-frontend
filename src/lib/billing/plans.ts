/** SaaS plan catalog — limits enforced in create APIs. */

export const PLANS = ["STARTER", "GROWTH", "ENTERPRISE"] as const;
export type PlanId = (typeof PLANS)[number];

export const BILLING_STATUSES = [
  "TRIAL",
  "ACTIVE",
  "PAST_DUE",
  "CANCELLED",
] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

export interface PlanLimits {
  maxBranches: number; // -1 = unlimited
  maxStaff: number;
  maxTables: number;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  description: string;
  priceLabel: string;
  monthlyPaise: number;
  limits: PlanLimits;
  /** Razorpay plan_id from dashboard; empty = checkout disabled until configured */
  envPlanKey: string;
}

export const PLAN_CATALOG: Record<PlanId, PlanDefinition> = {
  STARTER: {
    id: "STARTER",
    name: "Starter",
    description: "Single branch — ideal for one outlet getting started.",
    priceLabel: "₹1,999/mo",
    monthlyPaise: 199900,
    limits: { maxBranches: 1, maxStaff: 5, maxTables: 20 },
    envPlanKey: "RAZORPAY_PLAN_STARTER",
  },
  GROWTH: {
    id: "GROWTH",
    name: "Growth",
    description: "Multi-branch ops for growing restaurant groups.",
    priceLabel: "₹4,999/mo",
    monthlyPaise: 499900,
    limits: { maxBranches: 5, maxStaff: 25, maxTables: 100 },
    envPlanKey: "RAZORPAY_PLAN_GROWTH",
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    name: "Enterprise",
    description: "Unlimited branches, staff, and tables.",
    priceLabel: "₹12,999/mo",
    monthlyPaise: 1299900,
    limits: { maxBranches: -1, maxStaff: -1, maxTables: -1 },
    envPlanKey: "RAZORPAY_PLAN_ENTERPRISE",
  },
};

export function limitsForPlan(plan: string | undefined | null): PlanLimits {
  const id = (PLANS.includes(plan as PlanId) ? plan : "STARTER") as PlanId;
  return PLAN_CATALOG[id].limits;
}

export function razorpayPlanId(plan: PlanId): string | null {
  const key = PLAN_CATALOG[plan].envPlanKey;
  const id = process.env[key]?.trim();
  return id || null;
}

export function isUnlimited(n: number) {
  return n < 0;
}

/** Default trial length when admin creates a tenant without immediate checkout. */
export const TRIAL_DAYS = 14;

export function defaultTrialEndsAt(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}
