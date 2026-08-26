import { NextRequest, NextResponse } from "next/server";
import { getItemsForDigest, getItemsNext24Hours, tryClaimDigest } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email";
import { todayIstDateString } from "@/lib/time";

// Scheduled for 08:00 IST daily (see vercel.json — 02:30 UTC).
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayIstDateString();
  const claimed = await tryClaimDigest(today);
  if (!claimed) {
    return NextResponse.json({ ok: true, skipped: "already sent today" });
  }

  const todayItems = await getItemsForDigest();
  const isToday = todayItems.length > 0;
  const items = isToday ? todayItems : await getItemsNext24Hours();

  await sendDigestEmail(items, isToday);

  return NextResponse.json({ ok: true, count: items.length, isToday });
}
