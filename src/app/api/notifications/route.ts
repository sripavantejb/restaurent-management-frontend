import { z } from "zod";
import { Notification } from "@/models/Notification";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant, user }) => {
  const items = await Notification.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    $or: [{ userId: tenant.userId }, { userId: null, role: user.role }, { userId: null, role: null }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  return json({
    notifications: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      readAt: n.readAt,
      createdAt: n.createdAt,
    })),
    unread: items.filter((n) => !n.readAt).length,
  });
});

const MarkSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  try {
    const body = MarkSchema.parse(await req.json());
    if (body.all) {
      await Notification.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          userId: tenant.userId,
          readAt: null,
        },
        { $set: { readAt: new Date() } }
      );
    } else if (body.ids?.length) {
      await Notification.updateMany(
        {
          _id: { $in: body.ids },
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
        },
        { $set: { readAt: new Date() } }
      );
    }
    return json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid request", 400);
    }
    throw err;
  }
});
