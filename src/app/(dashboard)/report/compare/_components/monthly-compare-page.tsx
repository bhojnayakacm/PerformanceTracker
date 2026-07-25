import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { resolveCompareContext } from "../_lib/compare-server";
import { MonthlyCompare, type MonthlyMeasure } from "./monthly-compare";
import {
  comparativeMonthlyQueryKey,
  fetchComparativeMonthly,
} from "../../_lib/fetch-comparative-monthly";
import { defaultMonthlyWindow } from "../../_lib/report-ranges";

/**
 * Server wrapper shared by all four monthly Compare routes. Resolves scope,
 * warms the default-window comparative-monthly query into a per-request
 * QueryClient with the SAME key the client computes (so first paint hydrates
 * with no round-trip), and renders the measure-parameterized client component.
 * Dispatch/Visits/Conversion/Costing pages are one line each on top of this.
 */
export async function MonthlyComparePage({
  measure,
  idsRaw,
}: {
  measure: MonthlyMeasure;
  idsRaw: string | undefined;
}) {
  const { auth, options, selectedIds } = await resolveCompareContext(idsRaw);

  const queryClient = getQueryClient();
  if (selectedIds.length > 0) {
    const params = {
      employeeIds: selectedIds,
      window: defaultMonthlyWindow(),
      userId: auth.id,
    };
    await queryClient.prefetchQuery({
      queryKey: comparativeMonthlyQueryKey(params),
      queryFn: () => fetchComparativeMonthly(auth.supabase, params),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MonthlyCompare
        measure={measure}
        employees={options}
        selectedIds={selectedIds}
        userId={auth.id}
      />
    </HydrationBoundary>
  );
}
