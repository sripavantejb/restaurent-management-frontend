import { z } from "zod";
import { AiConversation } from "@/models/AiConversation";
import { AiMessage } from "@/models/AiMessage";
import { withAuth, json, error, getParams } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing id", 400);

  const conv = await AiConversation.findOne({
    _id: id,
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
  }).lean();
  if (!conv) return error("Not found", 404);

  const messages = await AiMessage.find({
    conversationId: conv._id,
    restaurantId: tenant.restaurantId,
    role: { $in: ["user", "assistant"] },
  })
    .sort({ createdAt: 1 })
    .limit(200)
    .lean();

  return json({
    conversation: {
      id: conv._id.toString(),
      title: conv.title,
      pinned: conv.pinned,
    },
    messages: messages.map((m) => ({
      id: m._id.toString(),
      role: m.role,
      content: m.content,
      blocks: m.blocks ?? [],
      createdAt: m.createdAt,
    })),
  });
}, "ai.use");

const PatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  archive: z.boolean().optional(),
});

export const PATCH = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing id", 400);
  try {
    const body = PatchSchema.parse(await req.json());
    const set: Record<string, unknown> = {};
    if (body.title !== undefined) set.title = body.title;
    if (body.pinned !== undefined) set.pinned = body.pinned;
    if (body.archive) set.archivedAt = new Date();

    const conv = await AiConversation.findOneAndUpdate(
      {
        _id: id,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        userId: tenant.userId,
      },
      { $set: set },
      { new: true }
    );
    if (!conv) return error("Not found", 404);
    return json({
      id: conv._id.toString(),
      title: conv.title,
      pinned: conv.pinned,
    });
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "ai.use");

export const DELETE = withAuth(async ({ req, tenant }) => {
  const { id } = getParams(req);
  if (!id) return error("Missing id", 400);
  const conv = await AiConversation.findOneAndUpdate(
    {
      _id: id,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      userId: tenant.userId,
    },
    { $set: { archivedAt: new Date() } }
  );
  if (!conv) return error("Not found", 404);
  return json({ ok: true });
}, "ai.use");
