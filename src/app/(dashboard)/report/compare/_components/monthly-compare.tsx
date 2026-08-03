"use client";

/**
 * Compare · monthly metrics. ONE component powers FOUR routes (Dispatch, Visits,
 * Conversion, Costing) — they share the wide monthly RPC + query key, so a given
 * window is a single cache entry across all four. A page just passes `measure`;
 * everything metric-specific lives in the MEASURES spec below: the trend field,
 * the window reduction, the rich table's columns, formatting, and which
 * attainment bands (if any) the toolbar filter offers.
 *
 * Two aggregation rules the specs encode, both easy to get wrong:
 *   • Conversion's window figure is Σconversions / Σvisits — NOT the mean of the
 *     monthly rates, which would over-weight quiet months.
 *   • Team-total footers for rate columns re-derive from the underlying sums for
 *     the same reason; only additive columns simply sum.
 */

import { useMemo, useState } from "react";
import { MapPin, Target, Truck, Wallet, type LucideIcon } from "lucide-react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import {
  ComparativeShell,
  ComparativeSelectPrompt,
  ComparativeNoMatch,
} from "../../_components/comparative-shell";
import { ComparativeViews } from "../../_components/comparative-views";
import { MetricRangeFilter } from "../../_components/metric-range-filter";
import { AttainmentFilter } from "../../_components/attainment-filter";
import {
  ReportCardEmpty,
  ReportChartSkeleton,
} from "../../_components/report-card-shell";
import type { MultiOption } from "../../_components/report-employee-multi-select";
import {
  comparativeMonthlyQueryKey,
  fetchComparativeMonthly,
  type ComparativeMonthlyRow,
} from "../../_lib/fetch-comparative-monthly";
import {
  defaultMonthlyWindow,
  formatMonthLabel,
  monthOrd,
  monthlyWindowLabel,
  type MonthlyWindow,
} from "../../_lib/report-ranges";
import {
  applyAttainmentFilter,
  ATTAINMENT_ALL,
  buildSeries,
  CONVERSION_RATE_PRESETS,
  sumColumn,
  teamAttainment,
  type AttainmentPreset,
  type AttainmentRange,
  type CompareColumn,
  type ComparativeSeries,
} from "../../_lib/comparative";
import { fmtINRCompact, fmtNum, fmtPct } from "../../_lib/report-format";

export type MonthlyMeasure = "dispatch" | "visits" | "conversion" | "costing";

const sum = (
  rows: ComparativeMonthlyRow[],
  pick: (r: ComparativeMonthlyRow) => number,
) => rows.reduce((s, r) => s + pick(r), 0);

/** Every monthly measure, summed over the window — one reducer for all four
 *  routes; each measure's columns read the subset they care about. */
const monthlyStats = (rows: ComparativeMonthlyRow[]) => ({
  commercial: sum(rows, (r) => r.commercial),
  hotel: sum(rows, (r) => r.hotel),
  project2: sum(rows, (r) => r.project2),
  tile: sum(rows, (r) => r.tile),
  retail: sum(rows, (r) => r.retail),
  returnSqft: sum(rows, (r) => r.returnSqft),
  netSale: sum(rows, (r) => r.netSale),
  clientVisits: sum(rows, (r) => r.clientVisits),
  targetClientVisits: sum(rows, (r) => r.targetClientVisits),
  conversions: sum(rows, (r) => r.conversions),
  salary: sum(rows, (r) => r.salary),
  tada: sum(rows, (r) => r.tada),
  incentive: sum(rows, (r) => r.incentive),
  vendor: sum(rows, (r) => r.vendor),
  salesPromotion: sum(rows, (r) => r.salesPromotion),
});

const pctFmt = (n: number) => `${n.toFixed(1)}%`;

/** Conversion rate across a set of employees: Σconversions / Σvisits. */
const teamConversionRate = (all: ComparativeSeries[]): number | null => {
  const visits = sumColumn(all, (s) => s.stats.clientVisits);
  if (visits <= 0) return null;
  return (sumColumn(all, (s) => s.stats.conversions) / visits) * 100;
};

const ATTAINMENT_COLUMN: CompareColumn = {
  key: "attainment",
  label: "Attainment",
  value: (s) => s.attainment,
  format: pctFmt,
  variant: "attainment",
  total: teamAttainment,
};

type MeasureSpec = {
  title: string;
  description: string;
  icon: LucideIcon;
  columns: CompareColumn[];
  /** Per-month value for the trend line. */
  value: (r: ComparativeMonthlyRow) => number;
  /** Window reduction → headline total, target, and (optionally) the % filtered on. */
  reduce: (rows: ComparativeMonthlyRow[]) => {
    total: number;
    target: number | null;
    attainment?: number | null;
  };
  valueFormat: (n: number) => string;
  axisFormat?: (n: number) => string;
  /** null → the metric has no % measure, so no filter is offered (Costing). */
  filter: { label: string; presets?: AttainmentPreset[] } | null;
};

const MEASURES: Record<MonthlyMeasure, MeasureSpec> = {
  dispatch: {
    title: "Compare · Dispatch",
    description: "Dispatched sqft by product line vs target, head to head",
    icon: Truck,
    value: (r) => r.dispatched,
    reduce: (rows) => ({
      total: sum(rows, (r) => r.dispatched),
      target: sum(rows, (r) => r.targetDispatched),
    }),
    valueFormat: fmtNum,
    filter: { label: "Attainment" },
    columns: [
      { key: "commercial", label: "Commercial", value: (s) => s.stats.commercial, format: fmtNum },
      { key: "hotel", label: "Hotel", value: (s) => s.stats.hotel, format: fmtNum },
      { key: "project2", label: "Project 2", value: (s) => s.stats.project2, format: fmtNum },
      { key: "tile", label: "Tile", value: (s) => s.stats.tile, format: fmtNum },
      { key: "retail", label: "Retail", value: (s) => s.stats.retail, format: fmtNum },
      { key: "returnSqft", label: "Return", value: (s) => s.stats.returnSqft, format: fmtNum },
      { key: "netSale", label: "Net sale", value: (s) => s.stats.netSale, format: fmtNum },
      {
        key: "dispatched",
        label: "Dispatched",
        value: (s) => s.total,
        format: fmtNum,
        emphasis: true,
      },
      { key: "target", label: "Target", value: (s) => s.target, format: fmtNum },
      ATTAINMENT_COLUMN,
    ],
  },

  visits: {
    title: "Compare · Client Visits",
    description: "Client visits vs target, with what they converted to",
    icon: MapPin,
    value: (r) => r.clientVisits,
    reduce: (rows) => ({
      total: sum(rows, (r) => r.clientVisits),
      target: sum(rows, (r) => r.targetClientVisits),
    }),
    valueFormat: fmtNum,
    filter: { label: "Attainment" },
    columns: [
      {
        key: "visits",
        label: "Visits",
        value: (s) => s.total,
        format: fmtNum,
        emphasis: true,
      },
      { key: "target", label: "Target", value: (s) => s.target, format: fmtNum },
      ATTAINMENT_COLUMN,
      {
        key: "conversions",
        label: "Conversions",
        value: (s) => s.stats.conversions,
        format: fmtNum,
      },
      {
        key: "rate",
        label: "Conv. rate",
        value: (s) =>
          s.stats.clientVisits > 0
            ? (s.stats.conversions / s.stats.clientVisits) * 100
            : null,
        format: pctFmt,
        total: teamConversionRate,
      },
    ],
  },

  conversion: {
    title: "Compare · Conversion",
    description: "Conversion rate — conversions ÷ client visits",
    icon: Target,
    value: (r) => (r.clientVisits > 0 ? (r.conversions / r.clientVisits) * 100 : 0),
    reduce: (rows) => {
      const visits = sum(rows, (r) => r.clientVisits);
      const conversions = sum(rows, (r) => r.conversions);
      const rate = visits > 0 ? (conversions / visits) * 100 : 0;
      // The rate IS this metric's performance %, so it drives the filter too.
      return { total: rate, target: null, attainment: visits > 0 ? rate : null };
    },
    valueFormat: (n) => fmtPct(n),
    axisFormat: (n) => `${Math.round(n)}%`,
    filter: { label: "Conv. rate", presets: CONVERSION_RATE_PRESETS },
    columns: [
      {
        key: "clientVisits",
        label: "Client visits",
        value: (s) => s.stats.clientVisits,
        format: fmtNum,
      },
      {
        key: "conversions",
        label: "Conversions",
        value: (s) => s.stats.conversions,
        format: fmtNum,
      },
      {
        key: "rate",
        label: "Conv. rate",
        value: (s) => s.attainment,
        format: pctFmt,
        emphasis: true,
        total: teamConversionRate,
      },
      {
        key: "missed",
        label: "Not converted",
        value: (s) => s.stats.clientVisits - s.stats.conversions,
        format: fmtNum,
      },
    ],
  },

  costing: {
    title: "Compare · Costing",
    description: "Cost breakdown per employee (₹), head to head",
    icon: Wallet,
    value: (r) => r.totalCosting,
    reduce: (rows) => ({
      total: sum(rows, (r) => r.totalCosting),
      target: null,
    }),
    valueFormat: fmtINRCompact,
    axisFormat: fmtINRCompact,
    // No target and no rate — there is no "performance %" to threshold on.
    filter: null,
    columns: [
      { key: "salary", label: "Salary", value: (s) => s.stats.salary, format: fmtINRCompact },
      { key: "tada", label: "TA/DA", value: (s) => s.stats.tada, format: fmtINRCompact },
      { key: "incentive", label: "Incentive", value: (s) => s.stats.incentive, format: fmtINRCompact },
      { key: "vendor", label: "Vendor", value: (s) => s.stats.vendor, format: fmtINRCompact },
      {
        key: "salesPromotion",
        label: "Sales promo",
        value: (s) => s.stats.salesPromotion,
        format: fmtINRCompact,
      },
      {
        key: "total",
        label: "Total costing",
        value: (s) => s.total,
        format: fmtINRCompact,
        emphasis: true,
      },
    ],
  },
};

export function MonthlyCompare({
  measure,
  employees,
  selectedIds,
  isAllScope,
  userId,
}: {
  measure: MonthlyMeasure;
  employees: MultiOption[];
  selectedIds: string[];
  isAllScope: boolean;
  userId: string;
}) {
  const spec = MEASURES[measure];
  const supabase = useMemo(() => createClient(), []);
  const [window, setWindow] = useState<MonthlyWindow>(() =>
    defaultMonthlyWindow(),
  );
  const [attainment, setAttainment] = useState<AttainmentRange>(ATTAINMENT_ALL);

  const params = { employeeIds: selectedIds, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: comparativeMonthlyQueryKey(params),
    queryFn: () => fetchComparativeMonthly(supabase, params),
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
      sortKey: (r) => monthOrd(r.month, r.year),
      label: (r) => formatMonthLabel(r.month, r.year),
      value: spec.value,
      reduce: spec.reduce,
      stats: monthlyStats,
    });
  }, [data, selectedIds, employees, spec]);

  const visible = useMemo(
    () => applyAttainmentFilter(series, attainment),
    [series, attainment],
  );

  const body =
    selectedIds.length === 0 ? (
      <ComparativeSelectPrompt />
    ) : !data ? (
      <ReportChartSkeleton height={360} />
    ) : data.rows.length === 0 ? (
      <ReportCardEmpty message="No data recorded for anyone in this range." />
    ) : visible.length === 0 ? (
      <ComparativeNoMatch onClear={() => setAttainment(ATTAINMENT_ALL)} />
    ) : (
      <ComparativeViews
        series={visible}
        columns={spec.columns}
        labels={labels}
        valueFormat={spec.valueFormat}
        axisFormat={spec.axisFormat}
      />
    );

  return (
    <ComparativeShell
      icon={spec.icon}
      title={spec.title}
      description={spec.description}
      employees={employees}
      selectedIds={selectedIds}
      isAllScope={isAllScope}
      isFetching={isFetching}
      visibleCount={visible.length}
      windowLabel={monthlyWindowLabel(window)}
      attainmentControl={
        spec.filter ? (
          <AttainmentFilter
            value={attainment}
            onChange={setAttainment}
            label={spec.filter.label}
            presets={spec.filter.presets}
          />
        ) : undefined
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
