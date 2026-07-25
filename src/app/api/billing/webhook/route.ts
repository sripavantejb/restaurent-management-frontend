import { NextRequest, NextResponse } from "next/server";
import { connectDb } from "@/lib/db";
import { Restaurant } from "@/models/Restaurant";
import { verifyWebhookSignature } from "@/lib/billing/razorpay";
import type { PlanId } from "@/lib/billing/plans";
import { PLANS } from "@/lib/billing/plans";

export const runtime = "nodejs";

/**
 * Razorpay subscription webhooks.
 * Configure endpoint: POST /api/billing/webhook
 * Events: subscription.activated, subscription.charged, subscription.pending,
 * subscription.halted, subscription.cancelled, subscription.completed
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-razorpay-signature");

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let payload: {
    event?: string;
    payload?: {
      subscription?: {
        entity?: {
          id?: string;
          status?: string;
          current_end?: number;
          notes?: Record<string, string>;
        };
      };
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await connectDb();

  const entity = payload.payload?.subscription?.entity;
  const subId = entity?.id;
  if (!subId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const restaurant =
    (await Restaurant.findOne({ razorpaySubscriptionId: subId })) ||
    (entity?.notes?.restaurantId
      ? await Restaurant.findById(entity.notes.restaurantId)
      : null);

  if (!restaurant) {
    return NextResponse.json({ ok: true, missing: true });
  }

  const event = payload.event || "";
  const notePlan = entity?.notes?.plan;
  if (notePlan && PLANS.includes(notePlan as PlanId)) {
    restaurant.plan = notePlan as PlanId;
  }

  if (
    event === "subscription.activated" ||
    event === "subscription.charged" ||
    entity?.status === "active"
  ) {
    restaurant.billingStatus = "ACTIVE";
    restaurant.razorpaySubscriptionId = subId;
    if (entity?.current_end) {
      restaurant.currentPeriodEnd = new Date(entity.current_end * 1000);
    }
    restaurant.trialEndsAt = null;
  } else if (
    event === "subscription.pending" ||
    entity?.status === "pending"
  ) {
    restaurant.billingStatus = "PAST_DUE";
  } else if (
    event === "subscription.halted" ||
    event === "subscription.cancelled" ||
    event === "subscription.completed" ||
    entity?.status === "cancelled" ||
    entity?.status === "completed"
  ) {
    restaurant.billingStatus = "CANCELLED";
  }

  await restaurant.save();
  return NextResponse.json({ ok: true });
}
