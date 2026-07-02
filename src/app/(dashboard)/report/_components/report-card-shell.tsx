"use client";

/**
 * Shared chrome for every Report metric card: icon chip + title/description,
 * a slot for the card's own local time filter, and the dim-while-refetching
 * behaviour. Dims on EITHER the card's own refetch (its local filter changed)
 * OR a page navigation (the employee was switched) — matching the dashboard's
 * `isFetching || useNavigationPending()` overlay so nothing ever flashes a
 * skeleton mid-interaction.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useNavigationPending } from "@/lib/navigation-pending";
import { cn } from "@/lib/utils";

const CARD_SHADOW =
  "shadow-[0_2px_8px_-2px_rgba(79,70,229,0.06),0_10px_30px_-14px_rgba(79,70,229,0.12)]";

export function ReportCardShell({
  title,
  description,
  icon: Icon,
  iconTint = "bg-indigo-50 text-indigo-600 ring-indigo-100",
  headerRight,
  isFetching,
  className,
  children,
}: {
  title: string;
  description?: string;
  icon: LucideIcon;
  iconTint?: string;
  headerRight?: ReactNode;
  isFetching?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const isNavigating = useNavigationPending();
  const dim = Boolean(isFetching) || isNavigating;

  return (
    <Card className={cn("ring-slate-200", CARD_SHADOW, className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1",
              iconTint,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="text-base font-semibold tracking-tight text-slate-900">
              {title}
            </div>
            {description ? (
              <div className="mt-0.5 text-xs text-slate-500">{description}</div>
            ) : null}
          </div>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </CardHeader>
      <CardContent
        className={cn(
          "transition-opacity",
          dim && "pointer-events-none opacity-50",
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}

/** Centered empty state for a card whose window has no data. */
export function ReportCardEmpty({ message }: { message: string }) {
  return (
    <div className="flex h-[240px] items-center justify-center text-center text-sm text-slate-400">
      {message}
    </div>
  );
}

/** Pulse placeholder shown before a card's first data resolves. */
export function ReportChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="animate-pulse rounded-lg bg-slate-100"
      style={{ height }}
      aria-hidden
    />
  );
}

/** One labelled figure in a card's stat footer. */
export function StatItem({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums text-slate-800",
          valueClass,
        )}
      >
        {value}
      </span>
    </div>
  );
}

/** Divider-separated footer row for a card's summary stats. */
export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3">
      {children}
    </div>
  );
}
