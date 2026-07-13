/**
 * Report — Tour fetch (per-city day sums over a monthly window).
 *
 * Wraps get_employee_tour_series (migration 0023): one row per city, days
 * summed across the window. Feeds the Tour bullet list (one fixed-height
 * row per city; the card scrolls once the list outgrows the chart area).
 * The derived totals give the "cities covered vs planned" headline the
 * card shows.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MonthlyWindow } from "./report-ranges";

export type TourSeriesParams = {
  employeeId: string;
  window: MonthlyWindow;
  userId: string;
};

export type TourCity = { city: string; target: number; actual: number };

export type TourSeriesPayload = {
  cities: TourCity[];
  totals: {
    actual: number;
    target: number;
    /** cities with any actual days logged. */
    citiesCovered: number;
    /** cities with any planned (target) days. */
    citiesPlanned: number;
  };
};

export function tourSeriesQueryKey(p: TourSeriesParams) {
  return [
    "report-tour-series",
    {
      employeeId: p.employeeId,
      fromMonth: p.window.fromMonth,
      fromYear: p.window.fromYear,
      toMonth: p.window.toMonth,
      toYear: p.window.toYear,
      userId: p.userId,
    },
  ] as const;
}

export async function fetchTourSeries(
  supabase: SupabaseClient<Database>,
  { employeeId, window }: TourSeriesParams,
): Promise<TourSeriesPayload> {
  const { data, error } = await supabase.rpc("get_employee_tour_series", {
    _employee_id: employeeId,
    _from_month: window.fromMonth,
    _from_year: window.fromYear,
    _to_month: window.toMonth,
    _to_year: window.toYear,
  });
  if (error) throw error;

  const cities: TourCity[] = (data ?? []).map((r) => ({
    city: r.city_name,
    target: Number(r.target_days) || 0,
    actual: Number(r.actual_days) || 0,
  }));

  const totals = cities.reduce(
    (acc, c) => {
      acc.actual += c.actual;
      acc.target += c.target;
      if (c.actual > 0) acc.citiesCovered += 1;
      if (c.target > 0) acc.citiesPlanned += 1;
      return acc;
    },
    { actual: 0, target: 0, citiesCovered: 0, citiesPlanned: 0 },
  );

  return { cities, totals };
}
