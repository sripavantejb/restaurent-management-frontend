import { QRCode } from "@/models/QRCode";
import { withGuest, guestError, guestJson, clientIp } from "@/lib/guest-api";
import { hashDevice } from "@/lib/qr-crypto";
import { QRScan } from "@/models/QRScan";

export const GET = withGuest(async (req, { params }) => {
  const shortCode = params.shortCode;
  if (!shortCode) return guestError("Missing code", 404);

  const qr = await QRCode.findOne({ shortCode, isActive: true });
  if (!qr) {
    return guestError(
      "This code is out of date",
      404,
      "Please ask your server for a new one."
    );
  }

  const ua = req.headers.get("user-agent") || "";
  const deviceHash = hashDevice(ua, clientIp(req));
  const prior = await QRScan.findOne({
    qrCodeId: qr._id,
    deviceHash,
  }).select("_id");

  await QRScan.create({
    restaurantId: qr.restaurantId,
    branchId: qr.branchId,
    qrCodeId: qr._id,
    deviceHash,
    scannedAt: new Date(),
    convertedToOrder: false,
    isReturningDevice: !!prior,
  });

  qr.scanCount += 1;
  if (!prior) qr.uniqueScanCount += 1;
  qr.lastScannedAt = new Date();
  await qr.save();

  const base = process.env.APP_URL || req.nextUrl.origin;
  const target = qr.targetUrl.startsWith("http")
    ? qr.targetUrl
    : `${base}${qr.targetUrl}`;

  return guestJson({ redirectTo: target, shortCode: qr.shortCode });
});
