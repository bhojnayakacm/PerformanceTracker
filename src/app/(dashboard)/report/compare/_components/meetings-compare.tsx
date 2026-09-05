"use client";

/**
 * Compare · Meetings (DAILY tier). Fetches the array meetings RPC, aligns every
 * employee onto one shared time axis via buildSeries, and renders the rich
 * activity breakdown table above the trend.
 *
 * Table columns are the full daily-tier universe: the architect / client / site
 * split, the combined meetings total those three sum to (the headline, and what
 * target_total_meetings is defined over — migration 0004), the target,
 * attainment, and calls with their own target.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Handshake } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ComparativeShell,
  ComparativeSelectPrompt,
  ComparativeNoMatch,
} from "../../_components/comparative-shell";
import { ComparativeViews } from "../../_components/comparative-views";
import { ComparativeExportButton } from "../../_components/comparative-export-button";
import { MetricRangeFilter } from "../../_components/metric-range-filter";
import { AttainmentFilter } from "../../_components/attainment-filter";
import {
  ReportCardEmpty,
  ReportChartSkeleton,
} from "../../_components/report-card-shell";
import type { MultiOption } from "../../_components/report-employee-multi-select";
import {
  comparativeMeetingsQueryKey,
  fetchComparativeMeetings,
  type ComparativeMeetingsRow,
} from "../../_lib/fetch-comparative-meetings";
import {
  dailyWindowLabel,
  defaultDailyWindow,
  formatDailyLabel,
  type DailyWindow,
} from "../../_lib/report-ranges";
import { useCompareSort } from "../../_lib/use-compare-sort";
import { dailyPeriodSlug } from "../../_lib/compare-export";
import {
  applyAttainmentFilter,
  attainmentRangeLabel,
  ATTAINMENT_ALL,
  buildSeries,
  teamAttainment,
  type AttainmentRange,
  type CompareColumn,
} from "../../_lib/comparative";
import { fmtNum } from "../../_lib/report-format";

const sum = (
  rows: ComparativeMeetingsRow[],
  pick: (r: ComparativeMeetingsRow) => number,
) => rows.reduce((s, r) => s + pick(r), 0);

const COLUMNS: CompareColumn[] = [
  { key: "architect", label: "Architect", value: (s) => s.stats.architect, format: fmtNum },
  { key: "client", label: "Client", value: (s) => s.stats.client, format: fmtNum },
  { key: "siteVisits", label: "Site visits", value: (s) => s.stats.siteVisits, format: fmtNum },
  {
    key: "meetings",
    label: "Meetings",
    value: (s) => s.total,
    format: fmtNum,
    emphasis: true,
  },
  { key: "target", label: "Target", value: (s) => s.target, format: fmtNum },
  {
    key: "attainment",
    label: "Attainment",
    value: (s) => s.attainment,
    format: (n) => `${n.toFixed(1)}%`,
    variant: "attainment",
    total: teamAttainment,
  },
  { key: "calls", label: "Calls", value: (s) => s.stats.calls, format: fmtNum },
  {
    key: "targetCalls",
    label: "Call target",
    value: (s) => s.stats.targetCalls,
    format: fmtNum,
  },
];

export function MeetingsCompare({
  employees,
  selectedIds,
  isAllScope,
  userId,
}: {
  employees: MultiOption[];
  selectedIds: string[];
  isAllScope: boolean;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [window, setWindow] = useState<DailyWindow>(() => defaultDailyWindow());
  const [attainment, setAttainment] = useState<AttainmentRange>(ATTAINMENT_ALL);

  const params = { employeeIds: selectedIds, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: comparativeMeetingsQueryKey(params),
    queryFn: () => fetchComparativeMeetings(supabase, params),
    placeholderData: keepPreviousData,
    enabled: selectedIds.length > 0,
  });

  const { series, labels } = useMemo(() => {
    if (!data) return { series: [], labels: [] as string[] };
    return buildSeries({
      rows: data.rows,
      ids: selectedIds,
      employees,
      employeeId: (r) => r.employeeId,
      sortKey: (r) => r.bucketStart,
      label: (r) => formatDailyLabel(r.bucketStart, data.bucket),
      value: (r) => r.meetings,
      reduce: (rows) => ({
        total: sum(rows, (r) => r.meetings),
        target: sum(rows, (r) => r.targetMeetings),
      }),
      stats: (rows) => ({
        architect: sum(rows, (r) => r.architect),
        client: sum(rows, (r) => r.client),
        siteVisits: sum(rows, (r) => r.siteVisits),
        calls: sum(rows, (r) => r.calls),
        targetCalls: sum(rows, (r) => r.targetCalls),
      }),
    });
  }, [data, selectedIds, employees]);

  const visible = useMemo(
    () => applyAttainmentFilter(series, attainment),
    [series, attainment],
  );

  // Sort is owned here so the table, the chart's auto-plot and the toolbar's
  // Export all read the same ordered array.
  const { sort, onSort, sortSeries } = useCompareSort(COLUMNS);
  const rows = useMemo(() => sortSeries(visible), [sortSeries, visible]);

  const body =
    selectedIds.length === 0 ? (
      <ComparativeSelectPrompt />
    ) : !data ? (
      <ReportChartSkeleton height={360} />
    ) : data.rows.length === 0 ? (
      <ReportCardEmpty message="No activity logged for anyone in this range." />
    ) : visible.length === 0 ? (
      <ComparativeNoMatch onClear={() => setAttainment(ATTAINMENT_ALL)} />
    ) : (
      <ComparativeViews
        series={rows}
        sort={sort}
        onSort={onSort}
        columns={COLUMNS}
        labels={labels}
        valueFormat={fmtNum}
      />
    );

  return (
    <ComparativeShell
      icon={Handshake}
      title="Compare · Meetings"
      description="Meetings & field activity, head to head"
      employees={employees}
      selectedIds={selectedIds}
      isAllScope={isAllScope}
      isFetching={isFetching}
      visibleCount={visible.length}
      windowLabel={dailyWindowLabel(window)}
      attainmentControl={
        <AttainmentFilter value={attainment} onChange={setAttainment} />
      }
      exportControl={
        <ComparativeExportButton
          disabled={rows.length === 0}
          getPayload={() => ({
            metricTitle: "Compare · Meetings",
            metricSlug: "Meetings",
            periodSlug: dailyPeriodSlug(window),
            windowLabel: dailyWindowLabel(window),
            columns: COLUMNS,
            series: rows,
            scopeLabel: isAllScope
              ? "All employees (" + employees.length + ")"
              : selectedIds.length + " selected",
            filterLabel: attainmentRangeLabel(attainment),
          })}
        />
      }
      rangeControl={
        <MetricRangeFilter
          mode="daily"
          window={window}
          onChange={setWindow}
          triggerClassName="h-9 text-sm"
        />
      }
    >
      {body}
    </ComparativeShell>
  );
}
