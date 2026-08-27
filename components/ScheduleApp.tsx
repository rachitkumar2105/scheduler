"use client";

import { useEffect, useMemo, useState } from "react";
import type { ScheduleItem } from "@/lib/db";
import { formatIst, istDateString, todayIstDateString } from "@/lib/time";
import {
  DEFAULT_REMINDER_INTERVALS,
  CUSTOM_REMINDER_OPTIONS,
  INTERVAL_LABELS,
  PRIORITIES,
  PRIORITY_LABELS,
  PRIORITY_WEIGHT,
  type Priority,
} from "@/lib/constants";

type Tab = "today" | "upcoming" | "all" | "plan";

const TAB_LABELS: Record<Tab, string> = {
  today: "Today",
  upcoming: "Upcoming",
  all: "All",
  plan: "Plan",
};

const PRIORITY_STYLE: Record<Priority, string> = {
  low: "bg-slate-100 text-slate-500 border-slate-200",
  medium: "bg-blue-50 text-blue-700 border-blue-200",
  high: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function ScheduleApp({
  initialItems,
  emailConfigured,
}: {
  initialItems: ScheduleItem[];
  emailConfigured: boolean;
}) {
  const [items, setItems] = useState<ScheduleItem[]>(initialItems);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [showAdd, setShowAdd] = useState(false);
  const [, forceTick] = useState(0);

  // Re-render every 30s so countdowns stay live without refetching.
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sorted = useMemo(
    () => [...items].sort((a, b) => new Date(a.event_datetime).getTime() - new Date(b.event_datetime).getTime()),
    [items]
  );

  const today = todayIstDateString();
  const todayItems = sorted.filter((i) => istDateString(i.event_datetime) === today);
  const visibleItems =
    tab === "today" ? todayItems : tab === "upcoming" ? sorted.filter((i) => istDateString(i.event_datetime) !== today) : sorted;

  const nextUp = sorted[0];

  function handleAdded(item: ScheduleItem) {
    setItems((prev) => [...prev, item]);
    setShowAdd(false);
  }

  function handleDeleted(id: number) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  function handlePriorityChanged(id: number, priority: Priority) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, priority } : i)));
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-blue-50 via-white to-emerald-50/40">
      <div className="max-w-md mx-auto w-full pb-10">
        <Header emailConfigured={emailConfigured} />

        <div className="px-4 pt-4">
          <p className="text-sm text-slate-500 flex items-center gap-1.5">
            <span className="text-blue-500">✧</span>
            {todayItems.length === 0
              ? "Nothing today"
              : `${todayItems.length} item${todayItems.length > 1 ? "s" : ""} today`}
            {" — digest at 9:00 AM"}
          </p>
        </div>

        {nextUp && (
          <div className="px-4 pt-3">
            <NextUpCard item={nextUp} />
          </div>
        )}

        <div className="px-4 pt-5">
          <div className="flex bg-slate-100 rounded-full p-1">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 text-xs sm:text-sm font-medium py-2 rounded-full transition ${
                  tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="w-full mt-2 flex items-center justify-center gap-1 bg-blue-600 text-white text-sm font-medium py-2.5 rounded-full active:bg-blue-700"
          >
            <span className="text-lg leading-none">+</span> New item
          </button>
        </div>

        {showAdd && (
          <div className="px-4 pt-4">
            <AddItemForm onAdded={handleAdded} onCancel={() => setShowAdd(false)} />
          </div>
        )}

        <div className="px-4 pt-4">
          {tab === "plan" ? (
            <PlanView items={sorted} />
          ) : (
            <div className="space-y-3">
              {visibleItems.length === 0 && (
                <p className="text-center text-slate-400 py-12 text-sm">Nothing here.</p>
              )}
              {visibleItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onDeleted={handleDeleted}
                  onPriorityChanged={handlePriorityChanged}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ emailConfigured }: { emailConfigured: boolean }) {
  return (
    <header className="px-4 pt-6 pb-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-lg shrink-0">
          ⏰
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Scheduler</h1>
          <p className="text-xs text-slate-400">Asia/Kolkata · IST</p>
        </div>
      </div>
      <span
        className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full ${
          emailConfigured ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"
        }`}
      >
        ✉ Email {emailConfigured ? "on" : "off"}
      </span>
    </header>
  );
}

function minutesRemaining(isoUtc: string): number {
  return (new Date(isoUtc).getTime() - Date.now()) / 60000;
}

function formatRemaining(minutes: number): string {
  if (minutes <= 0) return "now";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${PRIORITY_STYLE[priority]}`}>
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function PriorityPicker({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (p: Priority) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PRIORITIES.map((p) => (
        <button
          type="button"
          key={p}
          onClick={() => onChange(p)}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
            value === p ? PRIORITY_STYLE[p] + " ring-2 ring-offset-1 ring-blue-200" : "bg-white text-slate-400 border-slate-200"
          }`}
        >
          {PRIORITY_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

function NextUpCard({ item }: { item: ScheduleItem }) {
  const remaining = minutesRemaining(item.event_datetime);
  const pending = item.reminder_intervals.filter((iv) => !item.sent_intervals.includes(iv));
  const nextInterval = pending.length ? Math.max(...pending) : null;
  const largest = item.reminder_intervals.length ? Math.max(...item.reminder_intervals) : 0;
  const progress = largest > 0 ? Math.min(1, Math.max(0, 1 - remaining / largest)) : 0;
  const sortedIntervals = [...item.reminder_intervals].sort((a, b) => b - a);

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-blue-100/60 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 tracking-wide uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Next up
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mt-1.5">{item.title}</h2>
      <p className="text-sm text-slate-400 mt-0.5">{formatIst(item.event_datetime)}</p>

      <div className="flex items-end justify-between mt-4">
        <div>
          <div className="text-4xl font-black text-slate-900 tracking-tight">{formatRemaining(remaining)}</div>
          <p className="text-xs text-slate-400 mt-0.5">remaining</p>
        </div>
        {nextInterval !== null && (
          <div className="text-center bg-slate-50 rounded-2xl px-3 py-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Next email</p>
            <p className="text-sm font-bold text-slate-900">{INTERVAL_LABELS[nextInterval]} before</p>
          </div>
        )}
      </div>

      <div className="h-1.5 rounded-full bg-slate-100 mt-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {sortedIntervals.map((iv) => (
          <ReminderChip key={iv} interval={iv} sent={item.sent_intervals.includes(iv)} isNext={iv === nextInterval} />
        ))}
      </div>
    </div>
  );
}

function ReminderChip({ interval, sent, isNext }: { interval: number; sent: boolean; isNext: boolean }) {
  const base = "text-xs font-semibold px-2.5 py-1 rounded-full border";
  const style = sent
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : isNext
    ? "bg-blue-100 text-blue-700 border-blue-300 ring-2 ring-blue-200"
    : "bg-slate-50 text-slate-400 border-slate-200";
  return <span className={`${base} ${style}`}>{INTERVAL_LABELS[interval] ?? `${interval}m`}</span>;
}

function ItemRow({
  item,
  onDeleted,
  onPriorityChanged,
}: {
  item: ScheduleItem;
  onDeleted: (id: number) => void;
  onPriorityChanged: (id: number, priority: Priority) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const remaining = minutesRemaining(item.event_datetime);
  const urgency = remaining < 60 ? "red" : remaining < 360 ? "amber" : "emerald";
  const pillStyle = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[urgency];

  const pending = item.reminder_intervals.filter((iv) => !item.sent_intervals.includes(iv));
  const nextInterval = pending.length ? Math.max(...pending) : null;
  const sortedIntervals = [...item.reminder_intervals].sort((a, b) => b - a);

  async function handleDelete() {
    setDeleting(true);
    try {
      await fetch(`/api/items/${item.id}`, { method: "DELETE" });
      onDeleted(item.id);
    } finally {
      setDeleting(false);
    }
  }

  async function handlePriorityChange(priority: Priority) {
    if (priority === item.priority) return;
    setSavingPriority(true);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) onPriorityChanged(item.id, priority);
    } finally {
      setSavingPriority(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm shrink-0">
            🔔
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate">{item.title}</p>
            <p className="text-xs text-slate-400">{formatIst(item.event_datetime)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pillStyle}`}>
            in {formatRemaining(remaining)}
          </span>
          <button
            onClick={handleDelete}
            disabled={deleting}
            aria-label={`Delete ${item.title}`}
            className="text-slate-300 active:text-red-600 p-1.5 -m-1.5 disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16Z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="border-t border-slate-50 mt-3 pt-2.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Priority</p>
        <fieldset disabled={savingPriority}>
          <PriorityPicker value={item.priority} onChange={handlePriorityChange} />
        </fieldset>
      </div>

      <div className="border-t border-slate-50 mt-2.5 pt-2.5">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Reminders</p>
        <div className="flex flex-wrap gap-1.5">
          {sortedIntervals.map((iv) => (
            <ReminderChip key={iv} interval={iv} sent={item.sent_intervals.includes(iv)} isNext={iv === nextInterval} />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Suggested working order: soonest-deadline-weighted-by-priority first. */
function planRank(items: ScheduleItem[]): ScheduleItem[] {
  return [...items].sort((a, b) => {
    const scoreA = minutesRemaining(a.event_datetime) / PRIORITY_WEIGHT[a.priority];
    const scoreB = minutesRemaining(b.event_datetime) / PRIORITY_WEIGHT[b.priority];
    return scoreA - scoreB;
  });
}

function PlanView({ items }: { items: ScheduleItem[] }) {
  const ranked = useMemo(() => planRank(items), [items]);

  if (ranked.length === 0) {
    return <p className="text-center text-slate-400 py-12 text-sm">Add items to see a suggested plan.</p>;
  }

  return (
    <div>
      <p className="text-xs text-slate-400 mb-3">
        Suggested order — combines priority and deadline. Work top to bottom.
      </p>
      <div className="space-y-2.5">
        {ranked.map((item, idx) => (
          <div key={item.id} className="flex items-center gap-3 bg-white rounded-2xl border border-slate-100 px-4 py-3">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              {idx + 1}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900 truncate">{item.title}</p>
              <p className="text-xs text-slate-400">{formatIst(item.event_datetime)}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <PriorityBadge priority={item.priority} />
              <span className="text-xs text-slate-400">in {formatRemaining(minutesRemaining(item.event_datetime))}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AddItemForm({
  onAdded,
  onCancel,
}: {
  onAdded: (item: ScheduleItem) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [mode, setMode] = useState<"auto" | "custom">("auto");
  const [customIntervals, setCustomIntervals] = useState<number[]>([1440, 60]);
  const [priority, setPriority] = useState<Priority>("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleCustomInterval(iv: number) {
    setCustomIntervals((prev) => (prev.includes(iv) ? prev.filter((x) => x !== iv) : [...prev, iv]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim() || !date || !time) {
      setError("Fill in all fields");
      return;
    }
    if (mode === "custom" && customIntervals.length === 0) {
      setError("Pick at least one reminder");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, date, time, mode, intervals: customIntervals, priority }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add item");
      }
      const newItem: ScheduleItem = await res.json();
      onAdded(newItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="What's happening?"
        className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-base text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Priority</p>
        <PriorityPicker value={priority} onChange={setPriority} />
      </div>

      <div>
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Reminders</p>
        <div className="flex bg-slate-100 rounded-full p-1 text-sm">
          <button
            type="button"
            onClick={() => setMode("auto")}
            className={`flex-1 py-1.5 rounded-full font-medium transition ${
              mode === "auto" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Automatic
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex-1 py-1.5 rounded-full font-medium transition ${
              mode === "custom" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Custom
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {mode === "auto"
            ? DEFAULT_REMINDER_INTERVALS.map((iv) => (
                <span key={iv} className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                  {INTERVAL_LABELS[iv]}
                </span>
              ))
            : CUSTOM_REMINDER_OPTIONS.map((iv) => {
                const active = customIntervals.includes(iv);
                return (
                  <button
                    type="button"
                    key={iv}
                    onClick={() => toggleCustomInterval(iv)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                      active
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-slate-500 border-slate-200"
                    }`}
                  >
                    {INTERVAL_LABELS[iv]}
                  </button>
                );
              })}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl bg-slate-100 text-slate-600 font-medium py-2.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-xl bg-blue-600 text-white font-medium py-2.5 active:bg-blue-700 disabled:opacity-60"
        >
          {submitting ? "Adding..." : "Add"}
        </button>
      </div>
    </form>
  );
}
