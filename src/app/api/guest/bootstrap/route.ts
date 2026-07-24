import { Types } from "mongoose";
import { Restaurant, type IRestaurant } from "@/models/Restaurant";
import { Branch, type IBranch } from "@/models/Branch";
import { Table, type ITable } from "@/models/Table";
import { TableSession, type ITableSession } from "@/models/TableSession";
import { MenuCategory } from "@/models/MenuCategory";
import { MenuItem } from "@/models/MenuItem";
import { Order } from "@/models/Order";
import { withGuest, guestError, guestJson, clientIp } from "@/lib/guest-api";
import { verifyTableQrToken, hashDevice } from "@/lib/qr-crypto";
import { recomputeSessionTotals } from "@/lib/session";

export const GET = withGuest(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug") || "";
  const branchCode = url.searchParams.get("branch") || "";
  const token = url.searchParams.get("token") || "";

  if (!slug || !branchCode || !token) {
    return guestError(
      "This code is out of date",
      400,
      "Please ask your server for a new one."
    );
  }

  const restaurant = (await Restaurant.findOne({ slug }).lean()) as
    | (IRestaurant & { _id: Types.ObjectId })
    | null;
  if (!restaurant) {
    return guestError(
      "This code is out of date",
      404,
      "Please ask your server for a new one."
    );
  }

  const branch = (await Branch.findOne({
    restaurantId: restaurant._id,
    code: branchCode,
    isActive: true,
  }).lean()) as (IBranch & { _id: Types.ObjectId }) | null;
  if (!branch) {
    return guestError(
      "This code is out of date",
      404,
      "Please ask your server for a new one."
    );
  }

  const tables = (await Table.find({
    restaurantId: restaurant._id,
    branchId: branch._id,
  }).lean()) as unknown as ITable[];

  let table = null as ITable | null;
  let matchedVersion: number | null = null;
  for (const t of tables) {
    const check = verifyTableQrToken({
      restaurantId: restaurant._id.toString(),
      branchId: branch._id.toString(),
      tableId: t._id.toString(),
      token,
      secretVersion: restaurant.qrSecretVersion ?? 1,
      previousVersion: restaurant.qrPreviousVersion,
      previousRotatedAt: restaurant.qrRotatedAt,
    });
    if (check.ok) {
      const expectedOk = verifyTableQrToken({
        restaurantId: restaurant._id.toString(),
        branchId: branch._id.toString(),
        tableId: t._id.toString(),
        token,
        secretVersion: check.matchedVersion!,
      });
      if (expectedOk.ok) {
        table = t;
        matchedVersion = check.matchedVersion!;
        break;
      }
    }
  }

  if (!table || matchedVersion == null) {
    return guestError(
      "This code is out of date",
      403,
      "Please ask your server for a new one."
    );
  }

  let openSession = null as (ITableSession & { _id: Types.ObjectId }) | null;
  if (table.currentSessionId) {
    openSession = (await TableSession.findOne({
      _id: table.currentSessionId,
      restaurantId: restaurant._id,
      branchId: branch._id,
      status: { $in: ["OPEN", "BILL_REQUESTED"] },
    }).lean()) as (ITableSession & { _id: Types.ObjectId }) | null;
  }
  if (!openSession) {
    openSession = (await TableSession.findOne({
      restaurantId: restaurant._id,
      branchId: branch._id,
      tableIds: table._id,
      status: { $in: ["OPEN", "BILL_REQUESTED"] },
    }).lean()) as (ITableSession & { _id: Types.ObjectId }) | null;
  }

  if (openSession) {
    await recomputeSessionTotals(openSession._id);
    openSession = (await TableSession.findById(openSession._id).lean()) as
      | (ITableSession & { _id: Types.ObjectId })
      | null;
  }

  const [categories, items, bestsellers] = await Promise.all([
    MenuCategory.find({
      restaurantId: restaurant._id,
      branchId: branch._id,
    })
      .sort({ sortOrder: 1 })
      .lean(),
    MenuItem.find({
      restaurantId: restaurant._id,
      branchId: branch._id,
    })
      .sort({ name: 1 })
      .lean(),
    Order.aggregate([
      {
        $match: {
          restaurantId: restaurant._id,
          branchId: branch._id,
          status: { $in: ["COMPLETED", "SERVED", "READY", "PREPARING", "PLACED"] },
          placedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          qty: { $sum: "$items.qty" },
        },
      },
      { $sort: { qty: -1 } },
      { $limit: 8 },
    ]),
  ]);

  const bestsellerNames = new Set(
    bestsellers.map((b: { _id: string }) => b._id)
  );

  const ua = req.headers.get("user-agent") || "";
  const deviceHash = hashDevice(ua, clientIp(req));

  return guestJson({
    restaurant: {
      id: restaurant._id.toString(),
      name: restaurant.name,
      slug: restaurant.slug,
      logoUrl: restaurant.logoUrl,
      currency: restaurant.currency,
      approvalMode: restaurant.qrApprovalMode,
      qrOrderingEnabled: restaurant.qrOrderingEnabled !== false,
      maxOrderPaise: restaurant.maxGuestOrderPaise,
      wifiSsid: restaurant.wifiSsid,
      menuVersion: restaurant.menuVersion || "1",
    },
    branch: {
      id: branch._id.toString(),
      name: branch.name,
      code: branch.code,
    },
    table: {
      id: table._id.toString(),
      number: table.number,
      status: table.status,
    },
    tokenValid: true,
    secretVersion: matchedVersion,
    deviceHash,
    openSession: openSession
      ? {
          id: openSession._id.toString(),
          sessionNumber: openSession.sessionNumber,
          status: openSession.status,
          guestCount: openSession.guestCount,
          rounds: openSession.rounds,
          total: openSession.total,
          dueAmount: openSession.dueAmount,
        }
      : null,
    categories: (
      categories as unknown as { _id: Types.ObjectId; name: string }[]
    ).map((c) => ({
      id: c._id.toString(),
      name: c.name,
    })),
    items: (
      items as unknown as {
        _id: Types.ObjectId;
        categoryId: Types.ObjectId;
        name: string;
        description: string;
        price: number;
        imageUrl?: string;
        isVeg: boolean;
        isEgg?: boolean;
        prepTimeMins: number;
        isAvailable: boolean;
        spiceLevel?: number;
        allergens?: string[];
        tags?: string[];
        calories?: number;
        repeatRate?: number;
        variants: { name: string; priceDelta: number }[];
        addons: { name: string; price: number }[];
      }[]
    ).map((i) => ({
      id: i._id.toString(),
      categoryId: i.categoryId.toString(),
      name: i.name,
      description: i.description,
      price: i.price,
      imageUrl: i.imageUrl,
      isVeg: i.isVeg,
      isEgg: i.isEgg ?? false,
      prepTimeMins: i.prepTimeMins,
      isAvailable: i.isAvailable,
      spiceLevel: i.spiceLevel ?? 0,
      allergens: i.allergens ?? [],
      tags: i.tags ?? [],
      calories: i.calories ?? 0,
      repeatRate: i.repeatRate ?? 0,
      variants: i.variants,
      addons: i.addons,
      bestseller: bestsellerNames.has(i.name),
      mostOrderedToday: bestsellerNames.has(i.name),
    })),
  });
});
