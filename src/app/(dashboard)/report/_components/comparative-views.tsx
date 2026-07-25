"use client";

/**
 * Composes a Compare view's body in the order management asked for: the rich
 * breakdown TABLE first, the trend chart second, behind a section header that
 * can collapse it. The numbers are the headline; the trendline is the appendix.
 *
 * Collapsing is local UI state, not a preference — the chart stays one click
 * away, and the table never moves when it opens or closes.
 */

import { useState } from "react";
import { ChevronDown, LineChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ComparativeTable } from "./comparative-table";
import { ComparativeChart } from "./comparative-chart";
import type { CompareColumn, ComparativeSeries } from "../_lib/comparative";

export function ComparativeViews({
  series,
  columns,
  labels,
  valueFormat,
  axisFormat,
  /** Metrics with no time axis (Tour compares window totals) skip the chart. */
  showTrend = true,
}: {
  series: ComparativeSeries[];
  columns: CompareColumn[];
  labels: string[];
  valueFormat: (n: number) => string;
  axisFormat?: (n: number) => string;
  showTrend?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const canTrend = showTrend && labels.length > 1;

  return (
    <div className="space-y-5">
      <ComparativeTable series={series} columns={columns} />

      {canTrend && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
            <LineChart className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              Trend over time
            </span>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
            >
              {open ? "Hide" : "Show"}
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </button>
          </div>

          {open && (
            <ComparativeChart
              series={series}
              labels={labels}
              valueFormat={valueFormat}
              axisFormat={axisFormat}
            />
          )}
        </div>
      )}
    </div>
  );
}
