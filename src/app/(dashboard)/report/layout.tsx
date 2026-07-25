import { Suspense } from "react";
import { ReportNav } from "./_components/report-nav";

/**
 * Shared shell for the whole Analytics suite — the page title and the pill-nav
 * paint once and stay put while the individual views (Overview + six Compare
 * routes) swap underneath. The nav is wrapped in Suspense because it reads
 * useSearchParams (to carry ?ids= across Compare tabs); the fallback holds the
 * strip's height so nothing shifts on first paint.
 */
export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Employee Analytics
        </h1>
        <p className="text-sm text-slate-500">
          Deep-dive a single employee, or compare your team head to head on any
          metric.
        </p>
      </header>

      <Suspense fallback={<div className="h-[52px] rounded-2xl bg-slate-100/70" />}>
        <ReportNav />
      </Suspense>

      {children}
    </div>
  );
}
