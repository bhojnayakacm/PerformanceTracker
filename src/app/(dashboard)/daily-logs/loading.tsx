import { Skeleton } from "@/components/ui/skeleton";
import { DailyLogsSkeleton } from "./_components/daily-logs-skeleton";

export default function DailyLogsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72" />
      </div>
      <DailyLogsSkeleton />
    </div>
  );
}
