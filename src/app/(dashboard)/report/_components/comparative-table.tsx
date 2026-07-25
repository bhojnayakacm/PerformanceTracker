"use client";

/**
 * The rich comparative breakdown — the primary artefact of every Compare view.
 *
 * A real data table, not a card grid: management reads these numbers COLUMN-wise
 * ("who dispatched the most?"), and only a table keeps figures in aligned,
 * scannable columns. Columns come from the metric's CompareColumn[] spec, so
 * this one component serves all six metrics.
 *
 * How it stays uncluttered at eight employees × ten columns:
 *   • the identity cell (rank + colour dot + name) is STICKY on the left, so a
 *     horizontal scroll never separates a number from whose number it is;
 *   • every header is a sort control (headline column desc by default), which
 *     is how you answer "who's bottom on calls?" without reading all 8 rows;
 *   • numbers are tabular-nums and right-aligned so digits line up vertically;
 *   • one team-total footer row closes the table, using each column's own
 *     aggregate (rate columns re-derive rather than averaging percentages).
 *
 * Colour stays bound to the employee's selection slot, never to rank — sorting
 * reorders rows but never repaints a dot.
 */

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  attainmentStatus,
  fmtPct,
  STATUS_TEXT,
} from "../_lib/report-format";
import {
  sumColumn,
  type CompareColumn,
  type ComparativeSeries,
} from "../_lib/comparative";

const STATUS_BAR: Record<"green" | "amber" | "red" | "neutral", string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  neutral: "bg-slate-300",
};

export function ComparativeTable({
  series,
  columns,
}: {
  series: ComparativeSeries[];
  columns: CompareColumn[];
}) {
  const headlineKey = useMemo(
    () => columns.find((c) => c.emphasis)?.key ?? columns[0]?.key ?? "",
    [columns],
  );
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>(() => ({
    key: headlineKey,
    dir: "desc",
  }));

  const byKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );

  const rows = useMemo(() => {
    const col = byKey.get(sort.key);
    if (!col) return series;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...series].sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      // Nulls always sink, regardless of direction.
      if (av === null && bv === null) return a.name.localeCompare(b.name);
      if (av === null) return 1;
      if (bv === null) return -1;
      return av === bv ? a.name.localeCompare(b.name) : (av - bv) * dir;
    });
  }, [series, sort, byKey]);

  const toggleSort = (key: string) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <div className="overflow-x-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th
                scope="col"
                className="sticky left-0 z-20 border-r border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400 backdrop-blur"
              >
                Employee
              </th>
              {columns.map((c) => (
                <SortableHeader
                  key={c.key}
                  column={c}
                  sort={sort}
                  onSort={() => toggleSort(c.key)}
                />
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((s, i) => (
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
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: s.color }}
                    />
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
            ))}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50/80">
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 backdrop-blur"
              >
                Team total
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

function SortableHeader({
  column,
  sort,
  onSort,
}: {
  column: CompareColumn;
  sort: { key: string; dir: "asc" | "desc" };
  onSort: () => void;
}) {
  const active = sort.key === column.key;
  const Icon = !active ? ChevronsUpDown : sort.dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={active ? (sort.dir === "desc" ? "descending" : "ascending") : "none"}
      className="px-3 py-2.5 text-right"
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
            active
              ? "opacity-100"
              : "opacity-0 group-hover/sort:opacity-60",
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
  if (value === null) {
    return (
      <td className="px-3 py-2.5 text-right text-xs tabular-nums text-slate-300">
        —
      </td>
    );
  }

  if (column.variant === "attainment") {
    const status = attainmentStatus(value);
    return (
      <td className="px-3 py-2.5 text-right">
        <span className="flex flex-col items-end gap-1">
          <span
            className={cn(
              "text-xs font-semibold tabular-nums",
              STATUS_TEXT[status],
            )}
          >
            {fmtPct(value)}
          </span>
          <span className="h-1 w-14 overflow-hidden rounded-full bg-slate-100">
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
      )}
    >
      {column.format(value)}
    </td>
  );
}
