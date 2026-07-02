"use client";

/**
 * Tour — MONTHLY (per city).
 *
 * Chart choice: RADAR across cities (actual vs target days) — tour data is a
 * profile over a categorical set, and a radar shows coverage "shape" and gaps
 * at a glance. It only reads well for a handful of spokes, so we fall back to
 * a horizontal grouped BAR when there are fewer than 3 or more than 8 cities.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  XAxis,
  YAxis,
} from "recharts";
import { Route } from "lucide-react";
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
  fetchTourSeries,
  tourSeriesQueryKey,
} from "../_lib/fetch-tour-series";
import { defaultMonthlyWindow, type MonthlyWindow } from "../_lib/report-ranges";
import { fmtDays } from "../_lib/report-format";

const config = {
  actual: { label: "Actual days", color: "#6366f1" },
  target: { label: "Target days", color: "#94a3b8" },
} satisfies ChartConfig;

export function TourCard({
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
    queryKey: tourSeriesQueryKey(params),
    queryFn: () => fetchTourSeries(supabase, params),
    placeholderData: keepPreviousData,
  });

  const chartData = useMemo(
    () =>
      (data?.cities ?? []).map((c) => ({
        city: c.city,
        actual: c.actual,
        target: c.target,
      })),
    [data],
  );
  const cities = data?.cities ?? [];
  const useRadar = cities.length >= 3 && cities.length <= 8;

  return (
    <ReportCardShell
      title="Tour Coverage"
      description="Tour days by city, actual vs planned"
      icon={Route}
      className="lg:col-span-3"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : chartData.length === 0 ? (
        <ReportCardEmpty message="No tours logged in this range." />
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
            {useRadar ? (
              <RadarChart data={chartData} margin={{ top: 8, bottom: 8 }}>
                <ChartTooltip content={<ChartTooltipContent />} />
                <PolarGrid />
                <PolarAngleAxis dataKey="city" />
                <Radar
                  dataKey="target"
                  stroke="var(--color-target)"
                  fill="var(--color-target)"
                  fillOpacity={0.12}
                />
                <Radar
                  dataKey="actual"
                  stroke="var(--color-actual)"
                  fill="var(--color-actual)"
                  fillOpacity={0.4}
                />
                <ChartLegend content={<ChartLegendContent />} />
              </RadarChart>
            ) : (
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 4, right: 8, top: 4 }}
              >
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => fmtDays(Number(v))}
                />
                <YAxis
                  type="category"
                  dataKey="city"
                  width={80}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="actual" fill="var(--color-actual)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="target" fill="var(--color-target)" radius={[0, 4, 4, 0]} />
                <ChartLegend content={<ChartLegendContent />} />
              </BarChart>
            )}
          </ChartContainer>

          <StatRow>
            <StatItem
              label="Cities covered"
              value={`${data.totals.citiesCovered} / ${data.totals.citiesPlanned}`}
            />
            <StatItem
              label="Actual days"
              value={fmtDays(data.totals.actual)}
            />
            <StatItem
              label="Target days"
              value={fmtDays(data.totals.target)}
            />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}
