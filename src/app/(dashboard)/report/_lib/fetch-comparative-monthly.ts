/**
 * Comparative Monthly fetch — wraps get_comparative_monthly_series (migration
 * 0025). One lean wide row per (employee, month) carrying every headline monthly
 * measure + its target. FOUR compare pages (Dispatch, Visits, Conversion,
 * Costing) share THIS one payload and query key at a given window — they diverge
 * only in which field the page's adapter plucks — so a shared window hits a
 * single cache entry and a single RPC call.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { MonthlyWindow } from "./report-ranges";

export type ComparativeMonthlyParams = {
  employeeIds: string[];
  window: MonthlyWindow;
  userId: string;
};

export type ComparativeMonthlyRow = {
  employeeId: string;
  month: number;
  year: number;
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
  // Costing breakdown (INR)
  salary: number;
  tada: number;
  incentive: number;
  vendor: number;
  salesPromotion: number;
  totalCosting: number;
};

export type ComparativeMonthlyPayload = { rows: ComparativeMonthlyRow[] };

export function comparativeMonthlyQueryKey(p: ComparativeMonthlyParams) {
  return [
    "report-cmp-monthly",
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

export async function fetchComparativeMonthly(
  supabase: SupabaseClient<Database>,
  { employeeIds, window }: ComparativeMonthlyParams,
): Promise<ComparativeMonthlyPayload> {
  if (employeeIds.length === 0) return { rows: [] };

  const { data, error } = await supabase.rpc("get_comparative_monthly_series", {
    _employee_ids: employeeIds,
    _from_month: window.fromMonth,
    _from_year: window.fromYear,
    _to_month: window.toMonth,
    _to_year: window.toYear,
  });
  if (error) throw error;

  const rows: ComparativeMonthlyRow[] = (data ?? []).map((r) => ({
    employeeId: r.employee_id,
    month: r.month,
    year: r.year,
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

  return { rows };
}
