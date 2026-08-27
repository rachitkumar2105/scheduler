import { NextRequest, NextResponse } from "next/server";
import { getTodayDigestItems, getUpcoming48hDigestItems, tryClaimDigest } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email";
import { todayIstDateString } from "@/lib/time";

// Scheduled for 09:00 IST daily (see vercel.json — 03:30 UTC).
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

  const [todayItems, upcoming48hItems] = await Promise.all([getTodayDigestItems(), getUpcoming48hDigestItems()]);

  await sendDigestEmail(todayItems, upcoming48hItems);

  return NextResponse.json({ ok: true, todayCount: todayItems.length, upcoming48hCount: upcoming48hItems.length });
}
