import { z } from "zod";
import { AiConversation } from "@/models/AiConversation";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ req, tenant }) => {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const filter: Record<string, unknown> = {
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
    userId: tenant.userId,
    archivedAt: null,
  };
  if (q) filter.title = { $regex: q, $options: "i" };

  const items = await AiConversation.find(filter)
    .sort({ pinned: -1, lastMessageAt: -1 })
    .limit(50)
    .lean();

  return json({
    conversations: items.map((c) => ({
      id: c._id.toString(),
      title: c.title,
      pinned: c.pinned,
      lastMessageAt: c.lastMessageAt,
    })),
  });
}, "ai.use");

const CreateSchema = z.object({
  title: z.string().min(1).max(120).optional(),
});

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = CreateSchema.parse(await req.json().catch(() => ({})));
    const c = await AiConversation.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      userId: tenant.userId,
      title: body.title || "New chat",
      lastMessageAt: new Date(),
    });
    return json({ id: c._id.toString(), title: c.title }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return error("Invalid", 400);
    throw err;
  }
}, "ai.use");
