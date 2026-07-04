"use client";

/**
 * Meetings & Field Activity — DAILY tier.
 *
 * Chart choice: stacked AREA (architect / client / site visits) + a dashed
 * target LINE, in a ComposedChart. Daily activity is a continuous, additive
 * flow, so an area over an ordered time axis shows both total volume and the
 * mix evolving; the line marks the target the three actuals are measured
 * against (target_total_meetings is defined over exactly those three).
 *
 * A segmented toggle above the chart isolates a single type ("All" stacks
 * them together and shows the target; the individual views drop the target
 * line, since there's no per-type target). The footer always reports each
 * type's total for the selected window regardless of the chart view.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";
import { Handshake } from "lucide-react";
import { cn } from "@/lib/utils";
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
  fetchMeetingsSeries,
  meetingsSeriesQueryKey,
} from "../_lib/fetch-meetings-series";
import {
  defaultDailyWindow,
  formatDailyLabel,
  type DailyWindow,
} from "../_lib/report-ranges";
import {
  attainmentStatus,
  fmtCompact,
  fmtNum,
  fmtPct,
  STATUS_TEXT,
} from "../_lib/report-format";

const config = {
  architect: { label: "Architect", color: "#6366f1" },
  client: { label: "Client", color: "#8b5cf6" },
  siteVisits: { label: "Site visits", color: "#0ea5e9" },
  target: { label: "Target", color: "#334155" },
} satisfies ChartConfig;

type MeetingView = "all" | "architect" | "client" | "site";

const VIEWS: { key: MeetingView; label: string }[] = [
  { key: "all", label: "All" },
  { key: "architect", label: "Architect" },
  { key: "client", label: "Client" },
  { key: "site", label: "Site" },
];

function MeetingViewToggle({
  value,
  onChange,
}: {
  value: MeetingView;
  onChange: (v: MeetingView) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
      {VIEWS.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => onChange(v.key)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === v.key
              ? "bg-white text-indigo-700 shadow-sm"
              : "text-slate-500 hover:text-slate-700",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  );
}

export function MeetingsCard({
  employeeId,
  userId,
}: {
  employeeId: string;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [window, setWindow] = useState<DailyWindow>(() => defaultDailyWindow());
  const [view, setView] = useState<MeetingView>("all");

  const params = { employeeId, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: meetingsSeriesQueryKey(params),
    queryFn: () => fetchMeetingsSeries(supabase, params),
    placeholderData: keepPreviousData,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.points.map((p) => ({
      label: formatDailyLabel(p.bucketStart, data.bucket),
      architect: p.architect,
      client: p.client,
      siteVisits: p.siteVisits,
      target: p.targetMeetings,
    }));
  }, [data]);

  const attainment =
    data && data.totals.targetMeetings > 0
      ? (data.totals.meetings / data.totals.targetMeetings) * 100
      : null;
  const status = attainmentStatus(attainment);

  const showArchitect = view === "all" || view === "architect";
  const showClient = view === "all" || view === "client";
  const showSite = view === "all" || view === "site";

  return (
    <ReportCardShell
      title="Meetings & Field Activity"
      description="Architect + client meetings and site visits"
      icon={Handshake}
      className="lg:col-span-4"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="daily" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : chartData.length === 0 ? (
        <ReportCardEmpty message="No activity logged in this range." />
      ) : (
        <>
          <div className="mb-3">
            <MeetingViewToggle value={view} onChange={setView} />
          </div>

          <ChartContainer config={config} className="aspect-auto h-[240px] w-full">
            <ComposedChart data={chartData} margin={{ left: 4, right: 8, top: 8 }}>
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
                width={32}
                tickFormatter={(v) => fmtCompact(Number(v))}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              {showArchitect && (
                <Area
                  dataKey="architect"
                  stackId="a"
                  type="monotone"
                  stroke="var(--color-architect)"
                  fill="var(--color-architect)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {showClient && (
                <Area
                  dataKey="client"
                  stackId="a"
                  type="monotone"
                  stroke="var(--color-client)"
                  fill="var(--color-client)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {showSite && (
                <Area
                  dataKey="siteVisits"
                  stackId="a"
                  type="monotone"
                  stroke="var(--color-siteVisits)"
                  fill="var(--color-siteVisits)"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              )}
              {view === "all" && (
                <Line
                  dataKey="target"
                  type="monotone"
                  stroke="var(--color-target)"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={false}
                />
              )}
              <ChartLegend content={<ChartLegendContent />} />
            </ComposedChart>
          </ChartContainer>

          <StatRow>
            <StatItem label="Architect" value={fmtNum(data.totals.architect)} />
            <StatItem label="Client" value={fmtNum(data.totals.client)} />
            <StatItem label="Site visits" value={fmtNum(data.totals.siteVisits)} />
            <span
              className="hidden h-8 w-px self-center bg-slate-200 sm:block"
              aria-hidden
            />
            <StatItem label="Meetings" value={fmtNum(data.totals.meetings)} />
            <StatItem
              label="Target"
              value={fmtNum(data.totals.targetMeetings)}
            />
            <StatItem
              label="Attainment"
              value={fmtPct(attainment)}
              valueClass={STATUS_TEXT[status]}
            />
            <StatItem label="Calls" value={fmtNum(data.totals.calls)} />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}
