"use client";

/**
 * Costing — MONTHLY (composition).
 *
 * Chart choice: DONUT. Total costing is a parts-to-whole of salary + TA/DA +
 * incentive + vendor (the exact terms of the generated total_costing column),
 * and a donut is the canonical composition-at-a-glance for a single aggregate.
 * sales_promotion is tracked but EXCLUDED from the total, so it sits in the
 * footer rather than the ring — keeping the chart faithful to the DB formula.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Cell, Pie, PieChart } from "recharts";
import { Wallet } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  ReportCardShell,
  ReportCardEmpty,
  ReportChartSkeleton,
  StatItem,
  StatRow,
} from "./report-card-shell";
import { MetricRangeFilter } from "./metric-range-filter";
import {
  fetchMonthlySeries,
  monthlySeriesQueryKey,
} from "../_lib/fetch-monthly-series";
import { defaultMonthlyWindow, type MonthlyWindow } from "../_lib/report-ranges";
import { fmtINR, fmtINRCompact } from "../_lib/report-format";

const ITEMS = [
  { key: "salary", label: "Salary", color: "#6366f1" },
  { key: "tada", label: "TA/DA", color: "#8b5cf6" },
  { key: "incentive", label: "Incentive", color: "#0ea5e9" },
  { key: "vendor", label: "Vendor", color: "#f59e0b" },
] as const;

const config = {
  salary: { label: "Salary", color: "#6366f1" },
  tada: { label: "TA/DA", color: "#8b5cf6" },
  incentive: { label: "Incentive", color: "#0ea5e9" },
  vendor: { label: "Vendor", color: "#f59e0b" },
} satisfies ChartConfig;

export function CostingCard({
  employeeId,
  userId,
}: {
  employeeId: string;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [window, setWindow] = useState<MonthlyWindow>(() =>
    defaultMonthlyWindow(),
  );

  const params = { employeeId, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: monthlySeriesQueryKey(params),
    queryFn: () => fetchMonthlySeries(supabase, params),
    placeholderData: keepPreviousData,
  });

  const sums = useMemo(() => {
    const pts = data?.points ?? [];
    return {
      salary: pts.reduce((s, p) => s + p.salary, 0),
      tada: pts.reduce((s, p) => s + p.tada, 0),
      incentive: pts.reduce((s, p) => s + p.incentive, 0),
      vendor: pts.reduce((s, p) => s + p.vendor, 0),
      total: pts.reduce((s, p) => s + p.totalCosting, 0),
      salesPromotion: pts.reduce((s, p) => s + p.salesPromotion, 0),
    };
  }, [data]);

  const pieData = useMemo(
    () =>
      ITEMS.map((it) => ({
        key: it.key,
        label: it.label,
        value: sums[it.key],
      })).filter((d) => d.value > 0),
    [sums],
  );

  return (
    <ReportCardShell
      title="Costing"
      description="Cost composition — salary, TA/DA, incentive, vendor"
      icon={Wallet}
      className="lg:col-span-3"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : sums.total <= 0 ? (
        <ReportCardEmpty message="No costs recorded in this range." />
      ) : (
        <>
          <div className="grid grid-cols-1 items-center gap-4 sm:grid-cols-[190px_1fr]">
            <div className="relative">
              <ChartContainer
                config={config}
                className="mx-auto aspect-square h-[190px]"
              >
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent nameKey="key" hideLabel />}
                  />
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="key"
                    innerRadius={58}
                    outerRadius={86}
                    paddingAngle={2}
                    strokeWidth={2}
                  >
                    {pieData.map((d) => (
                      <Cell key={d.key} fill={`var(--color-${d.key})`} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  {fmtINRCompact(sums.total)}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  total cost
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {ITEMS.map((it) => {
                const val = sums[it.key];
                const pct = sums.total > 0 ? (val / sums.total) * 100 : 0;
                return (
                  <div key={it.key} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: it.color }}
                    />
                    <span className="flex-1 text-slate-600">{it.label}</span>
                    <span className="font-semibold tabular-nums text-slate-800">
                      {fmtINR(val)}
                    </span>
                    <span className="w-9 text-right text-xs tabular-nums text-slate-400">
                      {Math.round(pct)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <StatRow>
            <StatItem label="Total costing" value={fmtINR(sums.total)} />
            <StatItem
              label="Sales promotion (excl.)"
              value={fmtINR(sums.salesPromotion)}
            />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}
