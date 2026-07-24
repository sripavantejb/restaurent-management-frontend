import { redirect } from "next/navigation";
import { connectDb } from "@/lib/db";
import { QRCode } from "@/models/QRCode";

export default async function ShortQrPage({
  params,
}: {
  params: Promise<{ shortCode: string }>;
}) {
  const { shortCode } = await params;
  await connectDb();
  const qr = await QRCode.findOne({ shortCode, isActive: true }).lean();
  if (!qr) {
    redirect("/t/invalid/invalid/invalid");
  }
  const base = process.env.APP_URL || "";
  const target = qr.targetUrl.startsWith("http")
    ? qr.targetUrl
    : `${base}${qr.targetUrl}`;
  // Prefer relative redirect when possible
  if (target.startsWith("http") && process.env.APP_URL) {
    const path = target.replace(process.env.APP_URL, "");
    redirect(path || target);
  }
  redirect(qr.targetUrl);
}
