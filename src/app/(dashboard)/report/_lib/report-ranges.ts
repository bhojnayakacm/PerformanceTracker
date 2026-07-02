/**
 * Report — shared time-window model + granularity-aware presets.
 *
 * The Report metrics live at two granularities, so there are two window
 * shapes and two preset sets:
 *   • DAILY   (Meetings): a [from, to] DATE range + a server-side bucket.
 *   • MONTHLY (Dispatch / Visits / Conversion / Tour / Costing): a
 *     [from, to] month range — these have no sub-monthly data, so offering
 *     "Last 7 Days" here would be a lie against the schema.
 *
 * Every preset ends at "today" / the current month so a card never paints
 * empty future buckets, matching the present-day-cap philosophy the
 * Dashboard and Cumulative pages already use.
 *
 * These builders are PURE functions of a reference `now`, so the server
 * (prefetch) and the client (initial useState) compute identical default
 * windows — the same contract every other page in this app relies on.
 */

export type DailyBucket = "day" | "week" | "month";

/** Daily-tier window: inclusive ISO date range + the server bucket size. */
export type DailyWindow = {
  from: string; // yyyy-mm-dd
  to: string; // yyyy-mm-dd
  bucket: DailyBucket;
};

/** Monthly-tier window: inclusive [from, to] month range. */
export type MonthlyWindow = {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
};

export type RangePreset<W> = { label: string; window: W };

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/* ── date helpers ─────────────────────────────────────────────────────── */

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function firstOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** month ordinal (1-based month) so range math stays a single subtraction. */
export const monthOrd = (m: number, y: number) => y * 12 + (m - 1);
export const fromMonthOrd = (o: number) => ({
  month: (o % 12) + 1,
  year: Math.floor(o / 12),
});

/* ── DAILY presets (Meetings only) ────────────────────────────────────── */

export function dailyPresets(now: Date = new Date()): RangePreset<DailyWindow>[] {
  const today = iso(now);
  const fyStart =
    now.getMonth() + 1 >= 4 ? now.getFullYear() : now.getFullYear() - 1;
  const monthsBackFirst = (n: number) =>
    iso(new Date(now.getFullYear(), now.getMonth() - n, 1));

  return [
    {
      label: "Last 7 Days",
      window: { from: iso(addDays(now, -6)), to: today, bucket: "day" },
    },
    {
      label: "Last 30 Days",
      window: { from: iso(addDays(now, -29)), to: today, bucket: "day" },
    },
    {
      label: "This Month",
      window: { from: iso(firstOfMonth(now)), to: today, bucket: "day" },
    },
    {
      label: "Last 3 Months",
      window: { from: monthsBackFirst(2), to: today, bucket: "week" },
    },
    {
      label: "Last 6 Months",
      window: { from: monthsBackFirst(5), to: today, bucket: "month" },
    },
    {
      label: "This FY",
      window: { from: `${fyStart}-04-01`, to: today, bucket: "month" },
    },
    {
      label: "Last 12 Months",
      window: { from: monthsBackFirst(11), to: today, bucket: "month" },
    },
  ];
}

export function defaultDailyWindow(now: Date = new Date()): DailyWindow {
  return dailyPresets(now)[1].window; // Last 30 Days
}

export function activeDailyPreset(w: DailyWindow, now: Date = new Date()): number {
  return dailyPresets(now).findIndex(
    (p) =>
      p.window.from === w.from &&
      p.window.to === w.to &&
      p.window.bucket === w.bucket,
  );
}

/* ── MONTHLY presets (everything else) ────────────────────────────────── */

export function monthlyPresets(
  now: Date = new Date(),
): RangePreset<MonthlyWindow>[] {
  const cm = now.getMonth() + 1;
  const cy = now.getFullYear();
  const to = { toMonth: cm, toYear: cy };
  const back = (n: number) => {
    const { month, year } = fromMonthOrd(monthOrd(cm, cy) - n);
    return { fromMonth: month, fromYear: year };
  };
  const fyStart = cm >= 4 ? cy : cy - 1;

  return [
    { label: "This Month", window: { ...back(0), ...to } },
    { label: "Last 3 Months", window: { ...back(2), ...to } },
    { label: "Last 6 Months", window: { ...back(5), ...to } },
    { label: "This FY", window: { fromMonth: 4, fromYear: fyStart, ...to } },
    { label: "Last 12 Months", window: { ...back(11), ...to } },
    { label: "Calendar YTD", window: { fromMonth: 1, fromYear: cy, ...to } },
  ];
}

export function defaultMonthlyWindow(now: Date = new Date()): MonthlyWindow {
  return monthlyPresets(now)[2].window; // Last 6 Months
}

export function activeMonthlyPreset(
  w: MonthlyWindow,
  now: Date = new Date(),
): number {
  return monthlyPresets(now).findIndex(
    (p) =>
      p.window.fromMonth === w.fromMonth &&
      p.window.fromYear === w.fromYear &&
      p.window.toMonth === w.toMonth &&
      p.window.toYear === w.toYear,
  );
}

/* ── label formatting (shared by the chart cards) ─────────────────────── */

export function formatMonthLabel(month: number, year: number): string {
  return `${MONTHS_SHORT[month - 1]} '${String(year).slice(2)}`;
}

/** Format a daily-series bucket start. `T00:00:00` forces local-midnight
 *  parsing so a "yyyy-mm-dd" string never shifts a day under UTC parsing. */
export function formatDailyLabel(
  bucketStart: string,
  bucket: DailyBucket,
): string {
  const d = new Date(`${bucketStart}T00:00:00`);
  if (bucket === "month") {
    return `${MONTHS_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`;
  }
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Human label for a monthly window, e.g. "Apr '25 — Sep '25". */
export function monthlyWindowLabel(w: MonthlyWindow): string {
  return `${formatMonthLabel(w.fromMonth, w.fromYear)} — ${formatMonthLabel(
    w.toMonth,
    w.toYear,
  )}`;
}
