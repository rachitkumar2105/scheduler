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

    // Crossed within this cron cadence — fires with its own exact label (e.g. "2h left").
    const fresh = item.pending.filter((iv) => remaining <= iv && remaining > iv - WINDOW_MINUTES);
    // Crossed a while ago — item was added with less lead time than this slot,
    // or a cron gap let it slip. Collapse into one accurate catch-up email
    // instead of staying silently unsent forever.
    const stale = item.pending.filter((iv) => remaining <= iv - WINDOW_MINUTES);

    for (const iv of fresh) {
      const claimed = await tryClaimReminder(item.id, iv);
      if (!claimed) continue;
      await sendReminderEmail(item, iv);
      sent++;
    }

    if (stale.length > 0) {
      const pick = Math.min(...stale);
      const claimed = await tryClaimReminder(item.id, pick);
      if (claimed) {
        await sendReminderEmail(item, pick, remaining);
        sent++;
      }
      // The rest are superseded by the single catch-up email above — claim
      // them silently so they don't each re-trigger their own catch-up.
      for (const iv of stale) {
        if (iv !== pick) await tryClaimReminder(item.id, iv);
      }
    }
  }

  return NextResponse.json({ ok: true, sent, deleted });
}
