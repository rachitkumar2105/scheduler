import { NextRequest, NextResponse } from "next/server";
import { createItem, listUpcomingItems } from "@/lib/db";
import { istInputsToUtcIso } from "@/lib/time";
import { DEFAULT_REMINDER_INTERVALS, CUSTOM_REMINDER_OPTIONS } from "@/lib/constants";

export async function GET() {
  const items = await listUpcomingItems();
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { title, date, time, mode, intervals } = await req.json();

  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!date || !time) {
    return NextResponse.json({ error: "Date and time are required" }, { status: 400 });
  }

  let reminderIntervals: number[];
  if (mode === "custom") {
    if (!Array.isArray(intervals) || intervals.length === 0) {
      return NextResponse.json({ error: "Pick at least one reminder interval" }, { status: 400 });
    }
    const invalid = intervals.some((i: unknown) => !CUSTOM_REMINDER_OPTIONS.includes(i as number));
    if (invalid) {
      return NextResponse.json({ error: "Invalid reminder interval" }, { status: 400 });
    }
    reminderIntervals = [...new Set(intervals as number[])];
  } else {
    reminderIntervals = DEFAULT_REMINDER_INTERVALS;
  }

  const eventDatetimeUtc = istInputsToUtcIso(date, time);
  const item = await createItem(title.trim(), eventDatetimeUtc, reminderIntervals);
  return NextResponse.json(item, { status: 201 });
}
