const IST_OFFSET_MINUTES = 5 * 60 + 30;

/**
 * Converts a "date" + "time" pair from an HTML form (interpreted as IST,
 * since the user is in India) into a UTC ISO string suitable for storing
 * in a `timestamptz` column.
 */
export function istInputsToUtcIso(dateStr: string, timeStr: string): string {
  // dateStr: "YYYY-MM-DD", timeStr: "HH:MM"
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute] = timeStr.split(":").map(Number);
  // Treat the given wall-clock time as IST, convert to UTC by subtracting the offset.
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - IST_OFFSET_MINUTES * 60 * 1000;
  return new Date(utcMs).toISOString();
}

/** Formats a UTC timestamp for display in IST, e.g. "Wed, 26 Aug 2026, 8:00 PM". */
export function formatIst(isoUtc: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(isoUtc));
}

/** Returns a UTC timestamp's date in IST as "YYYY-MM-DD". */
export function istDateString(isoUtc: string | Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(isoUtc));
  const y = parts.find((p) => p.type === "year")!.value;
  const m = parts.find((p) => p.type === "month")!.value;
  const d = parts.find((p) => p.type === "day")!.value;
  return `${y}-${m}-${d}`;
}

/** Returns today's date in IST as "YYYY-MM-DD", for digest de-duplication. */
export function todayIstDateString(): string {
  return istDateString(new Date());
}
