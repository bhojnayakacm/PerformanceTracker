"use client";

/**
 * Composes a Compare view's body and owns the bridge between two different
 * capacities: an UNBOUNDED table and a BOUNDED chart.
 *
 * THE BRIDGE — auto-plot the leaders, override by pinning
 *   • By default the chart plots the top MAX_PLOTTED rows of the table's CURRENT
 *     sort. That means the chart is always populated and always relevant: sort
 *     by Attainment ascending and it becomes "the eight worst performers over
 *     time", with no extra interaction. Nothing to configure, nothing empty.
 *   • The moment the user toggles any row's pin, the set becomes MANUAL, seeded
 *     from whatever was auto-plotted — so pinning is an adjustment of what
 *     they're already looking at, never a jump to a blank chart. A "Reset" hands
 *     control back to auto.
 *   • Pins are intersected with the visible rows each render, so an employee who
 *     drops out of the attainment filter or the selection silently stops being
 *     plotted instead of haunting the chart.
 *
 * Sort is owned one level UP (useCompareSort in the metric component) and the
 * series arrives pre-sorted, because three consumers need that same order: this
 * table, the auto-plot below, and the toolbar's Export button — which lives
 * outside this subtree entirely.
 *
 * Colour is allocated only to plotted employees, and slots are preserved across
 * pin/unpin (allocatePaletteSlots), so toggling one row never repaints the rest.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown, LineChart, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparativeTable } from "./comparative-table";
import { ComparativeChart } from "./comparative-chart";
import {
  allocatePaletteSlots,
  MAX_PLOTTED,
  paletteColor,
  type CompareColumn,
  type ComparativeSeries,
} from "../_lib/comparative";
import type { SortState } from "../_lib/use-compare-sort";

export function ComparativeViews({
  series,
  columns,
  sort,
  onSort,
  labels,
  valueFormat,
  axisFormat,
  /** Metrics with no time axis (Tour compares window totals) skip the chart. */
  showTrend = true,
}: {
  /** Already attainment-filtered AND sorted by the metric component. */
  series: ComparativeSeries[];
  columns: CompareColumn[];
  sort: SortState;
  onSort: (key: string) => void;
  labels: string[];
  valueFormat: (n: number) => string;
  axisFormat?: (n: number) => string;
  showTrend?: boolean;
}) {
  /** null = auto (top of the current sort); an array = the user's own picks. */
  const [pinned, setPinned] = useState<string[] | null>(null);
  const [trendOpen, setTrendOpen] = useState(true);

  // Arrives pre-sorted; the alias keeps the auto-plot logic below readable.
  const sorted = series;

  const canTrend = showTrend && labels.length > 1;

  /** What auto mode would plot: the leaders of the current sort. */
  const autoIds = useMemo(
    () => sorted.slice(0, MAX_PLOTTED).map((s) => s.employeeId),
    [sorted],
  );

  const plottedIds = useMemo(() => {
    const visible = new Set(sorted.map((s) => s.employeeId));
    const base = pinned ?? autoIds;
    return base.filter((id) => visible.has(id)).slice(0, MAX_PLOTTED);
  }, [pinned, autoIds, sorted]);

  // Persistent slot map so an employee keeps their colour while others come and
  // go. Idempotent reconcile, so running it during render is safe.
  const slotsRef = useRef<Map<string, number>>(new Map());
  const colorById = useMemo(() => {
    const slots = allocatePaletteSlots(slotsRef.current, plottedIds);
    slotsRef.current = slots;
    return new Map([...slots].map(([id, slot]) => [id, paletteColor(slot)]));
  }, [plottedIds]);

  const plottedSet = useMemo(() => new Set(plottedIds), [plottedIds]);

  const togglePin = useCallback(
    (id: string) => {
      const base = pinned ?? autoIds;
      if (base.includes(id)) {
        setPinned(base.filter((x) => x !== id));
      } else if (base.length < MAX_PLOTTED) {
        setPinned([...base, id]);
      }
    },
    [pinned, autoIds],
  );

  /** Plotted series in slot order, so the legend reads in colour order. */
  const plottedSeries = useMemo(() => {
    const byId = new Map(sorted.map((s) => [s.employeeId, s]));
    return plottedIds
      .map((id) => byId.get(id))
      .filter((s): s is ComparativeSeries => Boolean(s));
  }, [plottedIds, sorted]);

  return (
    <div className="space-y-5">
      <ComparativeTable
        series={sorted}
        columns={columns}
        sort={sort}
        onSort={onSort}
        colorById={colorById}
        plottedSet={plottedSet}
        onTogglePin={canTrend ? togglePin : undefined}
        chartFull={plottedIds.length >= MAX_PLOTTED}
      />

      {canTrend && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
            <LineChart className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Trend over time
            </span>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium tabular-nums text-slate-500">
              {plottedIds.length} / {MAX_PLOTTED} plotted
              <span className="text-slate-300">·</span>
              {pinned === null ? "auto" : "pinned"}
            </span>

            {pinned !== null && (
              <button
                type="button"
                onClick={() => setPinned(null)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reset to top {MAX_PLOTTED}
              </button>
            )}

            <button
              type="button"
              onClick={() => setTrendOpen((v) => !v)}
              aria-expanded={trendOpen}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              {trendOpen ? "Hide" : "Show"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  trendOpen && "rotate-180",
                )}
              />
            </button>
          </div>

          {trendOpen &&
            (plottedSeries.length === 0 ? (
              <div className="flex h-[200px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-200 text-center">
                <p className="text-sm font-medium text-slate-500">
                  Nothing plotted
                </p>
                <p className="max-w-xs text-xs text-slate-400">
                  Pin up to {MAX_PLOTTED} employees in the table to chart them
                  over time.
                </p>
              </div>
            ) : (
              <ComparativeChart
                series={plottedSeries}
                labels={labels}
                colorById={colorById}
                valueFormat={valueFormat}
                axisFormat={axisFormat}
              />
            ))}
        </div>
      )}
    </div>
  );
}
