import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/** Skeleton for the data area only (date nav + grid). No page title. */
export function DailyLogsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Date nav */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-9 w-[170px] rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-8 w-40 rounded-md" />
      </div>
      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="space-y-0">
            <div className="flex gap-4 p-3 border-b">
              <Skeleton className="h-5 w-28" />
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-32" />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 border-b">
                <div className="space-y-1 w-28">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-8 w-16 rounded-md" />
                ))}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
