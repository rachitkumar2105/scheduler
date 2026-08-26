import { neon } from "@neondatabase/serverless";
import type { Priority } from "./constants";

export const sql = neon(process.env.DATABASE_URL!);

export type ScheduleItem = {
  id: number;
  title: string;
  event_datetime: string; // ISO string, UTC
  created_at: string;
  reminder_intervals: number[];
  sent_intervals: number[];
  priority: Priority;
};

export type DigestItem = {
  id: number;
  title: string;
  event_datetime: string;
};

export async function listUpcomingItems(): Promise<ScheduleItem[]> {
  const rows = await sql`
    SELECT
      si.id, si.title, si.event_datetime, si.created_at, si.reminder_intervals, si.priority,
      COALESCE(
        (SELECT array_agg(rl.interval_minutes ORDER BY rl.interval_minutes)
         FROM reminder_log rl WHERE rl.item_id = si.id),
        '{}'
      ) AS sent_intervals
    FROM schedule_items si
    WHERE si.event_datetime > now()
    ORDER BY si.event_datetime ASC
  `;
  return rows as ScheduleItem[];
}

export async function createItem(
  title: string,
  eventDatetimeUtc: string,
  reminderIntervals: number[],
  priority: Priority
): Promise<ScheduleItem> {
  const rows = await sql`
    INSERT INTO schedule_items (title, event_datetime, reminder_intervals, priority)
    VALUES (${title}, ${eventDatetimeUtc}, ${reminderIntervals}::int[], ${priority})
    RETURNING id, title, event_datetime, created_at, reminder_intervals, priority
  `;
  return { ...(rows[0] as Omit<ScheduleItem, "sent_intervals">), sent_intervals: [] };
}

export async function deleteItem(id: number): Promise<void> {
  await sql`DELETE FROM schedule_items WHERE id = ${id}`;
}

export async function updateItemPriority(id: number, priority: Priority): Promise<void> {
  await sql`UPDATE schedule_items SET priority = ${priority} WHERE id = ${id}`;
}

/** Removes events that finished a while ago. reminder_log rows cascade-delete with them. */
export async function deletePastItems(): Promise<number> {
  const rows = await sql`
    DELETE FROM schedule_items
    WHERE event_datetime < now() - interval '1 hour'
    RETURNING id
  `;
  return rows.length;
}

export type DueReminder = { id: number; title: string; event_datetime: string; interval_minutes: number };

export async function getDueReminders(windowMinutes: number): Promise<DueReminder[]> {
  const rows = await sql`
    SELECT si.id, si.title, si.event_datetime, iv AS interval_minutes
    FROM schedule_items si, unnest(si.reminder_intervals) AS iv
    WHERE si.event_datetime > now()
      AND si.event_datetime <= now() + (iv * interval '1 minute')
      AND si.event_datetime > now() + ((iv - ${windowMinutes}::int) * interval '1 minute')
      AND NOT EXISTS (
        SELECT 1 FROM reminder_log rl WHERE rl.item_id = si.id AND rl.interval_minutes = iv
      )
  `;
  return rows as DueReminder[];
}

export async function tryClaimReminder(itemId: number, intervalMinutes: number): Promise<boolean> {
  const rows = await sql`
    INSERT INTO reminder_log (item_id, interval_minutes)
    VALUES (${itemId}, ${intervalMinutes})
    ON CONFLICT (item_id, interval_minutes) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}

export async function getItemsForDigest(): Promise<DigestItem[]> {
  const rows = await sql`
    SELECT id, title, event_datetime
    FROM schedule_items
    WHERE event_datetime >= date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') AT TIME ZONE 'Asia/Kolkata'
      AND event_datetime < (date_trunc('day', now() AT TIME ZONE 'Asia/Kolkata') + interval '1 day') AT TIME ZONE 'Asia/Kolkata'
    ORDER BY event_datetime ASC
  `;
  return rows as DigestItem[];
}

export async function getItemsNext24Hours(): Promise<DigestItem[]> {
  const rows = await sql`
    SELECT id, title, event_datetime
    FROM schedule_items
    WHERE event_datetime >= now()
      AND event_datetime < now() + interval '24 hours'
    ORDER BY event_datetime ASC
  `;
  return rows as DigestItem[];
}

export async function tryClaimDigest(digestDate: string): Promise<boolean> {
  const rows = await sql`
    INSERT INTO digest_log (digest_date)
    VALUES (${digestDate})
    ON CONFLICT (digest_date) DO NOTHING
    RETURNING id
  `;
  return rows.length > 0;
}
