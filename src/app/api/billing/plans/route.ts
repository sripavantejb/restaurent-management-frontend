import { NextResponse } from "next/server";
import { PLAN_CATALOG, PLANS } from "@/lib/billing/plans";
import { razorpayConfigured } from "@/lib/billing/razorpay";

/** Public plan catalog for admin UI (no secrets). */
export async function GET() {
  return NextResponse.json({
    razorpayConfigured: razorpayConfigured(),
    plans: PLANS.map((id) => {
      const p = PLAN_CATALOG[id];
      return {
        id: p.id,
        name: p.name,
        description: p.description,
        priceLabel: p.priceLabel,
        monthlyPaise: p.monthlyPaise,
        limits: p.limits,
        razorpayPlanConfigured: !!(
          process.env[p.envPlanKey]?.trim()
        ),
      };
    }),
  });
}
