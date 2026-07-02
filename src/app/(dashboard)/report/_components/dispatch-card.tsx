"use client";

/**
 * Dispatch — MONTHLY.
 *
 * Chart choice: STACKED BAR per month (commercial / hotel / project-2 / tile /
 * retail / return) + a dashed target LINE, in a ComposedChart. Months are
 * discrete accounting periods (bars, not area) and dispatched sqft is an
 * additive parts-to-whole of product lines, so a stack shows both total
 * attainment and product mix; the line overlays the monthly target.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Bar, CartesianGrid, ComposedChart, Line, XAxis, YAxis } from "recharts";
import { Truck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
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
import {
  attainmentStatus,
  fmtCompact,
  fmtNum,
  fmtPct,
  STATUS_TEXT,
} from "../_lib/report-format";

const config = {
  commercial: { label: "Commercial", color: "#6366f1" },
  hotel: { label: "Hotel", color: "#8b5cf6" },
  project2: { label: "Project 2", color: "#0ea5e9" },
  tile: { label: "Tile", color: "#14b8a6" },
  retail: { label: "Retail", color: "#f59e0b" },
  returnSqft: { label: "Return", color: "#94a3b8" },
  target: { label: "Target", color: "#334155" },
} satisfies ChartConfig;

export function DispatchCard({
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

  const chartData = useMemo(
    () =>
      (data?.points ?? []).map((p) => ({
        label: p.label,
        commercial: p.commercial,
        hotel: p.hotel,
        project2: p.project2,
        tile: p.tile,
        retail: p.retail,
        returnSqft: p.returnSqft,
        target: p.targetDispatched,
      })),
    [data],
  );

  const totals = useMemo(() => {
    const pts = data?.points ?? [];
    const actual = pts.reduce((s, p) => s + p.dispatched, 0);
    const target = pts.reduce((s, p) => s + p.targetDispatched, 0);
    return { actual, target };
  }, [data]);

  const attainment = totals.target > 0 ? (totals.actual / totals.target) * 100 : null;
  const status = attainmentStatus(attainment);

  return (
    <ReportCardShell
      title="Dispatch"
      description="Dispatched sqft by product line vs target"
      icon={Truck}
      className="lg:col-span-3"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : chartData.length === 0 ? (
        <ReportCardEmpty message="No dispatch recorded in this range." />
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
            <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={36}
                tickFormatter={(v) => fmtCompact(Number(v))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="commercial" stackId="d" fill="var(--color-commercial)" />
              <Bar dataKey="hotel" stackId="d" fill="var(--color-hotel)" />
              <Bar dataKey="project2" stackId="d" fill="var(--color-project2)" />
              <Bar dataKey="tile" stackId="d" fill="var(--color-tile)" />
              <Bar dataKey="retail" stackId="d" fill="var(--color-retail)" />
              <Bar
                dataKey="returnSqft"
                stackId="d"
                fill="var(--color-returnSqft)"
                radius={[3, 3, 0, 0]}
              />
              <Line
                dataKey="target"
                type="monotone"
                stroke="var(--color-target)"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>

          <StatRow>
            <StatItem
              label="Dispatched"
              value={`${fmtNum(totals.actual)} sqft`}
            />
            <StatItem label="Target" value={`${fmtNum(totals.target)} sqft`} />
            <StatItem
              label="Attainment"
              value={fmtPct(attainment)}
              valueClass={STATUS_TEXT[status]}
            />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}
