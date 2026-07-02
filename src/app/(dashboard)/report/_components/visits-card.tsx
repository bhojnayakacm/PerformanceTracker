"use client";

/**
 * Visits — MONTHLY (client visits).
 *
 * Chart choice: LINE, actual vs target. Client visits are a single continuous
 * measure paced against a monthly target; a line conveys trajectory/pacing
 * better than bars and keeps this card visually distinct from the stacked
 * dispatch/meetings cards. (This is client visits — site visits live in the
 * Meetings card, matching how the schema separates the two.)
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { MapPin } from "lucide-react";
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
  actual: { label: "Client visits", color: "#6366f1" },
  target: { label: "Target", color: "#94a3b8" },
} satisfies ChartConfig;

export function VisitsCard({
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
        actual: p.clientVisits,
        target: p.targetClientVisits,
      })),
    [data],
  );

  const totals = useMemo(() => {
    const pts = data?.points ?? [];
    return {
      actual: pts.reduce((s, p) => s + p.clientVisits, 0),
      target: pts.reduce((s, p) => s + p.targetClientVisits, 0),
    };
  }, [data]);

  const attainment =
    totals.target > 0 ? (totals.actual / totals.target) * 100 : null;
  const status = attainmentStatus(attainment);

  return (
    <ReportCardShell
      title="Client Visits"
      description="Monthly client visits vs target"
      icon={MapPin}
      className="lg:col-span-3"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : chartData.length === 0 ? (
        <ReportCardEmpty message="No client visits recorded in this range." />
      ) : (
        <>
          <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
            <LineChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
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
                width={32}
                tickFormatter={(v) => fmtCompact(Number(v))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line
                dataKey="actual"
                type="monotone"
                stroke="var(--color-actual)"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
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
            </LineChart>
          </ChartContainer>

          <StatRow>
            <StatItem label="Visits" value={fmtNum(totals.actual)} />
            <StatItem label="Target" value={fmtNum(totals.target)} />
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
