import { NextRequest, NextResponse } from "next/server";
import { getDueReminders, tryClaimReminder, deletePastItems } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email";

// Runs every 5 minutes via an external cron (see README — Vercel Hobby cron
// can't go below once/day). Matches a window slightly wider than the cron
// cadence so a slow/late invocation can't skip a reminder.
const WINDOW_MINUTES = 6;

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deleted = await deletePastItems();

  const due = await getDueReminders(WINDOW_MINUTES);
  let sent = 0;

  for (const item of due) {
    const claimed = await tryClaimReminder(item.id, item.interval_minutes);
    if (!claimed) continue; // already sent for this item+interval
    await sendReminderEmail(item, item.interval_minutes);
    sent++;
  }

  return NextResponse.json({ ok: true, sent, deleted });
}
