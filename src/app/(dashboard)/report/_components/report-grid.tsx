"use client";

/**
 * Report grid — lays out the six metric cards in an asymmetric 6-column
 * masonry. Each card owns its own data lifecycle + local time filter; this
 * component only threads the selected employee + caller id down and fixes the
 * column spans. Wide time-series cards (Meetings) get more width; the compact
 * gauge (Conversion) gets less.
 */

import { cn } from "@/lib/utils";
import { MeetingsCard } from "./meetings-card";
import { ConversionCard } from "./conversion-card";
import { DispatchCard } from "./dispatch-card";
import { VisitsCard } from "./visits-card";
import { TourCard } from "./tour-card";
import { CostingCard } from "./costing-card";

const CARD_SHADOW =
  "shadow-[0_2px_8px_-2px_rgba(79,70,229,0.06),0_10px_30px_-14px_rgba(79,70,229,0.12)]";

const SPANS = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-3",
  "lg:col-span-3",
];

export function ReportGrid({
  employeeId,
  userId,
}: {
  employeeId: string;
  userId: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-6">
      <MeetingsCard employeeId={employeeId} userId={userId} />
      <ConversionCard employeeId={employeeId} userId={userId} />
      <DispatchCard employeeId={employeeId} userId={userId} />
      <VisitsCard employeeId={employeeId} userId={userId} />
      <TourCard employeeId={employeeId} userId={userId} />
      <CostingCard employeeId={employeeId} userId={userId} />
    </div>
  );
}

export function ReportGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-6">
      {SPANS.map((span, i) => (
        <div
          key={i}
          className={cn(
            "rounded-xl bg-white p-4 ring-1 ring-slate-200",
            CARD_SHADOW,
            span,
          )}
        >
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
          </div>
          <div className="mt-4 h-[240px] animate-pulse rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
