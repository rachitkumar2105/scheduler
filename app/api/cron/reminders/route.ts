import { NextRequest, NextResponse } from "next/server";
import { getPendingReminderState, tryClaimReminder, deletePastItems } from "@/lib/db";
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

  const items = await getPendingReminderState();
  let sent = 0;

  for (const item of items) {
    if (item.pending.length === 0) continue;
    const remaining = item.remaining_minutes;

    // Every interval whose threshold has already been reached, whether it
    // crossed just now (normal case) or a while ago (item added with less
    // lead time than this slot, or a cron gap). At most ONE email per item
    // per run: the smallest crossed interval is the most relevant one right
    // now, and it absorbs every other crossed-but-unsent interval silently.
    const crossed = item.pending.filter((iv) => remaining <= iv);
    if (crossed.length === 0) continue;

    const pick = Math.min(...crossed);
    const claimed = await tryClaimReminder(item.id, pick);
    if (claimed) {
      // Close to its own exact mark -> use the clean label ("2h left").
      // Crossed well before this run -> report the real time left instead.
      const isFresh = pick - remaining <= WINDOW_MINUTES;
      await sendReminderEmail(item, pick, isFresh ? undefined : remaining);
      sent++;
    }

    for (const iv of crossed) {
      if (iv !== pick) await tryClaimReminder(item.id, iv);
    }
  }

  return NextResponse.json({ ok: true, sent, deleted });
}
