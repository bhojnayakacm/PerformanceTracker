"use client";

/**
 * Compare · Tour. Tour has no cross-employee time axis worth plotting — the
 * comparison is "who covered more of their plan" — so this is a totals-only
 * view: the rich table alone, no trend (ComparativeViews skips it when there's
 * no axis). Series are built directly (one totals row per employee) rather than
 * through buildSeries, which is axis-oriented.
 *
 * City coverage gets its own column pair (covered vs planned) plus a derived
 * coverage % — an employee can hit their day-count on two cities while skipping
 * four, and management needs to see that split.
 */

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Route } from "lucide-react";
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
  comparativeTourQueryKey,
  fetchComparativeTour,
} from "../../_lib/fetch-comparative-tour";
import {
  defaultMonthlyWindow,
  monthlyWindowLabel,
  type MonthlyWindow,
} from "../../_lib/report-ranges";
import { useCompareSort } from "../../_lib/use-compare-sort";
import { monthlyPeriodSlug } from "../../_lib/compare-export";
import {
  applyAttainmentFilter,
  attainmentRangeLabel,
  ATTAINMENT_ALL,
  sumColumn,
  teamAttainment,
  type AttainmentRange,
  type CompareColumn,
  type ComparativeSeries,
} from "../../_lib/comparative";
import { fmtDays, fmtNum } from "../../_lib/report-format";

const fmtDayValue = (n: number) => `${fmtDays(n)} d`;

/** Cities covered ÷ cities planned, across a set of employees. */
const teamCoverage = (all: ComparativeSeries[]): number | null => {
  const planned = sumColumn(all, (s) => s.stats.citiesPlanned);
  if (planned <= 0) return null;
  return (sumColumn(all, (s) => s.stats.citiesCovered) / planned) * 100;
};

const COLUMNS: CompareColumn[] = [
  {
    key: "actualDays",
    label: "Tour days",
    value: (s) => s.total,
    format: fmtDayValue,
    emphasis: true,
  },
  {
    key: "targetDays",
    label: "Target days",
    value: (s) => s.target,
    format: fmtDayValue,
  },
  {
    key: "attainment",
    label: "Attainment",
    value: (s) => s.attainment,
    format: (n) => `${n.toFixed(1)}%`,
    variant: "attainment",
    total: teamAttainment,
  },
  {
    key: "citiesCovered",
    label: "Cities covered",
    value: (s) => s.stats.citiesCovered,
    format: fmtNum,
  },
  {
    key: "citiesPlanned",
    label: "Cities planned",
    value: (s) => s.stats.citiesPlanned,
    format: fmtNum,
  },
  {
    key: "coverage",
    label: "City coverage",
    value: (s) =>
      s.stats.citiesPlanned > 0
        ? (s.stats.citiesCovered / s.stats.citiesPlanned) * 100
        : null,
    format: (n) => `${n.toFixed(0)}%`,
    total: teamCoverage,
  },
];

export function TourCompare({
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
  const [window, setWindow] = useState<MonthlyWindow>(() =>
    defaultMonthlyWindow(),
  );
  const [attainment, setAttainment] = useState<AttainmentRange>(ATTAINMENT_ALL);

  const params = { employeeIds: selectedIds, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: comparativeTourQueryKey(params),
    queryFn: () => fetchComparativeTour(supabase, params),
    placeholderData: keepPreviousData,
    enabled: selectedIds.length > 0,
  });

  const series = useMemo<ComparativeSeries[]>(() => {
    if (!data) return [];
    const byId = new Map(data.rows.map((r) => [r.employeeId, r]));
    const metaById = new Map(employees.map((e) => [e.id, e]));
    // No cap — the table ranks the whole selection. Tour has no trend chart, so
    // no plotted subset and no colour allocation are needed here at all.
    return selectedIds.map((id, i) => {
      const row = byId.get(id);
      const meta = metaById.get(id);
      const actual = row?.actualDays ?? 0;
      const target = row?.targetDays ?? 0;
      return {
        key: `e${i}`,
        employeeId: id,
        name: meta?.name ?? "Unknown",
        empId: meta?.emp_id ?? "",
        points: [],
        total: actual,
        target,
        stats: {
          citiesCovered: row?.citiesCovered ?? 0,
          citiesPlanned: row?.citiesPlanned ?? 0,
        },
        attainment: target > 0 ? (actual / target) * 100 : null,
      };
    });
  }, [data, selectedIds, employees]);

  const visible = useMemo(
    () => applyAttainmentFilter(series, attainment),
    [series, attainment],
  );

  // Sort is owned here so the table and the toolbar's Export read the same
  // ordered array (Tour has no trend chart to auto-plot).
  const { sort, onSort, sortSeries } = useCompareSort(COLUMNS);
  const rows = useMemo(() => sortSeries(visible), [sortSeries, visible]);

  const body =
    selectedIds.length === 0 ? (
      <ComparativeSelectPrompt />
    ) : !data ? (
      <ReportChartSkeleton height={280} />
    ) : data.rows.length === 0 ? (
      <ReportCardEmpty message="No tour days logged for anyone in this range." />
    ) : visible.length === 0 ? (
      <ComparativeNoMatch onClear={() => setAttainment(ATTAINMENT_ALL)} />
    ) : (
      <ComparativeViews
        series={rows}
        sort={sort}
        onSort={onSort}
        columns={COLUMNS}
        labels={[]}
        showTrend={false}
        valueFormat={fmtDayValue}
      />
    );

  return (
    <ComparativeShell
      icon={Route}
      title="Compare · Tour"
      description="Tour-day attainment & city coverage, head to head"
      employees={employees}
      selectedIds={selectedIds}
      isAllScope={isAllScope}
      isFetching={isFetching}
      visibleCount={visible.length}
      windowLabel={monthlyWindowLabel(window)}
      attainmentControl={
        <AttainmentFilter value={attainment} onChange={setAttainment} />
      }
      exportControl={
        <ComparativeExportButton
          disabled={rows.length === 0}
          getPayload={() => ({
            metricTitle: "Compare · Tour",
            metricSlug: "Tour",
            periodSlug: monthlyPeriodSlug(window),
            windowLabel: monthlyWindowLabel(window),
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
          mode="monthly"
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
