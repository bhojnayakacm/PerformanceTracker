/**
 * Dashboard KPIs — shared fetch (server prefetch + client useQuery).
 *
 * Mirrors fetch-cumulative-metrics.ts. One function, two callers; identical
 * shape so HydrationBoundary seeds the client cache with zero refetch on mount.
 *
 * What it does:
 *   1. Resolves the caller's roster → `_employee_ids` (NULL for
 *      super_admin/editor/viewer = org-wide; the assigned set for custom_admin).
 *   2. Applies the present-day cap (clamp the window's `to` to this month) so a
 *      forward-looking range compares elapsed actuals to elapsed targets.
 *   3. Derives the EQUIVALENT previous window by shifting the capped window back
 *      by the FULL selected span (This Month → last month; This FY → the same
 *      elapsed span of last FY — a fair YoY).
 *   4. Fires two parallel `get_dashboard_kpis` RPCs (current + previous) and
 *      folds them into actuals / targets / attainment % / period deltas.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { UserRole } from "@/lib/types";
import { getEmployeesForUser } from "@/lib/queries/employees";

export type DashboardKpisParams = {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  userId: string;
  userRole: UserRole;
};

export type AttainmentMetric = {
  actual: number;
  target: number;
  /** actual / target * 100, or null when there is no target to measure. */
  attainmentPct: number | null;
  /** % change in actual vs the equivalent previous period; null when the
   *  previous period had no baseline (zero) to divide by. */
  deltaPct: number | null;
};

export type CountMetric = {
  actual: number;
  /** conversions / client-visit actuals * 100; null when no visits logged. */
  ratePct: number | null;
  deltaPct: number | null;
};

export type DashboardKpisPayload = {
  dispatch: AttainmentMetric;
  visits: AttainmentMetric;
  conversions: CountMetric;
  /** Elapsed months in the present-day-capped current window. */
  numberOfMonths: number;
};

export function dashboardKpisQueryKey(params: DashboardKpisParams) {
  return [
    "dashboard-kpis",
    {
      fromMonth: params.fromMonth,
      fromYear: params.fromYear,
      toMonth: params.toMonth,
      toYear: params.toYear,
      userId: params.userId,
      role: params.userRole,
    },
  ] as const;
}

/* 0-based month ordinal so the modulo round-trip stays clean. */
const toOrd = (month: number, year: number) => year * 12 + (month - 1);
const fromOrdinal = (ord: number) => ({
  month: (ord % 12) + 1,
  year: Math.floor(ord / 12),
});

type KpiRow = {
  dispatch_target: number;
  dispatch_actual: number;
  visits_target: number;
  visits_actual: number;
  conversions_actual: number;
};

const ZERO_ROW: KpiRow = {
  dispatch_target: 0,
  dispatch_actual: 0,
  visits_target: 0,
  visits_actual: 0,
  conversions_actual: 0,
};

/** Percentage helper — null when the denominator is non-positive (no base). */
const pct = (num: number, den: number): number | null =>
  den > 0 ? (num / den) * 100 : null;

export async function fetchDashboardKpis(
  supabase: SupabaseClient<Database>,
  { fromMonth, fromYear, toMonth, toYear, userId, userRole }: DashboardKpisParams,
): Promise<DashboardKpisPayload> {
  // 1. Roster scoping. Only custom_admins are bounded; everyone else passes
  //    NULL ("every employee I can read"). An empty array → all-zero totals.
  let employeeIds: string[] | null = null;
  if (userRole === "custom_admin") {
    const roster = await getEmployeesForUser(supabase, userId, userRole, {
      activeOnly: false,
    });
    employeeIds = roster.map((e) => e.id);
  }

  // 2. Present-day cap on the current window's `to`.
  const now = new Date();
  const currentOrd = toOrd(now.getMonth() + 1, now.getFullYear());
  const selFromOrd = toOrd(fromMonth, fromYear);
  const selToOrd = toOrd(toMonth, toYear);
  const curToOrd = Math.min(selToOrd, currentOrd);

  // 3. Equivalent previous window = capped window shifted back by the full span.
  const fullSpan = selToOrd - selFromOrd + 1;
  const prevFromOrd = selFromOrd - fullSpan;
  const prevToOrd = curToOrd - fullSpan;

  const numberOfMonths = Math.max(0, curToOrd - selFromOrd + 1);

  const callKpis = (fromO: number, toO: number) => {
    const f = fromOrdinal(fromO);
    const t = fromOrdinal(toO);
    return supabase.rpc("get_dashboard_kpis", {
      _from_month: f.month,
      _from_year: f.year,
      _to_month: t.month,
      _to_year: t.year,
      _employee_ids: employeeIds,
    });
  };

  // 4. Two parallel RPCs: current + previous window.
  const [currentRes, previousRes] = await Promise.all([
    callKpis(selFromOrd, curToOrd),
    callKpis(prevFromOrd, prevToOrd),
  ]);

  if (currentRes.error) throw currentRes.error;
  if (previousRes.error) throw previousRes.error;

  const cur = (currentRes.data?.[0] ?? ZERO_ROW) as KpiRow;
  const prev = (previousRes.data?.[0] ?? ZERO_ROW) as KpiRow;

  return {
    dispatch: {
      actual: cur.dispatch_actual,
      target: cur.dispatch_target,
      attainmentPct: pct(cur.dispatch_actual, cur.dispatch_target),
      deltaPct: pct(cur.dispatch_actual - prev.dispatch_actual, prev.dispatch_actual),
    },
    visits: {
      actual: cur.visits_actual,
      target: cur.visits_target,
      attainmentPct: pct(cur.visits_actual, cur.visits_target),
      deltaPct: pct(cur.visits_actual - prev.visits_actual, prev.visits_actual),
    },
    conversions: {
      actual: cur.conversions_actual,
      ratePct: pct(cur.conversions_actual, cur.visits_actual),
      deltaPct: pct(
        cur.conversions_actual - prev.conversions_actual,
        prev.conversions_actual,
      ),
    },
    numberOfMonths,
  };
}
