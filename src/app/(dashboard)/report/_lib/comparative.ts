/**
 * Comparative reports — the shared normalization spine.
 *
 * Every "Compare" page (Meetings, Dispatch, Visits, Conversion, Tour, Costing)
 * fetches a different RPC shape but funnels it through ONE normalized model:
 * a `ComparativeSeries[]` aligned to a shared label axis. The table + chart only
 * ever see that model, so a new comparative metric is a thin adapter (pick a
 * field, pick a reducer) — never new chart code.
 *
 * TWO DIFFERENT CAPACITIES (the reason for two caps below)
 * A table of 100 rows is useful — you sort it, you filter it, you find the three
 * people under 50%. A chart of 100 lines is noise. So the TABLE and the
 * ATTAINMENT FILTER operate on the entire selection (the whole roster by
 * default), while the trend chart plots a bounded subset chosen via pinning.
 *
 * COLOUR therefore belongs to the PLOTTED subset, not to the selection: a colour
 * in this UI means "this row is on the chart, in this colour". It's allocated by
 * slot through `allocatePaletteSlots`, which preserves an employee's slot as
 * others come and go — so colour follows the entity, never its rank, and pinning
 * a ninth person never repaints the other eight. The palette itself is the
 * dataviz reference categorical order (CVD-optimized), validated on the app's
 * white card surface for line forms. Three slots sit under 3:1 contrast, so
 * identity is never colour-alone: the chart legend and the table's own name
 * column carry it.
 */

/**
 * Chart cap. The palette has exactly this many CVD-safe slots, so the number of
 * plottable series and the palette length are the same number by construction.
 */
export const MAX_PLOTTED = 8;

/**
 * Guard on how many ids an explicit `?ids=` selection may carry. This is a URL
 * LENGTH limit, not a UX one: 60 UUIDs is already ~2.2 kB of query string, near
 * the practical ceiling for proxies and server request lines. Selecting the
 * whole roster doesn't go through here at all — it's represented by the ABSENCE
 * of the param (see parseCompareIds), so company-wide analysis costs zero URL.
 */
export const MAX_EXPLICIT_IDS = 60;

/**
 * Categorical order from the dataviz reference palette (light column). Assigned
 * by slot index, never re-ordered by value. Validated on #ffffff: all hard gates
 * pass; magenta/yellow/aqua fall under 3:1 vs surface → the leaderboard's direct
 * labels carry identity for those (the documented relief rule).
 */
export const SERIES_PALETTE = [
  "#2a78d6", // 1 blue
  "#008300", // 2 green
  "#e87ba4", // 3 magenta
  "#eda100", // 4 yellow
  "#1baf7a", // 5 aqua
  "#eb6834", // 6 orange
  "#4a3aa7", // 7 violet
  "#e34948", // 8 red
] as const;

export type EmployeeMeta = { id: string; name: string; emp_id: string };

export type ComparativePoint = { label: string; value: number };

export type ComparativeSeries = {
  /** CSS-var-safe, stable key (e0, e1, …) — the Recharts dataKey + config key.
   *  Derived from selection order, so it survives sorting and filtering.
   *  NOTE: this is an identity key, NOT a colour slot — see allocatePaletteSlots. */
  key: string;
  employeeId: string;
  name: string;
  empId: string;
  /** Values aligned to the shared label axis (missing buckets zero-filled). */
  points: ComparativePoint[];
  /** Window reduction for the headline column (a sum, or a derived rate). */
  total: number;
  /** Window target, or null for metrics with no target (conversion, costing). */
  target: number | null;
  /**
   * Every window-summed measure for this employee, keyed by column id — the
   * rich breakdown table reads its cells straight out of here, so adding a
   * column is a spec entry plus one line in the metric's stats reducer.
   */
  stats: Record<string, number>;
  /**
   * The performance % this employee is filtered and ranked on: total/target for
   * metrics that HAVE a target, or an explicit override for rate metrics
   * (Conversion supplies its own rate). null when the metric has no % at all
   * (Costing) — such rows are excluded whenever an attainment filter is active.
   */
  attainment: number | null;
  /** Optional secondary line beside the name (e.g. Tour's "3 cities"). */
  subLabel?: string;
};

type BuildOpts<Row> = {
  rows: Row[];
  /** Selected ids in URL order — this order fixes each employee's colour slot. */
  ids: string[];
  employees: EmployeeMeta[];
  employeeId: (r: Row) => string;
  /** Chronological sort key for the shared axis (month ordinal, or ISO date). */
  sortKey: (r: Row) => number | string;
  label: (r: Row) => string;
  /** The per-bucket value that becomes a point on the trend line. */
  value: (r: Row) => number;
  /**
   * Window reduction from an employee's own rows. `attainment` is optional —
   * omit it and it derives from total/target; supply it for rate metrics whose
   * performance % isn't a ratio of the two (Conversion).
   */
  reduce: (rows: Row[]) => {
    total: number;
    target: number | null;
    attainment?: number | null;
  };
  /** Window-summed measures for the rich table, keyed by column id. */
  stats?: (rows: Row[]) => Record<string, number>;
  /** Optional secondary label derived from an employee's rows. */
  subLabel?: (rows: Row[]) => string;
};

/**
 * Group RPC rows by employee, build the shared chronological axis from the union
 * of buckets, zero-fill gaps, and reduce each employee's rows to a leaderboard
 * total. Employees with no rows in-window still appear (empty series, zero total)
 * so the comparison never silently drops a selected name.
 */
export function buildSeries<Row>(opts: BuildOpts<Row>): {
  series: ComparativeSeries[];
  labels: string[];
} {
  const { rows, ids, employees } = opts;

  // Shared axis = union of buckets across everyone, sorted chronologically.
  const axis = new Map<number | string, string>();
  for (const r of rows) axis.set(opts.sortKey(r), opts.label(r));
  const axisKeys = [...axis.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const labels = axisKeys.map((k) => axis.get(k)!);

  // Group rows by employee once.
  const byEmp = new Map<string, Row[]>();
  for (const r of rows) {
    const id = opts.employeeId(r);
    let arr = byEmp.get(id);
    if (!arr) {
      arr = [];
      byEmp.set(id, arr);
    }
    arr.push(r);
  }

  const metaById = new Map(employees.map((e) => [e.id, e]));

  // NO cap here — the table and the attainment filter want every selected
  // employee. Bounding happens later, and only for the chart.
  const series = ids.map((id, i) => {
    const empRows = byEmp.get(id) ?? [];
    const valueByKey = new Map<number | string, number>();
    for (const r of empRows) valueByKey.set(opts.sortKey(r), opts.value(r));
    const points = axisKeys.map((k) => ({
      label: axis.get(k)!,
      value: valueByKey.get(k) ?? 0,
    }));
    const { total, target, attainment } = opts.reduce(empRows);
    const meta = metaById.get(id);
    return {
      key: `e${i}`,
      employeeId: id,
      name: meta?.name ?? "Unknown",
      empId: meta?.emp_id ?? "",
      points,
      total,
      target,
      stats: opts.stats?.(empRows) ?? {},
      attainment: attainment ?? deriveAttainment(total, target),
      subLabel: opts.subLabel?.(empRows),
    };
  });

  return { series, labels };
}

/** Zip aligned series into Recharts row data: [{ label, e0, e1, … }]. */
export function toChartRows(
  series: ComparativeSeries[],
  labels: string[],
): Record<string, string | number>[] {
  return labels.map((label, i) => {
    const row: Record<string, string | number> = { label };
    for (const s of series) row[s.key] = s.points[i]?.value ?? 0;
    return row;
  });
}

/* ── URL scope model — shared by the multi-select + every page ───────────
 *
 * Three states, encoded so the common one costs nothing:
 *   • param ABSENT  → the ENTIRE ROSTER. The default, and what management wants
 *     when the question is "who in the company is under 50%". Crucially this
 *     enumerates nothing in the URL, so a 200-person company is still a clean
 *     `/report/compare/dispatch`.
 *   • `?ids=a,b,c`  → that explicit subset, in that order.
 *   • `?ids=`       → an explicit EMPTY selection (the user cleared it), which
 *     is why the empty string and `undefined` must stay distinguishable.
 */

/** Parse `?ids=` into a validated, de-duped, capped id list in URL order. Any id
 *  outside the caller's roster is dropped, so a hand-typed param can't widen
 *  scope past what getEmployeesForUser already returned. */
export function parseCompareIds(
  raw: string | undefined,
  roster: EmployeeMeta[],
): string[] {
  if (!raw) return [];
  const allowed = new Set(roster.map((e) => e.id));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of raw.split(",")) {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed) || !allowed.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
    if (out.length >= MAX_EXPLICIT_IDS) break;
  }
  return out;
}

export const serializeCompareIds = (ids: string[]): string => ids.join(",");

/* ── Chart plotting: which of the selected employees get a line ──────────── */

/**
 * Reconcile colour slots against the currently-plotted ids, PRESERVING the slot
 * of anyone who was already plotted. Unpinning employee #2 must not shuffle #3
 * into their colour — a chart where the meaning of "blue" changes as you toggle
 * rows is unreadable. Freed slots go to newcomers, lowest first.
 *
 * Pure and idempotent: same `prev` + same `ids` always yields the same result,
 * so it's safe to run during render with a ref as the carrier.
 */
export function allocatePaletteSlots(
  prev: Map<string, number>,
  ids: string[],
): Map<string, number> {
  const wanted = new Set(ids);
  const next = new Map<string, number>();
  const used = new Set<number>();

  // Keep the slots of everyone still plotted.
  for (const [id, slot] of prev) {
    if (!wanted.has(id) || used.has(slot)) continue;
    next.set(id, slot);
    used.add(slot);
  }
  // Newcomers take the lowest free slot.
  for (const id of ids) {
    if (next.has(id)) continue;
    let slot = 0;
    while (used.has(slot)) slot += 1;
    next.set(id, slot);
    used.add(slot);
  }
  return next;
}

/** Colour for a plotted employee. Modulo is a formality — the plotted set is
 *  capped at MAX_PLOTTED, which equals the palette length. */
export const paletteColor = (slot: number): string =>
  SERIES_PALETTE[slot % SERIES_PALETTE.length];

/* ── Rich table column spec ─────────────────────────────────────────────
 * One shared table renders every metric; a metric contributes only this list.
 * `value` reads from the series (usually its `stats` bag), `total` folds the
 * column for the team-total footer — summing by default, but rate columns
 * (attainment, conversion %) must re-derive from the underlying sums rather
 * than average the per-employee percentages. */

export type CompareColumn = {
  /** Unique column id — also the sort key. */
  key: string;
  label: string;
  /** Cell value; null renders as an em-dash and sorts last. */
  value: (s: ComparativeSeries) => number | null;
  format: (n: number) => string;
  /** "attainment" adds the status colour + inline progress bar. */
  variant?: "number" | "attainment";
  /** The metric's headline column — bolder ink, and the default sort. */
  emphasis?: boolean;
  /** Footer aggregate. Omit to sum; return null to leave the cell blank. */
  total?: (all: ComparativeSeries[]) => number | null;
};

/** Sum a column across every visible employee (the footer default). */
export function sumColumn(
  all: ComparativeSeries[],
  value: (s: ComparativeSeries) => number | null,
): number {
  return all.reduce((acc, s) => acc + (value(s) ?? 0), 0);
}

/** Team attainment = Σactual / Σtarget — never the mean of the percentages. */
export function teamAttainment(all: ComparativeSeries[]): number | null {
  const target = all.reduce((acc, s) => acc + (s.target ?? 0), 0);
  if (target <= 0) return null;
  const actual = all.reduce((acc, s) => acc + s.total, 0);
  return (actual / target) * 100;
}

function deriveAttainment(total: number, target: number | null): number | null {
  return target && target > 0 ? (total / target) * 100 : null;
}

/* ── Attainment filter ──────────────────────────────────────────────────
 * `min` is INCLUSIVE, `max` EXCLUSIVE — so the preset bands tile the number
 * line with no overlap and no gap at the boundaries (…<75 | 75–100 | ≥100…).
 * Both null = no filter. */

export type AttainmentRange = { min: number | null; max: number | null };

export const ATTAINMENT_ALL: AttainmentRange = { min: null, max: null };

export type AttainmentPreset = { label: string; range: AttainmentRange };

/** Target-attainment bands — for metrics measured against a target. */
export const ATTAINMENT_PRESETS: AttainmentPreset[] = [
  { label: "All", range: ATTAINMENT_ALL },
  { label: "On target — 100%+", range: { min: 100, max: null } },
  { label: "Near target — 75–100%", range: { min: 75, max: 100 } },
  { label: "Lagging — 50–75%", range: { min: 50, max: 75 } },
  { label: "Critical — under 50%", range: { min: null, max: 50 } },
];

/**
 * Conversion is a RATE, not a target ratio — nobody converts 100% of visits, so
 * the attainment bands above would be nonsense there. These bands describe the
 * rate itself, which is what "performing well" means for that metric.
 */
export const CONVERSION_RATE_PRESETS: AttainmentPreset[] = [
  { label: "All", range: ATTAINMENT_ALL },
  { label: "Strong — 30%+", range: { min: 30, max: null } },
  { label: "Healthy — 20–30%", range: { min: 20, max: 30 } },
  { label: "Soft — 10–20%", range: { min: 10, max: 20 } },
  { label: "Weak — under 10%", range: { min: null, max: 10 } },
];

export const isAttainmentActive = (r: AttainmentRange): boolean =>
  r.min !== null || r.max !== null;

export const sameAttainmentRange = (
  a: AttainmentRange,
  b: AttainmentRange,
): boolean => a.min === b.min && a.max === b.max;

/**
 * Keep only employees whose attainment falls in the band. Rows with no
 * attainment at all (no target in the window) can't satisfy a threshold, so an
 * active filter drops them — surfaced in the UI as "N of M shown" rather than
 * silently.
 */
export function applyAttainmentFilter(
  series: ComparativeSeries[],
  range: AttainmentRange,
): ComparativeSeries[] {
  if (!isAttainmentActive(range)) return series;
  return series.filter((s) => {
    if (s.attainment === null) return false;
    if (range.min !== null && s.attainment < range.min) return false;
    if (range.max !== null && s.attainment >= range.max) return false;
    return true;
  });
}

/** Compact label for the filter trigger, e.g. "100%+", "75–100%", "under 50%".
 *  Purely mechanical, so it reads correctly for preset and custom bands alike. */
export function attainmentRangeLabel(r: AttainmentRange): string {
  if (r.min !== null && r.max !== null) return `${r.min}–${r.max}%`;
  if (r.min !== null) return `${r.min}%+`;
  if (r.max !== null) return `under ${r.max}%`;
  return "All";
}
