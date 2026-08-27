import { Resend } from "resend";
import { formatIst } from "./time";
import { craftReminderBody, craftDigestSummary } from "./groq";
import { INTERVAL_LABELS, PRIORITY_LABELS } from "./constants";
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
        <p style="color: #666; font-size: 14px;">📅 ${escapeHtml(when)}</p>
      </div>
    `,
  });
}

function renderDigestList(items: DigestItem[]): string {
  return `<ul style="padding-left: 20px; margin: 8px 0;">${items
    .map(
      (i) =>
        `<li style="margin-bottom: 8px;"><strong>${escapeHtml(i.title)}</strong> <span style="color: #888; font-size: 12px;">(${PRIORITY_LABELS[i.priority]})</span><br/>${escapeHtml(
          formatIst(i.event_datetime)
        )} IST</li>`
    )
    .join("")}</ul>`;
}

export async function sendDigestEmail(todayItems: DigestItem[], upcoming48hItems: DigestItem[]) {
  const totalCount = todayItems.length + upcoming48hItems.length;

  const subject =
    todayItems.length > 0
      ? `Today: ${todayItems.length} task${todayItems.length > 1 ? "s" : ""}, ${upcoming48hItems.length} coming up`
      : totalCount === 0
      ? "Nothing due — clear day"
      : `Nothing today — ${upcoming48hItems.length} coming up in 48h`;

  let summary: string | null = null;
  if (totalCount > 0) {
    const summaryPrompt =
      `Today: ${todayItems.map((i) => `"${i.title}" (${PRIORITY_LABELS[i.priority]} priority, ${formatIst(i.event_datetime)})`).join("; ") || "nothing"}. ` +
      `Next 48h: ${upcoming48hItems.map((i) => `"${i.title}" (${PRIORITY_LABELS[i.priority]} priority)`).join("; ") || "nothing"}.`;
    summary = await craftDigestSummary(summaryPrompt);
  }

  const todaySection =
    todayItems.length > 0
      ? `<h3 style="margin: 20px 0 4px;">Today</h3>${renderDigestList(todayItems)}`
      : `<h3 style="margin: 20px 0 4px;">Today</h3><p style="color: #888;">Nothing scheduled today.</p>`;

  const upcomingSection =
    upcoming48hItems.length > 0
      ? `<h3 style="margin: 20px 0 4px;">Next 48 hours</h3>${renderDigestList(upcoming48hItems)}`
      : `<h3 style="margin: 20px 0 4px;">Next 48 hours</h3><p style="color: #888;">Nothing else coming up.</p>`;

  await resend.emails.send({
    from: FROM,
    to: TO,
    subject,
    html: `
      <div style="font-family: sans-serif; font-size: 16px; line-height: 1.5;">
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
        ${todaySection}
        ${upcomingSection}
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
