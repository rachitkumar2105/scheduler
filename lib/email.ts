import { Resend } from "resend";
import { formatIst } from "./time";
import { craftReminderBody } from "./groq";
import { INTERVAL_LABELS } from "./constants";
import type { DigestItem } from "./db";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.REMINDER_FROM_EMAIL || "Schedule Reminder <onboarding@resend.dev>";
const TO = process.env.REMINDER_TO_EMAIL!;

/**
 * The subject always uses the item's exact title — never AI-paraphrased —
 * so a glance at the inbox tells you exactly what's due and how soon.
 * e.g. "Google Form — 2h left! Hurry." / "DBMS Exam — 24h left"
 */
function buildSubject(title: string, intervalMinutes: number): string {
  const label = INTERVAL_LABELS[intervalMinutes] ?? `${intervalMinutes}m`;
  return intervalMinutes <= 60 ? `${title} — ${label} left! Hurry.` : `${title} — ${label} left`;
}

export async function sendReminderEmail(item: { title: string; event_datetime: string }, intervalMinutes: number) {
  const label = INTERVAL_LABELS[intervalMinutes] ?? `${intervalMinutes}m`;
  const when = `${formatIst(item.event_datetime)} IST`;
  const subject = buildSubject(item.title, intervalMinutes);

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
