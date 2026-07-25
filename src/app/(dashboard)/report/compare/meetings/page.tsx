import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/lib/query-client";
import { resolveCompareContext } from "../_lib/compare-server";
import { MeetingsCompare } from "../_components/meetings-compare";
import {
  comparativeMeetingsQueryKey,
  fetchComparativeMeetings,
} from "../../_lib/fetch-comparative-meetings";
import { defaultDailyWindow } from "../../_lib/report-ranges";

export default async function CompareMeetingsPage({
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
      window: defaultDailyWindow(),
      userId: auth.id,
    };
    await queryClient.prefetchQuery({
      queryKey: comparativeMeetingsQueryKey(params),
      queryFn: () => fetchComparativeMeetings(auth.supabase, params),
    });
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <MeetingsCompare
        employees={options}
        selectedIds={selectedIds}
        userId={auth.id}
      />
    </HydrationBoundary>
  );
}
