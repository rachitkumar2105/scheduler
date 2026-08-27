import { Resend } from "resend";
import { formatIst } from "./time";
import { craftReminderBody } from "./groq";
import { INTERVAL_LABELS } from "./constants";
import type { DigestItem } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.REMINDER_FROM_EMAIL || "Schedule Reminder <onboarding@resend.dev>";
const TO = process.env.REMINDER_TO_EMAIL!;

/** e.g. 305 minutes -> "5h 5m"; whole hours drop the minutes. */
function formatMinutesLabel(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm}m`;
  if (mm === 0) return `${h}h`;
  return `${h}h ${mm}m`;
}

/**
 * The subject always uses the item's exact title — never AI-paraphrased —
 * so a glance at the inbox tells you exactly what's due and how soon.
 * e.g. "Google Form — 2h left! Hurry." / "DBMS Exam — 24h left"
 */
function buildSubject(title: string, minutesLeft: number, label: string): string {
  return minutesLeft <= 60 ? `${title} — ${label} left! Hurry.` : `${title} — ${label} left`;
}

/**
 * intervalMinutes is always the reminder slot being claimed (for de-dup).
 * When catchUpRemainingMinutes is set, this slot's own threshold was already
 * crossed before the cron caught it (item added with less lead time than
 * this interval, or a cron gap) — the email reports the real time left
 * instead of falsely claiming the stale interval's label.
 */
export async function sendReminderEmail(
  item: { title: string; event_datetime: string },
  intervalMinutes: number,
  catchUpRemainingMinutes?: number
) {
  const isCatchUp = catchUpRemainingMinutes !== undefined;
  const minutesLeft = isCatchUp ? catchUpRemainingMinutes! : intervalMinutes;
  const label = isCatchUp ? formatMinutesLabel(minutesLeft) : INTERVAL_LABELS[intervalMinutes] ?? `${intervalMinutes}m`;
  const when = `${formatIst(item.event_datetime)} IST`;
  const subject = buildSubject(item.title, minutesLeft, label);

  const aiBody = await craftReminderBody(`Event "${item.title}" starts in ${label}, at ${when}.`);
  const bodyLine = aiBody || `Happening in ${label} — at ${when}.`;

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    html: `
      <div style="font-family: sans-serif; font-size: 16px; line-height: 1.5;">
        <p><strong>${escapeHtml(item.title)}</strong></p>
        <p>${escapeHtml(bodyLine)}</p>
      </div>
    `,
  });
}

export async function sendDigestEmail(items: DigestItem[], isToday: boolean) {
  const heading = isToday ? "Today's schedule" : "Nothing today — here's what's coming up next";
  const body =
    items.length === 0
      ? "<p>Nothing scheduled. Enjoy the free time.</p>"
      : `<ul style="padding-left: 20px;">${items
          .map(
            (i) =>
              `<li style="margin-bottom: 8px;"><strong>${escapeHtml(i.title)}</strong><br/>${formatIst(
                i.event_datetime
              )} IST</li>`
          )
          .join("")}</ul>`;

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject: isToday ? "Today's schedule" : "Nothing today — here's what's next",
    html: `
      <div style="font-family: sans-serif; font-size: 16px; line-height: 1.5;">
        <p><strong>${heading}</strong></p>
        ${body}
      </div>
    `,
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
