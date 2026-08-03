"use client";

/**
 * Shared page chrome for every Compare view: the frosted Toolbar (multi-select +
 * attainment filter | spinner + range control) above a ReportCardShell holding
 * the rich table and trend.
 *
 * Reusing ReportCardShell means the compare card inherits the exact dim-not-flash
 * behaviour of the overview cards — it fades on EITHER a local window refetch
 * (isFetching) OR a selection change (navigationPendingStore, via the shell's
 * useNavigationPending). The metric components differ only in the meta + series
 * they hand in, so this owns all the layout.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
  ToolbarSpinner,
} from "@/components/toolbar";
import { ReportCardShell } from "./report-card-shell";
import {
  ReportEmployeeMultiSelect,
  type MultiOption,
} from "./report-employee-multi-select";

export function ComparativeShell({
  icon,
  title,
  description,
  employees,
  selectedIds,
  isAllScope,
  attainmentControl,
  rangeControl,
  windowLabel,
  isFetching,
  visibleCount,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  employees: MultiOption[];
  selectedIds: string[];
  isAllScope: boolean;
  /** The metric's AttainmentFilter — omitted for metrics with no % measure. */
  attainmentControl?: ReactNode;
  /** The metric's MetricRangeFilter (daily or monthly). */
  rangeControl: ReactNode;
  /** Human window label, shown as a chip once a selection exists. */
  windowLabel: string;
  isFetching: boolean;
  /** Employees surviving the attainment filter — drives the "N of M" chip. */
  visibleCount?: number;
  children: ReactNode;
}) {
  const hasSelection = selectedIds.length > 0;
  const filtered =
    visibleCount !== undefined && visibleCount !== selectedIds.length;

  return (
    <div className="space-y-5">
      <Toolbar>
        <ToolbarGroup>
          <ReportEmployeeMultiSelect
            employees={employees}
            selectedIds={selectedIds}
            isAllScope={isAllScope}
          />
          {attainmentControl}
        </ToolbarGroup>
        <ToolbarGroup className="ml-auto">
          <ToolbarSpinner show={isFetching && hasSelection} />
          <ToolbarSeparator />
          {rangeControl}
        </ToolbarGroup>
      </Toolbar>

      <ReportCardShell
        icon={icon}
        title={title}
        description={description}
        isFetching={isFetching}
        headerRight={
          hasSelection ? (
            <div className="flex items-center gap-2">
              {filtered && (
                <span className="inline-flex items-center rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-xs font-medium tabular-nums text-indigo-700">
                  {visibleCount} of {selectedIds.length} shown
                </span>
              )}
              <span className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1 text-xs font-medium tabular-nums text-slate-600">
                {windowLabel}
              </span>
            </div>
          ) : null
        }
      >
        {children}
      </ReportCardShell>
    </div>
  );
}

/** Centered prompt shown before any employees are picked. */
export function ComparativeSelectPrompt() {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium text-slate-600">
        Pick employees to compare
      </p>
      <p className="max-w-xs text-sm text-slate-400">
        Choose up to eight people from the selector above to see them ranked
        head to head for this metric.
      </p>
    </div>
  );
}

/** Shown when the attainment filter excludes every selected employee. */
export function ComparativeNoMatch({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex h-[280px] flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm font-medium text-slate-600">
        No one matches this attainment band
      </p>
      <p className="max-w-sm text-sm text-slate-400">
        Every selected employee falls outside the threshold for this window.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800"
      >
        Clear attainment filter
      </button>
    </div>
  );
}
