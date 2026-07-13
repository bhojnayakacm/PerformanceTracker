"use client";

/**
 * Tour — MONTHLY (per city).
 *
 * Chart choice: a BULLET LIST — one DOM row per city with a light track
 * sized to the target and a slimmer indigo bar overlaid for actual days,
 * all on one shared scale so lengths compare across rows. City cardinality
 * swings from 4–5 (a single month) to ~30 (a year), which breaks both a
 * radar (illegible past ~8 spokes) and paired SVG bars (labels squish,
 * bars thin to hairlines). Fixed 40px rows sidestep that entirely: labels
 * never wrap or shrink, and past six rows the list scrolls inside the card
 * behind fade hints instead of compressing.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Route } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  ReportCardShell,
  ReportCardEmpty,
  ReportChartSkeleton,
  StatItem,
  StatRow,
} from "./report-card-shell";
import { MetricRangeFilter } from "./metric-range-filter";
import {
  fetchTourSeries,
  tourSeriesQueryKey,
  type TourCity,
} from "../_lib/fetch-tour-series";
import { defaultMonthlyWindow, type MonthlyWindow } from "../_lib/report-ranges";
import {
  attainmentStatus,
  fmtDays,
  fmtPct,
  STATUS_TEXT,
} from "../_lib/report-format";

export function TourCard({
  employeeId,
  userId,
}: {
  employeeId: string;
  userId: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [window, setWindow] = useState<MonthlyWindow>(() =>
    defaultMonthlyWindow(),
  );

  const params = { employeeId, window, userId };
  const { data, isFetching } = useQuery({
    queryKey: tourSeriesQueryKey(params),
    queryFn: () => fetchTourSeries(supabase, params),
    placeholderData: keepPreviousData,
  });

  // Busiest cities first; planned-but-untoured ones sink to the bottom, so
  // coverage gaps cluster where the eye ends up last. One shared scale
  // (the largest actual-or-target anywhere) keeps every row comparable.
  const view = useMemo(() => {
    const cities = [...(data?.cities ?? [])].sort(
      (a, b) =>
        b.actual - a.actual ||
        b.target - a.target ||
        a.city.localeCompare(b.city),
    );
    const scale = Math.max(
      1,
      ...cities.map((c) => Math.max(c.actual, c.target)),
    );
    return { cities, scale };
  }, [data]);

  const totals = data?.totals;
  const attainment =
    totals && totals.target > 0 ? (totals.actual / totals.target) * 100 : null;
  const status = attainmentStatus(attainment);

  // Scroll-edge fades: shown only while more rows exist in that direction.
  // Measured after every render (the row count only changes via a render)
  // and on scroll; the prev-compare keeps the every-render effect inert.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState({ top: false, bottom: false });
  const syncFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const top = el.scrollTop > 2;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 2;
    setFade((prev) =>
      prev.top === top && prev.bottom === bottom ? prev : { top, bottom },
    );
  }, []);
  useEffect(syncFades);

  return (
    <ReportCardShell
      title="Tour Coverage"
      description="Tour days by city, actual vs planned"
      icon={Route}
      className="lg:col-span-3"
      isFetching={isFetching}
      headerRight={
        <MetricRangeFilter mode="monthly" window={window} onChange={setWindow} />
      }
    >
      {!data ? (
        <ReportChartSkeleton />
      ) : view.cities.length === 0 ? (
        <ReportCardEmpty message="No tours logged in this range." />
      ) : (
        <>
          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={syncFades}
              className="max-h-60 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]"
            >
              <ul aria-label="Tour days by city">
                {view.cities.map((c) => (
                  <CityRow key={c.city} city={c} scale={view.scale} />
                ))}
              </ul>
            </div>
            {fade.top && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white to-transparent"
              />
            )}
            {fade.bottom && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent"
              />
            )}
          </div>

          {/* Legend swatches mirror the real bar shapes (slim indigo fill,
              thick light track) so the encoding explains itself. */}
          <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-1.5 w-5 rounded-full bg-indigo-500"
              />
              Actual days
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-2.5 w-5 rounded-full bg-slate-200"
              />
              Target days
            </span>
          </div>

          <StatRow>
            <StatItem
              label="Cities covered"
              value={`${data.totals.citiesCovered} / ${data.totals.citiesPlanned}`}
            />
            <StatItem
              label="Actual days"
              value={fmtDays(data.totals.actual)}
            />
            <StatItem
              label="Target days"
              value={fmtDays(data.totals.target)}
            />
            <StatItem
              label="Attainment"
              value={fmtPct(attainment)}
              valueClass={STATUS_TEXT[status]}
            />
          </StatRow>
        </>
      )}
    </ReportCardShell>
  );
}

/** One bullet row: city label + values above a target track with the actual
 *  bar overlaid. The fixed row height means 30 cities is just a longer
 *  scroll, never a squashed chart; an actual bar running past the end of
 *  its track reads as "over target" at a glance. */
function CityRow({ city: c, scale }: { city: TourCity; scale: number }) {
  const targetPct = (c.target / scale) * 100;
  const actualPct = (c.actual / scale) * 100;

  return (
    <li
      className="group flex min-h-10 flex-col justify-center gap-1"
      title={`${c.city}: ${fmtDays(c.actual)} of ${fmtDays(c.target)} target days`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-xs font-medium text-slate-600 transition-colors group-hover:text-slate-900">
          {c.city}
        </span>
        <span className="shrink-0 text-xs tabular-nums text-slate-400">
          <span className="font-semibold text-slate-800">
            {fmtDays(c.actual)}
          </span>
          {` / ${fmtDays(c.target)}d`}
        </span>
      </div>

      <div aria-hidden className="relative h-2.5">
        {c.target > 0 && (
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-slate-200 transition-[width,background-color] duration-500 ease-out group-hover:bg-slate-300/80"
            style={{ width: `${targetPct}%` }}
          />
        )}
        {c.actual > 0 && (
          <div
            className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-500 transition-[width] duration-500 ease-out group-hover:bg-indigo-600"
            style={{ width: `${actualPct}%` }}
          />
        )}
      </div>
    </li>
  );
}
