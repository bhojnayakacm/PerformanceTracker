"use client";

/**
 * Dashboard stat cards — live data view (3 cards: Dispatch, Visits,
 * Conversions). Consumes the DashboardKpisPayload from the container.
 *
 * Each card shows BOTH the raw numbers and the percentage:
 *   • Dispatch / Visits (attainment): `actual / target` hero + a
 *     threshold-coloured progress bar with the attainment %.
 *   • Conversions (count): the raw count + conversion rate.
 * Every card carries a period-over-period trend badge (vs the equivalent
 * previous period computed in the fetcher).
 *
 * Threshold rule (shared with Monthly Data): <70% red, 70–99% amber,
 * ≥100% green. The grid dims to 50% while a range change / refetch is in
 * flight (isFetching OR a pending navigation), matching the other grids.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Target, TrendingDown, TrendingUp, Truck, Users } from "lucide-react";
import { useNavigationPending } from "@/lib/navigation-pending";
import { cn } from "@/lib/utils";
import type {
  AttainmentMetric,
  CountMetric,
  DashboardKpisPayload,
} from "../_lib/fetch-dashboard-kpis";

/** Soft, indigo-tinted elevation used across every dashboard card. */
const CARD_SHADOW =
  "shadow-[0_2px_8px_-2px_rgba(79,70,229,0.06),0_10px_30px_-14px_rgba(79,70,229,0.12)]";

type Status = "green" | "amber" | "red" | "neutral";

const STATUS: Record<Status, { text: string; chip: string; bar: string }> = {
  green: {
    text: "text-emerald-600",
    chip: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    bar: "bg-emerald-500",
  },
  amber: {
    text: "text-amber-600",
    chip: "bg-amber-50 text-amber-600 ring-amber-100",
    bar: "bg-amber-500",
  },
  red: {
    text: "text-red-600",
    chip: "bg-red-50 text-red-600 ring-red-100",
    bar: "bg-red-500",
  },
  neutral: {
    text: "text-slate-500",
    chip: "bg-indigo-50 text-indigo-600 ring-indigo-100",
    bar: "bg-slate-300",
  },
};

function attainmentStatus(pct: number | null): Status {
  if (pct === null) return "neutral";
  if (pct >= 100) return "green";
  if (pct >= 70) return "amber";
  return "red";
}

const numberFormat = new Intl.NumberFormat("en-IN");
const fmt = (n: number) => numberFormat.format(Math.round(n));

/** Period-over-period trend pill. More-is-better for all 3 metrics, so a
 *  positive delta is green / up and a negative delta is red / down. */
function TrendBadge({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null || Math.abs(deltaPct) < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500 ring-1 ring-slate-200">
        {deltaPct === null ? "—" : "0.0%"}
      </span>
    );
  }
  const up = deltaPct > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1",
        up
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-red-50 text-red-700 ring-red-200",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {Math.abs(deltaPct).toFixed(1)}%
    </span>
  );
}

function CardShell({
  icon: Icon,
  iconChip,
  title,
  badge,
  children,
}: {
  icon: LucideIcon;
  iconChip: string;
  title: string;
  badge: ReactNode;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl bg-white p-5 ring-1 ring-slate-200",
        CARD_SHADOW,
      )}
    >
      <div className="flex items-start justify-between">
        <span
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-xl ring-1",
            iconChip,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        {badge}
      </div>
      <p className="mt-4 text-sm font-medium text-slate-500">{title}</p>
      {children}
    </div>
  );
}

function AttainmentCard({
  title,
  icon,
  unit,
  metric,
}: {
  title: string;
  icon: LucideIcon;
  unit?: string;
  metric: AttainmentMetric;
}) {
  const status = attainmentStatus(metric.attainmentPct);
  const s = STATUS[status];
  const fillPct =
    metric.attainmentPct === null ? 0 : Math.min(metric.attainmentPct, 100);

  return (
    <CardShell
      icon={icon}
      iconChip={s.chip}
      title={title}
      badge={<TrendBadge deltaPct={metric.deltaPct} />}
    >
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums text-slate-900">
          {fmt(metric.actual)}
        </span>
        <span className="text-sm font-medium tabular-nums text-slate-400">
          / {fmt(metric.target)}
        </span>
        {unit ? (
          <span className="text-xs font-medium text-slate-400">{unit}</span>
        ) : null}
      </p>

      <div className="mt-4 flex items-center gap-2.5">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn("h-full rounded-full transition-all", s.bar)}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <span className={cn("text-sm font-semibold tabular-nums", s.text)}>
          {metric.attainmentPct === null
            ? "—"
            : `${Math.round(metric.attainmentPct)}%`}
        </span>
      </div>
    </CardShell>
  );
}

function ConversionsCard({ metric }: { metric: CountMetric }) {
  return (
    <CardShell
      icon={Target}
      iconChip={STATUS.neutral.chip}
      title="Conversions"
      badge={<TrendBadge deltaPct={metric.deltaPct} />}
    >
      <p className="mt-1 text-3xl font-semibold tracking-tight tabular-nums text-slate-900">
        {fmt(metric.actual)}
      </p>
      <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
        {metric.ratePct === null
          ? "No visits logged"
          : `${metric.ratePct.toFixed(1)}% conversion rate`}
      </p>
    </CardShell>
  );
}

export function DashboardStatCards({
  data,
  isFetching,
}: {
  data?: DashboardKpisPayload;
  isFetching?: boolean;
}) {
  // Covers the gap between a range click and useQuery seeing the new key —
  // see src/lib/navigation-pending.ts. OR'd with isFetching into one dim.
  const isNavigating = useNavigationPending();

  if (!data) return <DashboardStatCardsSkeleton />;

  const showOverlay = Boolean(isFetching) || isNavigating;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 transition-opacity md:grid-cols-3",
        showOverlay && "pointer-events-none opacity-50",
      )}
    >
      <AttainmentCard
        title="Dispatch"
        icon={Truck}
        unit="sqft"
        metric={data.dispatch}
      />
      <AttainmentCard title="Visits" icon={Users} metric={data.visits} />
      <ConversionsCard metric={data.conversions} />
    </div>
  );
}

export function DashboardStatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={cn(
            "rounded-2xl bg-white p-5 ring-1 ring-slate-200",
            CARD_SHADOW,
          )}
        >
          <div className="flex items-start justify-between">
            <div className="h-9 w-9 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-6 w-16 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="mt-4 h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="mt-2 h-7 w-32 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
