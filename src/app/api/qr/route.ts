import QRCodeLib from "qrcode";
import { z } from "zod";
import { Restaurant } from "@/models/Restaurant";
import { Branch } from "@/models/Branch";
import { Table, type ITable } from "@/models/Table";
import { QRCode, type IQRCode } from "@/models/QRCode";
import { QRScan } from "@/models/QRScan";
import { withAuth, json, error } from "@/lib/api";
import { tableQrToken, contrastRatio } from "@/lib/qr-crypto";
import { randomBase62 } from "@/lib/base62";

function appUrl() {
  return process.env.APP_URL || "http://localhost:3000";
}

export const GET = withAuth(async ({ tenant, req }) => {
  const url = new URL(req.url);
  const analytics = url.searchParams.get("analytics");

  const codes = (await QRCode.find({
    restaurantId: tenant.restaurantId,
    branchId: tenant.branchId,
  })
    .sort({ createdAt: -1 })
    .lean()) as unknown as IQRCode[];

  if (analytics === "1") {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const scans = await QRScan.find({
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
      scannedAt: { $gte: since },
    }).lean();

    const byDay: Record<string, number> = {};
    let converted = 0;
    let latencySum = 0;
    let latencyN = 0;
    for (const s of scans) {
      const day = new Date(s.scannedAt).toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
      if (s.convertedToOrder) converted += 1;
      if (s.firstItemAt) {
        latencySum +=
          new Date(s.firstItemAt).getTime() - new Date(s.scannedAt).getTime();
        latencyN += 1;
      }
    }

    const zeroScan = codes.filter(
      (c) => !c.lastScannedAt || new Date(c.lastScannedAt) < since
    );

    return json({
      scansPerDay: byDay,
      conversionRate: scans.length
        ? Math.round((converted / scans.length) * 1000) / 10
        : 0,
      avgScanToItemMs: latencyN ? Math.round(latencySum / latencyN) : null,
      zeroScanTables: zeroScan.map((c) => ({
        id: c._id.toString(),
        label: c.label,
        tableId: c.tableId?.toString(),
      })),
      totalScans: scans.length,
    });
  }

  return json({
    codes: codes.map((c) => ({
      id: c._id.toString(),
      shortCode: c.shortCode,
      type: c.type,
      tableId: c.tableId?.toString() ?? null,
      label: c.label,
      isActive: c.isActive,
      scanCount: c.scanCount,
      uniqueScanCount: c.uniqueScanCount,
      lastScannedAt: c.lastScannedAt,
      targetUrl: c.targetUrl,
      token: c.token,
      secretVersion: c.secretVersion,
      shortUrl: `${appUrl()}/q/${c.shortCode}`,
      wifiSsid: c.wifiSsid,
      wifiPassword: c.wifiPassword,
    })),
  });
}, "qr.manage");

const GenerateSchema = z.object({
  tableIds: z.array(z.string()).min(1),
  designId: z.string().optional().default("classic"),
  fg: z.string().optional().default("#12100E"),
  bg: z.string().optional().default("#FFFFFF"),
  printSizeCm: z.number().optional().default(4),
  includeWifi: z.boolean().optional().default(false),
});

export const POST = withAuth(async ({ req, tenant, user }) => {
  try {
    const body = GenerateSchema.parse(await req.json());
    const ratio = contrastRatio(body.fg, body.bg);
    if (ratio < 4) {
      return error(
        `Contrast ${ratio.toFixed(2)}:1 is below 4:1`,
        400,
        "Use dark-on-light colours so older phone cameras can read the code."
      );
    }
    if (body.fg.toUpperCase() === "#FFFFFF" || parseInt(body.fg.slice(1, 3), 16) > 200) {
      return error(
        "Inverted (light-on-dark) codes are not allowed",
        400,
        "Use dark foreground on a light background."
      );
    }

    const warnings: string[] = [];
    if (body.printSizeCm < 2.5) {
      warnings.push("Print size under 2.5cm — too small for a sticker.");
    } else if (body.printSizeCm < 4) {
      warnings.push("Under 4cm — fine for stickers, tight for tent cards.");
    }

    const restaurant = await Restaurant.findById(tenant.restaurantId);
    const branch = await Branch.findById(tenant.branchId);
    if (!restaurant || !branch) return error("Restaurant/branch missing", 500);

    const tables = (await Table.find({
      _id: { $in: body.tableIds },
      restaurantId: tenant.restaurantId,
      branchId: tenant.branchId,
    }).lean()) as unknown as ITable[];

    if (tables.length !== body.tableIds.length) {
      return error("Some tables were not found on this branch", 404);
    }

    const created = [];
    for (const table of tables) {
      // Deactivate old codes for this table
      await QRCode.updateMany(
        {
          restaurantId: tenant.restaurantId,
          branchId: tenant.branchId,
          tableId: table._id,
          isActive: true,
        },
        { $set: { isActive: false } }
      );

      const version = restaurant.qrSecretVersion || 1;
      const token = tableQrToken({
        restaurantId: restaurant._id.toString(),
        branchId: branch._id.toString(),
        tableId: table._id.toString(),
        secretVersion: version,
      });
      const shortCode = randomBase62(7);
      const targetUrl = `/t/${restaurant.slug}/${branch.code}/${token}?v=${version}`;

      const doc = await QRCode.create({
        restaurantId: tenant.restaurantId,
        branchId: tenant.branchId,
        shortCode,
        type: "TABLE",
        tableId: table._id,
        targetUrl,
        token,
        secretVersion: version,
        label: `Table ${table.number}`,
        isActive: true,
        designId: body.designId,
        createdBy: tenant.userId,
        wifiSsid: body.includeWifi ? restaurant.wifiSsid : "",
        wifiPassword: body.includeWifi ? restaurant.wifiPassword : "",
      });

      const svg = await QRCodeLib.toString(`${appUrl()}/q/${shortCode}`, {
        type: "svg",
        errorCorrectionLevel: "H",
        margin: 4,
        color: { dark: body.fg, light: body.bg },
        width: 512,
      });

      created.push({
        id: doc._id.toString(),
        shortCode,
        label: doc.label,
        shortUrl: `${appUrl()}/q/${shortCode}`,
        targetUrl,
        tableNumber: table.number,
        svg,
      });
    }

    return json({ created, warnings }, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error("Invalid generate payload", 400, err.errors[0]?.message);
    }
    throw err;
  }
}, "qr.manage");

const RotateSchema = z.object({
  confirm: z.literal("ROTATE"),
});

export const PATCH = withAuth(async ({ req, tenant, user }) => {
  try {
    RotateSchema.parse(await req.json());
    const restaurant = await Restaurant.findById(tenant.restaurantId);
    if (!restaurant) return error("Restaurant not found", 404);

    const activeCount = await QRCode.countDocuments({
      restaurantId: tenant.restaurantId,
      isActive: true,
    });

    restaurant.qrPreviousVersion = restaurant.qrSecretVersion || 1;
    restaurant.qrSecretVersion = (restaurant.qrSecretVersion || 1) + 1;
    restaurant.qrRotatedAt = new Date();
    await restaurant.save();

    console.info(
      `[QR_ROTATE] user=${user.userId} restaurant=${tenant.restaurantId} affected=${activeCount} at=${new Date().toISOString()}`
    );

    return json({
      ok: true,
      newVersion: restaurant.qrSecretVersion,
      affectedActiveCodes: activeCount,
      message:
        "Secret rotated. Regenerate and reprint codes. Old codes work for 30 days.",
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return error(
        'Type ROTATE to confirm',
        400,
        "Rotation reprints every table code — confirm carefully."
      );
    }
    throw err;
  }
}, "qr.manage");
