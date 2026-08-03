"use client";

/**
 * The trend layer of a Compare view — a multi-line time series, one line per
 * PLOTTED employee, shown BELOW the rich breakdown table (management reads the
 * numbers first; the shape of the month is supporting context).
 *
 * Receives only the ≤MAX_PLOTTED series the parent selected via auto/pinning,
 * so this component never has to think about the cap. The legend is interactive:
 * clicking a name mutes that line, so someone comparing the full eight can
 * isolate two without changing the pins, the table, or the URL.
 *
 * Colour arrives as `colorById`, allocated per plotted employee by the parent —
 * this component never assigns it, so muting or re-sorting never repaints a
 * survivor.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
} from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { fmtCompact } from "../_lib/report-format";
import { toChartRows, type ComparativeSeries } from "../_lib/comparative";

export function ComparativeChart({
  series,
  labels,
  colorById,
  valueFormat,
  axisFormat = fmtCompact,
}: {
  /** The plotted subset, in colour-slot order. */
  series: ComparativeSeries[];
  labels: string[];
  colorById: Map<string, string>;
  /** Formats a value in the tooltip (e.g. "₹1.2L", "12.5%"). */
  valueFormat: (n: number) => string;
  /** Formats a y-axis tick (compact by default). */
  axisFormat?: (n: number) => string;
}) {
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());

  // Reset muting when the compared set changes — slot keys are reused (e0…),
  // so a stale hidden key could otherwise mute the wrong new employee.
  const identity = series.map((s) => s.employeeId).join(",");
  useEffect(() => setHidden(new Set()), [identity]);

  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const config = useMemo(() => {
    const c: ChartConfig = {};
    for (const s of series) {
      c[s.key] = { label: s.name, color: colorById.get(s.employeeId) };
    }
    return c;
  }, [series, colorById]);

  // Series-key → name/colour lookups for the custom tooltip (payload is keyed by
  // the Recharts dataKey, e0…, not by employee).
  const nameByKey = useMemo(
    () => new Map(series.map((s) => [s.key, s.name])),
    [series],
  );
  const colorByKey = useMemo(
    () =>
      new Map(
        series.map((s) => [s.key, colorById.get(s.employeeId) ?? "#94a3b8"]),
      ),
    [series, colorById],
  );

  const rows = useMemo(() => toChartRows(series, labels), [series, labels]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {series.map((s) => {
          const off = hidden.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggle(s.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                off
                  ? "border-slate-200 bg-white text-slate-400"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
              )}
              aria-pressed={!off}
            >
              <span
                className="h-2.5 w-2.5 rounded-full transition-opacity"
                style={{
                  background: colorById.get(s.employeeId),
                  opacity: off ? 0.3 : 1,
                }}
              />
              <span className={cn(off && "line-through")}>{s.name}</span>
            </button>
          );
        })}
      </div>

      <ChartContainer config={config} className="aspect-auto h-[260px] w-full">
        <LineChart data={rows} margin={{ left: 4, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={40}
            tickFormatter={(v) => axisFormat(Number(v))}
          />
          <ChartTooltip
            content={
              <ComparativeTooltip
                valueFormat={valueFormat}
                nameByKey={nameByKey}
                colorByKey={colorByKey}
              />
            }
          />
          {series.map((s) =>
            hidden.has(s.key) ? null : (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            ),
          )}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

/**
 * Custom trend tooltip. The shadcn default renders every value through a bare
 * `toLocaleString()`, which drops the metric's unit — wrong for a suite where a
 * point can be ₹ (Costing) or % (Conversion). This routes each value through the
 * page's own `valueFormat` instead, resolves the employee name/colour from the
 * slot key, and sorts the hovered employees descending so the leader reads first.
 */
function ComparativeTooltip({
  active,
  payload,
  label,
  valueFormat,
  nameByKey,
  colorByKey,
}: ComponentProps<typeof ChartTooltip> & {
  // Recharts injects these from context, so they're omitted from the Tooltip
  // prop type — add them back (the same shape shadcn's own content type does).
  payload?: Array<{
    dataKey?: string | number;
    value?: number | string;
    color?: string;
  }>;
  label?: string | number;
  valueFormat: (n: number) => string;
  nameByKey: Map<string, string>;
  colorByKey: Map<string, string>;
}) {
  if (!active || !payload?.length) return null;

  const rows = [...payload]
    .filter((p) => p.value != null)
    .sort((a, b) => Number(b.value) - Number(a.value));

  return (
    <div className="grid min-w-44 max-w-64 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-2 text-xs shadow-xl">
      {label != null && (
        <div className="font-medium text-foreground">{label}</div>
      )}
      <div className="grid gap-1">
        {rows.map((p, i) => {
          const key = String(p.dataKey ?? i);
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                style={{ background: colorByKey.get(key) ?? p.color }}
              />
              <span className="flex-1 truncate text-muted-foreground">
                {nameByKey.get(key) ?? key}
              </span>
              <span className="font-mono font-medium tabular-nums text-foreground">
                {valueFormat(Number(p.value))}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
