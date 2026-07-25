import { z } from "zod";
import { Types } from "mongoose";
import { withPlatformAuth, json, error, getParams } from "@/lib/api";
import { Restaurant } from "@/models/Restaurant";
import { PLANS, razorpayPlanId, type PlanId } from "@/lib/billing/plans";
import {
  createRazorpayCustomer,
  createRazorpaySubscription,
  publicKeyId,
  razorpayConfigured,
} from "@/lib/billing/razorpay";

const BodySchema = z.object({
  plan: z.enum(PLANS),
});

export const POST = withPlatformAuth(async ({ req }) => {
  const { id } = getParams(req);
  if (!id || !Types.ObjectId.isValid(id)) {
    return error("Invalid restaurant id", 400);
  }

  if (!razorpayConfigured()) {
    return error(
      "Razorpay not configured",
      503,
      "Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET, plus RAZORPAY_PLAN_* plan ids."
    );
  }

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid checkout payload", 400, err.errors[0]?.message);
    }
    throw err;
  }

  const planId = body.plan as PlanId;
  const rzPlan = razorpayPlanId(planId);
  if (!rzPlan) {
    return error(
      `Missing Razorpay plan for ${planId}`,
      503,
      `Set the env var for this plan (see .env.example).`
    );
  }

  const restaurant = await Restaurant.findById(id);
  if (!restaurant) return error("Restaurant not found", 404);

  try {
    let customerId = restaurant.razorpayCustomerId;
    if (!customerId) {
      const customer = await createRazorpayCustomer({
        name: restaurant.name,
        email: restaurant.contactEmail || `${restaurant.slug}@billing.local`,
        contact: restaurant.contactPhone || undefined,
        notes: {
          restaurantId: restaurant._id.toString(),
          slug: restaurant.slug,
        },
      });
      customerId = customer.id;
      restaurant.razorpayCustomerId = customerId;
    }

    const sub = await createRazorpaySubscription({
      planId: rzPlan,
      customerId,
      notes: {
        restaurantId: restaurant._id.toString(),
        plan: planId,
      },
    });

    restaurant.plan = planId;
    restaurant.razorpaySubscriptionId = sub.id;
    await restaurant.save();

    return json({
      subscriptionId: sub.id,
      shortUrl: sub.short_url,
      status: sub.status,
      keyId: publicKeyId(),
      plan: planId,
    });
  } catch (e) {
    return error(
      e instanceof Error ? e.message : "Checkout failed",
      502,
      "Check Razorpay credentials and plan ids in the Razorpay dashboard."
    );
  }
});
