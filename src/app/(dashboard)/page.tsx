import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getAuthUser } from "@/lib/queries/auth";
import { getQueryClient } from "@/lib/query-client";
import { MonthRangeSelector } from "@/components/month-range-selector";
import {
  fetchDashboardKpis,
  dashboardKpisQueryKey,
} from "./_lib/fetch-dashboard-kpis";
import { DashboardKpiContainer } from "./_components/dashboard-kpi-container";
import { DashboardStatCardsSkeleton } from "./_components/dashboard-stat-cards";

/**
 * Analytics Dashboard — Phase 2: live data.
 *
 * Renders at `/` (the `(dashboard)` route-group index). The header + range
 * selector paint immediately; the KPI cards stream behind a Suspense boundary
 * once the roster-scoped `get_dashboard_kpis` RPCs (current + previous window)
 * resolve. The parent layout supplies `bg-slate-50 p-6`, so this tree only owns
 * spacing.
 */

/** Default range = the current Indian fiscal year (Apr → Mar), matching the
 *  Cumulative Data page so the two selectors behave identically. */
function defaultFY(now: Date) {
  const y = now.getFullYear();
  const m = now.getMonth() + 1;
  const fyStart = m >= 4 ? y : y - 1;
  return { fromMonth: 4, fromYear: fyStart, toMonth: 3, toYear: fyStart + 1 };
}

function parseRange(params: {
  fromMonth?: string;
  fromYear?: string;
  toMonth?: string;
  toYear?: string;
}) {
  const def = defaultFY(new Date());
  const safe = (
    raw: string | undefined,
    fallback: number,
    lo: number,
    hi: number,
  ) => {
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) && n >= lo && n <= hi ? n : fallback;
  };
  const fromMonth = safe(params.fromMonth, def.fromMonth, 1, 12);
  const fromYear = safe(params.fromYear, def.fromYear, 2000, 2100);
  const toMonth = safe(params.toMonth, def.toMonth, 1, 12);
  const toYear = safe(params.toYear, def.toYear, 2000, 2100);
  if (toYear * 12 + toMonth < fromYear * 12 + fromMonth) return def;
  return { fromMonth, fromYear, toMonth, toYear };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    fromMonth?: string;
    fromYear?: string;
    toMonth?: string;
    toYear?: string;
  }>;
}) {
  const params = await searchParams;
  const { fromMonth, fromYear, toMonth, toYear } = parseRange(params);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Team performance, compared to the equivalent previous period.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <MonthRangeSelector
            fromMonth={fromMonth}
            fromYear={fromYear}
            toMonth={toMonth}
            toYear={toYear}
            basePath="/"
          />
        </div>
      </header>

      <Suspense fallback={<DashboardStatCardsSkeleton />}>
        <DashboardKpiLoader
          fromMonth={fromMonth}
          fromYear={fromYear}
          toMonth={toMonth}
          toYear={toYear}
        />
      </Suspense>
    </div>
  );
}

/**
 * Server prefetch + hydrate. Resolves auth, warms the dashboard-kpis query into
 * a per-request QueryClient with the SAME key the client container uses, then
 * dehydrates so the cards hydrate with zero round-trip on first paint.
 */
async function DashboardKpiLoader({
  fromMonth,
  fromYear,
  toMonth,
  toYear,
}: {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
}) {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const params = {
    fromMonth,
    fromYear,
    toMonth,
    toYear,
    userId: auth.id,
    userRole: auth.role,
  };

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: dashboardKpisQueryKey(params),
    queryFn: () => fetchDashboardKpis(auth.supabase, params),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardKpiContainer
        fromMonth={fromMonth}
        fromYear={fromYear}
        toMonth={toMonth}
        toYear={toYear}
        userId={auth.id}
        userRole={auth.role}
      />
    </HydrationBoundary>
  );
}
