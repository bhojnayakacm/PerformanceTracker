import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { resolveCompareContext } from "../_lib/compare-server";
import { TourCompare } from "../_components/tour-compare";
import {
  comparativeTourQueryKey,
  fetchComparativeTour,
} from "../../_lib/fetch-comparative-tour";
import { defaultMonthlyWindow } from "../../_lib/report-ranges";

export default async function CompareTourPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const { auth, options, selectedIds } = await resolveCompareContext(ids);

  const queryClient = getQueryClient();
  if (selectedIds.length > 0) {
    const params = {
      employeeIds: selectedIds,
      window: defaultMonthlyWindow(),
      userId: auth.id,
    };
    await queryClient.prefetchQuery({
      queryKey: comparativeTourQueryKey(params),
      queryFn: () => fetchComparativeTour(auth.supabase, params),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <TourCompare
        employees={options}
        selectedIds={selectedIds}
        userId={auth.id}
      />
    </HydrationBoundary>
  );
}
