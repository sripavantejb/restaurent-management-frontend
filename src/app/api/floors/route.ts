import { z } from "zod";
import { Floor } from "@/models/Floor";
import { Section } from "@/models/Section";
import { withAuth, json, error } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

const FloorSchema = z.object({
  name: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
});

const SectionSchemaBody = z.object({
  floorId: z.string().min(1),
  name: z.string().min(1),
  sortOrder: z.number().int().optional().default(0),
  color: z.string().optional().default("#2A9D8F"),
});

export const GET = withAuth(async ({ tenant }) => {
  const [floors, sections] = await Promise.all([
    Floor.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
    Section.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      isActive: true,
    })
      .sort({ sortOrder: 1, name: 1 })
      .lean(),
  ]);

  return json({
    floors: floors.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      sortOrder: f.sortOrder,
    })),
    sections: sections.map((s) => ({
      id: s._id.toString(),
      floorId: s.floorId.toString(),
      name: s.name,
      sortOrder: s.sortOrder,
      color: s.color,
    })),
  });
}, "tables.view");

export const POST = withAuth(async ({ req, tenant }) => {
  try {
    const body = await req.json();
    if (body.kind === "section") {
      const data = SectionSchemaBody.parse(body);
      const section = await Section.create({
        ...data,
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
      });
      await writeAudit({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        actorId: tenant.userId,
        actorType: "USER",
        action: "section.create",
        entityType: "Section",
        entityId: section._id.toString(),
        after: { name: section.name },
      });
      return json({ id: section._id.toString(), kind: "section" }, 201);
    }

    const data = FloorSchema.parse(body);
    const floor = await Floor.create({
      ...data,
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    });
    await writeAudit({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      actorId: tenant.userId,
      actorType: "USER",
      action: "floor.create",
      entityType: "Floor",
      entityId: floor._id.toString(),
      after: { name: floor.name },
    });
    return json({ id: floor._id.toString(), kind: "floor" }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid floor/section", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "tables.update");
