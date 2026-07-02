/**
 * Report — wide MONTHLY series fetch (Dispatch, Visits, Conversion, Costing).
 *
 * Wraps get_employee_monthly_series (migration 0023): one row per month in
 * the window carrying every monthly measure + target. The four monthly cards
 * all consume THIS one payload — the query key deliberately omits the metric,
 * so at a shared window they hit a single cache entry and a single RPC call.
 * Each card diverges only when its own local filter changes the window.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { formatMonthLabel, type MonthlyWindow } from "./report-ranges";

export type MonthlySeriesParams = {
  employeeId: string;
  window: MonthlyWindow;
  userId: string;
};

export type MonthlyPoint = {
  month: number;
  year: number;
  label: string;
  // Dispatch breakdown (sqft) — the six parts sum to `dispatched`.
  commercial: number;
  hotel: number;
  project2: number;
  tile: number;
  retail: number;
  returnSqft: number;
  netSale: number;
  dispatched: number;
  targetDispatched: number;
  // Visits & conversion
  clientVisits: number;
  targetClientVisits: number;
  conversions: number;
  // Costing breakdown (INR) — salary + tada + incentive + vendor = totalCosting.
  salary: number;
  tada: number;
  incentive: number;
  vendor: number;
  salesPromotion: number;
  totalCosting: number;
};

export type MonthlySeriesPayload = { points: MonthlyPoint[] };

export function monthlySeriesQueryKey(p: MonthlySeriesParams) {
  return [
    "report-monthly-series",
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

export async function fetchMonthlySeries(
  supabase: SupabaseClient<Database>,
  { employeeId, window }: MonthlySeriesParams,
): Promise<MonthlySeriesPayload> {
  const { data, error } = await supabase.rpc("get_employee_monthly_series", {
    _employee_id: employeeId,
    _from_month: window.fromMonth,
    _from_year: window.fromYear,
    _to_month: window.toMonth,
    _to_year: window.toYear,
  });
  if (error) throw error;

  const points: MonthlyPoint[] = (data ?? []).map((r) => ({
    month: r.month,
    year: r.year,
    label: formatMonthLabel(r.month, r.year),
    commercial: Number(r.commercial_project) || 0,
    hotel: Number(r.hotel_project) || 0,
    project2: Number(r.project_2) || 0,
    tile: Number(r.tile) || 0,
    retail: Number(r.retail) || 0,
    returnSqft: Number(r.return_sqft) || 0,
    netSale: Number(r.net_sale) || 0,
    dispatched: Number(r.dispatched_sqft) || 0,
    targetDispatched: Number(r.target_dispatched_sqft) || 0,
    clientVisits: Number(r.client_visits) || 0,
    targetClientVisits: Number(r.target_client_visits) || 0,
    conversions: Number(r.conversions) || 0,
    salary: Number(r.salary) || 0,
    tada: Number(r.tada) || 0,
    incentive: Number(r.incentive) || 0,
    vendor: Number(r.vendor_costing) || 0,
    salesPromotion: Number(r.sales_promotion) || 0,
    totalCosting: Number(r.total_costing) || 0,
  }));

  return { points };
}
