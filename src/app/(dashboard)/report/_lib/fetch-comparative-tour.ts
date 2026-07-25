/**
 * Comparative Tour fetch — wraps get_comparative_tour_series (migration 0025).
 * One totals row per employee (target days, actual days, distinct cities toured)
 * over the window. Tour's cross-employee comparison is a totals leaderboard, not
 * a per-city radar, so there's no time axis here — the page renders the ranked
 * leaderboard only.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MonthlyWindow } from "./report-ranges";

export type ComparativeTourParams = {
  employeeIds: string[];
  window: MonthlyWindow;
  userId: string;
};

export type ComparativeTourRow = {
  employeeId: string;
  targetDays: number;
  actualDays: number;
  citiesCovered: number;
  citiesPlanned: number;
};

export type ComparativeTourPayload = { rows: ComparativeTourRow[] };

export function comparativeTourQueryKey(p: ComparativeTourParams) {
  return [
    "report-cmp-tour",
    {
      ids: [...p.employeeIds].sort(),
      fromMonth: p.window.fromMonth,
      fromYear: p.window.fromYear,
      toMonth: p.window.toMonth,
      toYear: p.window.toYear,
      userId: p.userId,
    },
  ] as const;
}

export async function fetchComparativeTour(
  supabase: SupabaseClient<Database>,
  { employeeIds, window }: ComparativeTourParams,
): Promise<ComparativeTourPayload> {
  if (employeeIds.length === 0) return { rows: [] };

  const { data, error } = await supabase.rpc("get_comparative_tour_series", {
    _employee_ids: employeeIds,
    _from_month: window.fromMonth,
    _from_year: window.fromYear,
    _to_month: window.toMonth,
    _to_year: window.toYear,
  });
  if (error) throw error;

  const rows: ComparativeTourRow[] = (data ?? []).map((r) => ({
    employeeId: r.employee_id,
    targetDays: Number(r.target_days) || 0,
    actualDays: Number(r.actual_days) || 0,
    citiesCovered: Number(r.cities_covered) || 0,
    citiesPlanned: Number(r.cities_planned) || 0,
  }));

  return { rows };
}
