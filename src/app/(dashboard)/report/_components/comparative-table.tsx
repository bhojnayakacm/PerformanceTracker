"use client";

/**
 * The rich comparative breakdown — the primary artefact of every Compare view.
 *
 * A real data table, not a card grid: management reads these numbers COLUMN-wise
 * ("who dispatched the most?"), and only a table keeps figures in aligned,
 * scannable columns. Columns come from the metric's CompareColumn[] spec, so
 * this one component serves all six metrics.
 *
 * How it stays uncluttered at 100+ employees × 10 columns:
 *   • the header row is STICKY to the top and the team-total row STICKY to the
 *     bottom, so both stay readable while the body scrolls — you never lose which
 *     column you're in or what the team figure is;
 *   • the identity cell (pin + name) is STICKY on the left, so a horizontal
 *     scroll never separates a number from whose number it is;
 *   • every header is a sort control, which is how you answer "who's bottom on
 *     calls?" without reading every row;
 *   • numbers are tabular-nums and right-aligned so digits line up vertically.
 *
 * The PIN column is the bridge to the trend chart: a filled colour dot means
 * "plotted, in this colour"; a hollow ring means "in the table only". Colour
 * therefore has one consistent meaning across the whole view. Sorting reorders
 * rows but never repaints a dot — colour belongs to the employee, not the rank.
 */

import { ArrowDown, ArrowUp, ChevronsUpDown, Pin } from "lucide-react";
import { cn } from "@/lib/utils";
import { attainmentStatus, fmtPct, STATUS_TEXT } from "../_lib/report-format";
import { sumColumn, type CompareColumn, type ComparativeSeries } from "../_lib/comparative";
import type { SortState } from "../_lib/use-compare-sort";

const STATUS_BAR: Record<"green" | "amber" | "red" | "neutral", string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-slate-300",
};

export function ComparativeTable({
  series,
  columns,
  sort,
  onSort,
  colorById,
  plottedSet,
  onTogglePin,
  chartFull,
}: {
  /** Already filtered and sorted by the parent. */
  series: ComparativeSeries[];
  columns: CompareColumn[];
  sort: SortState;
  onSort: (key: string) => void;
  colorById: Map<string, string>;
  plottedSet: Set<string>;
  /** Omitted for metrics with no trend chart — hides the pin column entirely. */
  onTogglePin?: (id: string) => void;
  chartFull: boolean;
}) {
  const pinnable = Boolean(onTogglePin);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="max-h-[560px] overflow-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-40 border-b border-r border-slate-200 bg-slate-50/95 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 backdrop-blur"
              >
                <span className="flex items-center gap-1.5">
                  {pinnable && (
                    <Pin
                      className="h-3 w-3 shrink-0 text-slate-400"
                      aria-label="Plotted on chart"
                    />
                  )}
                  Employee
                </span>
              </th>
              {columns.map((c) => (
                <SortableHeader
                  key={c.key}
                  column={c}
                  sort={sort}
                  onSort={() => onSort(c.key)}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {series.map((s, i) => {
              const plotted = plottedSet.has(s.employeeId);
              const color = colorById.get(s.employeeId);
              return (
                <tr
                  key={s.employeeId}
                  className="group border-b border-slate-100 last:border-b-0 hover:bg-slate-50/70"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 border-r border-slate-200 bg-white px-3 py-2.5 text-left font-normal transition-colors group-hover:bg-slate-50 supports-[backdrop-filter]:bg-white/95 supports-[backdrop-filter]:backdrop-blur"
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">
                        {i + 1}
                      </span>

                      {pinnable ? (
                        <PinToggle
                          name={s.name}
                          plotted={plotted}
                          color={color}
                          disabled={!plotted && chartFull}
                          onClick={() => onTogglePin?.(s.employeeId)}
                        />
                      ) : (
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300"
                          aria-hidden
                        />
                      )}

                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-xs font-medium text-slate-800">
                          {s.name}
                        </span>
                        <span className="truncate text-[10px] text-slate-400">
                          {s.subLabel ?? s.empId}
                        </span>
                      </span>
                    </span>
                  </th>

                  {columns.map((c) => (
                    <Cell key={c.key} column={c} value={c.value(s)} />
                  ))}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            <tr>
              <th
                scope="row"
                className="sticky bottom-0 left-0 z-40 border-r border-t-2 border-slate-200 bg-slate-50/95 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 backdrop-blur"
              >
                Team total
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400 tabular-nums">
                  ({series.length})
                </span>
              </th>
              {columns.map((c) => (
                <Cell
                  key={c.key}
                  column={c}
                  value={c.total ? c.total(series) : sumColumn(series, c.value)}
                  footer
                />
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/** Filled colour dot = on the chart; hollow ring = table only. */
function PinToggle({
  name,
  plotted,
  color,
  disabled,
  onClick,
}: {
  name: string;
  plotted: boolean;
  color?: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={plotted}
      title={
        plotted
          ? `${name} is plotted — click to remove from the chart`
          : disabled
            ? "Chart is full — unpin someone first"
            : `Plot ${name} on the chart`
      }
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-all",
        "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
      )}
    >
      <span
        className={cn(
          "h-2.5 w-2.5 rounded-full transition-all",
          !plotted && "ring-1 ring-slate-300 ring-inset",
        )}
        style={plotted && color ? { background: color } : undefined}
      />
      <span className="sr-only">
        {plotted ? "Remove from chart" : "Add to chart"}
      </span>
    </button>
  );
}

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: CompareColumn;
  sort: SortState;
  onSort: () => void;
}) {
  const active = sort.key === column.key;
  const Icon = !active ? ChevronsUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
      className="sticky top-0 z-30 border-b border-slate-200 bg-slate-50/95 px-3 py-2.5 text-right backdrop-blur"
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "group/sort inline-flex w-full items-center justify-end gap-1 text-[10px] font-semibold uppercase tracking-[0.1em] transition-colors",
          active ? "text-indigo-600" : "text-slate-400 hover:text-slate-600",
        )}
      >
        <span className="whitespace-nowrap">{column.label}</span>
        <Icon
          className={cn(
            "h-3 w-3 shrink-0 transition-opacity",
            active ? "opacity-100" : "opacity-0 group-hover/sort:opacity-60",
          )}
        />
      </button>
    </th>
  );
}

function Cell({
  column,
  value,
  footer = false,
}: {
  column: CompareColumn;
  value: number | null;
  footer?: boolean;
}) {
  const base = footer
    ? "sticky bottom-0 z-30 border-t-2 border-slate-200 bg-slate-50/95 backdrop-blur"
    : "";

  if (value === null) {
    return (
      <td
        className={cn(
          "px-3 py-2.5 text-right text-xs tabular-nums text-slate-300",
          base,
        )}
      >
        —
      </td>
    );
  }

  if (column.variant === "attainment") {
    const status = attainmentStatus(value);
    return (
      <td className={cn("px-3 py-2.5 text-right", base)}>
        <span className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              STATUS_TEXT[status],
            )}
          >
            {fmtPct(value)}
          </span>
          <span className="h-1 w-14 overflow-hidden rounded-full bg-slate-200/70">
            <span
              className={cn("block h-full rounded-full", STATUS_BAR[status])}
              style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
            />
          </span>
        </span>
      </td>
    );
  }

  return (
    <td
      className={cn(
        "px-3 py-2.5 text-right text-xs tabular-nums",
        footer
          ? "font-semibold text-slate-700"
          : column.emphasis
            ? "font-semibold text-slate-900"
            : "text-slate-600",
        base,
      )}
    >
      {column.format(value)}
    </td>
  );
}
