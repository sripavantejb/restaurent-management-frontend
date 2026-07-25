import { z } from "zod";
import { KitchenStation } from "@/models/KitchenStation";
import { withAuth, json, error } from "@/lib/api";

export const GET = withAuth(async ({ tenant }) => {
  const stations = await KitchenStation.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ name: 1 })
    .lean();

  return json({
    stations: stations.map((s) => ({
      id: s._id.toString(),
      name: s.name,
      code: s.code,
      isActive: s.isActive,
    })),
  });
}, "kds.view");

const Create = z.object({
  name: z.string().min(1).max(80),
  code: z.string().min(1).max(16),
});

export const POST = withAuth(async ({ req, tenant }) => {
  let body: z.infer<typeof Create>;
  try {
    body = Create.parse(await req.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid station", 400, err.errors[0]?.message);
    }
    throw err;
  }

  try {
    const s = await KitchenStation.create({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      name: body.name.trim(),
      code: body.code.trim().toUpperCase(),
      isActive: true,
    });
    return json(
      { id: s._id.toString(), name: s.name, code: s.code },
      201
    );
  } catch {
    return error("Station code already exists", 409);
  }
}, "menu.edit");
