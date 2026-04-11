import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export function MonthlyDataTableSkeleton() {
  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card p-3">
        <Skeleton className="h-9 w-64 rounded-md" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-36 rounded-md" />
        </div>
      </div>

      {/* Table */}
      <Card className="border-0 py-0 gap-0 shadow-sm ring-1 ring-border/50 overflow-hidden">
        <CardContent className="p-0">
          {/* Header */}
          <div className="border-b bg-muted/30 px-4 py-3">
            <div className="flex gap-6">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} className="h-4 flex-1 rounded" />
              ))}
            </div>
          </div>

          {/* Rows */}
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-6 px-4 py-3 border-b border-border/40"
            >
              {/* Employee cell */}
              <div className="flex items-center gap-3 w-[18%]">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3.5 w-24 rounded" />
                  <Skeleton className="h-2.5 w-16 rounded" />
                </div>
              </div>

              {/* Metric cells */}
              {Array.from({ length: 6 }).map((_, j) => (
                <Skeleton key={j} className="h-4 flex-1 rounded" />
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
