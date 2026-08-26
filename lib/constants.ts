// Minutes-before-event values. Every item picks a subset of these.

/** Applied when the user doesn't customize reminders for an item. */
export const DEFAULT_REMINDER_INTERVALS = [1440, 720, 360, 120, 60, 30]; // 24h, 12h, 6h, 2h, 1h, 30m

/** Full menu available when the user customizes reminders (pick any/all of these 8). */
export const CUSTOM_REMINDER_OPTIONS = [2880, 1440, 720, 360, 180, 60, 30, 15]; // 48h..15m

export const INTERVAL_LABELS: Record<number, string> = {
  2880: "48h",
  1440: "24h",
  720: "12h",
  360: "6h",
  180: "3h",
  120: "2h",
  60: "1h",
  30: "30m",
  15: "15m",
};

export const PRIORITIES = ["low", "medium", "high"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

/** Higher weight pulls an item earlier in the suggested plan, deadline held equal. */
export const PRIORITY_WEIGHT: Record<Priority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};
