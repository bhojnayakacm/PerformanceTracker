import { Suspense } from "react";
import { DailyLogsData } from "./_components/daily-logs-data";
import { DailyLogsSkeleton } from "./_components/daily-logs-skeleton";

export default async function DailyLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const date = params.date ?? today;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Daily Logs</h1>
        <p className="text-muted-foreground mt-1">
          Record daily targets and actuals for meetings and calls.
        </p>
      </div>
      <Suspense fallback={<DailyLogsSkeleton />}>
        <DailyLogsData date={date} />
      </Suspense>
    </div>
  );
}
