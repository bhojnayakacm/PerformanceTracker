"use client";

/**
 * Conversion — MONTHLY (ratio).
 *
 * Chart choice: RADIAL GAUGE. Conversion is a bounded efficiency ratio
 * (conversions ÷ client visits, 0–100%), NOT a volume. A dial encodes a
 * single proportion honestly and side-steps the volume-confound you'd get
 * plotting raw counts. The window aggregate (Σconversions ÷ Σvisits) is the
 * statistically correct summary; the raw counts sit in the footer.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { PolarAngleAxis, RadialBar, RadialBarChart } from "recharts";
import { Target } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
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
import { fmtNum, fmtPct } from "../_lib/report-format";

const config = {
  rate: { label: "Conversion", color: "#6366f1" },
} satisfies ChartConfig;

export function ConversionCard({
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

  const totals = useMemo(() => {
    const pts = data?.points ?? [];
    return {
      conversions: pts.reduce((s, p) => s + p.conversions, 0),
      visits: pts.reduce((s, p) => s + p.clientVisits, 0),
    };
  }, [data]);

  const rate = totals.visits > 0 ? (totals.conversions / totals.visits) * 100 : null;
  const clamped = Math.min(rate ?? 0, 100);

  return (
    <ReportCardShell
      title="Conversion"
      description="Conversions per client visit"
      icon={Target}
      className="lg:col-span-2"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : (data?.points ?? []).length === 0 ? (
        <ReportCardEmpty message="No visits recorded in this range." />
      ) : (
        <>
          <div className="relative">
            <ChartContainer config={config} className="mx-auto aspect-square h-[220px]">
              <RadialBarChart
                data={[{ value: clamped }]}
                startAngle={90}
                endAngle={-270}
                innerRadius={80}
                outerRadius={112}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  tick={false}
                  axisLine={false}
                />
                <RadialBar
                  dataKey="value"
                  cornerRadius={12}
                  fill="var(--color-rate)"
                  background={{ fill: "#eef2ff" }}
                />
              </RadialBarChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-bold tracking-tight text-slate-900">
                {rate === null ? "—" : `${Math.round(rate)}%`}
              </span>
              <span className="mt-1 text-xs font-medium text-slate-500">
                {rate === null ? "no visits" : "conversion rate"}
              </span>
            </div>
          </div>

          <StatRow>
            <StatItem label="Conversions" value={fmtNum(totals.conversions)} />
            <StatItem label="Client visits" value={fmtNum(totals.visits)} />
            <StatItem label="Rate" value={fmtPct(rate)} />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}
