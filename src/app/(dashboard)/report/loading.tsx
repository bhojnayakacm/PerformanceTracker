import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading boundary for the whole Analytics suite — the one route group that
 * previously had none, so a click on "Report" (or between Compare tabs) held
 * the old page on screen until Supabase answered.
 *
 * Because it sits beside `layout.tsx`, the shared title + pill-nav stay put and
 * only the body swaps to this skeleton: navigation feels instant, and the tab
 * you clicked is already highlighted while its data loads. Shaped as
 * toolbar + one tall card, which matches the six Compare routes exactly and
 * reads as a neutral placeholder for the Overview grid.
 */
export default function ReportLoading() {
  return (
    <div className="space-y-5">
      {/* Toolbar — mirrors the frosted control strip */}
      <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/80 bg-white/85 p-3 backdrop-blur-md shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(79,70,229,0.25)]">
        <Skeleton className="h-9 w-full rounded-lg sm:w-72" />
        <Skeleton className="h-9 w-36 rounded-lg" />
        <div className="ml-auto flex items-center gap-2">
          <Skeleton className="h-9 w-40 rounded-lg" />
        </div>
      </div>

      {/* Card: header + table rows + trend block */}
      <div className="rounded-xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_2px_8px_-2px_rgba(79,70,229,0.06),0_10px_30px_-14px_rgba(79,70,229,0.12)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <Skeleton className="h-7 w-32 rounded-lg" />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50/80 px-3 py-2.5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-3 w-28 rounded bg-slate-200" />
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 flex-1 rounded bg-slate-200" />
              ))}
            </div>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-slate-100 px-3 py-2.5 last:border-b-0"
            >
              <div className="flex w-28 items-center gap-2.5">
                <Skeleton className="h-2.5 w-2.5 rounded-full" />
                <Skeleton className="h-3.5 flex-1 rounded" />
              </div>
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-3.5 flex-1 rounded" />
              ))}
            </div>
          ))}
        </div>

        <Skeleton className="mt-5 h-[220px] w-full rounded-lg" />
      </div>
    </div>
  );
}
