import { Suspense } from "react";
import { redirect } from "next/navigation";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { UserRoundSearch } from "lucide-react";
import { getAuthUser } from "@/lib/queries/auth";
import { getQueryClient } from "@/lib/query-client";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { ReportEmployeeSelector } from "./_components/report-employee-selector";
import { ReportGrid, ReportGridSkeleton } from "./_components/report-grid";
import {
  fetchMeetingsSeries,
  meetingsSeriesQueryKey,
} from "./_lib/fetch-meetings-series";
import {
  fetchMonthlySeries,
  monthlySeriesQueryKey,
} from "./_lib/fetch-monthly-series";
import { fetchTourSeries, tourSeriesQueryKey } from "./_lib/fetch-tour-series";
import { defaultDailyWindow, defaultMonthlyWindow } from "./_lib/report-ranges";

/**
 * Employee Report — a single-employee analytics deep-dive.
 *
 * The header + employee selector paint immediately; the six metric cards
 * stream behind a Suspense boundary once each card's default-window RPC
 * resolves. Every card then owns its OWN local time filter, so different
 * metrics can be analysed across different horizons simultaneously.
 *
 * The selected employee is validated against the caller's roster
 * (getEmployeesForUser) both here and via the selector's option list, so a
 * hand-typed `?employeeId=` outside the roster degrades to "none selected".
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>;
}) {
  const { employeeId } = await searchParams;

  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const roster = await getEmployeesForUser(auth.supabase, auth.id, auth.role, {
    activeOnly: false,
  });
  const options = roster.map((e) => ({
    id: e.id,
    name: e.name,
    emp_id: e.emp_id,
  }));

  const selectedId =
    employeeId && options.some((o) => o.id === employeeId) ? employeeId : null;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Employee Report
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            A deep-dive into one employee&rsquo;s performance — each metric on
            its own timeline.
          </p>
        </div>

        <ReportEmployeeSelector employees={options} selectedId={selectedId} />
      </header>

      {selectedId ? (
        <Suspense fallback={<ReportGridSkeleton />}>
          <ReportDataLoader employeeId={selectedId} userId={auth.id} />
        </Suspense>
      ) : (
        <NoEmployeeState />
      )}
    </div>
  );
}

/**
 * Server prefetch + hydrate. Warms each card's DEFAULT window into a
 * per-request QueryClient using the SAME keys the client cards compute (via
 * the shared default*Window builders), so first paint hydrates with no
 * round-trip. The four monthly cards share one payload, so three prefetches
 * cover all six cards.
 */
async function ReportDataLoader({
  employeeId,
  userId,
}: {
  employeeId: string;
  userId: string;
}) {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const dailyWindow = defaultDailyWindow();
  const monthlyWindow = defaultMonthlyWindow();

  const meetingsParams = { employeeId, window: dailyWindow, userId };
  const monthlyParams = { employeeId, window: monthlyWindow, userId };

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: meetingsSeriesQueryKey(meetingsParams),
      queryFn: () => fetchMeetingsSeries(auth.supabase, meetingsParams),
    }),
    queryClient.prefetchQuery({
      queryKey: monthlySeriesQueryKey(monthlyParams),
      queryFn: () => fetchMonthlySeries(auth.supabase, monthlyParams),
    }),
    queryClient.prefetchQuery({
      queryKey: tourSeriesQueryKey(monthlyParams),
      queryFn: () => fetchTourSeries(auth.supabase, monthlyParams),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReportGrid employeeId={employeeId} userId={userId} />
    </HydrationBoundary>
  );
}

function NoEmployeeState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white/50 py-20 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500 ring-1 ring-indigo-100">
        <UserRoundSearch className="h-6 w-6" />
      </span>
      <div>
        <p className="text-sm font-medium text-slate-700">
          Select an employee to begin
        </p>
        <p className="mt-1 text-sm text-slate-400">
          Choose someone from the selector above to see their full metric
          breakdown.
        </p>
      </div>
    </div>
  );
}
