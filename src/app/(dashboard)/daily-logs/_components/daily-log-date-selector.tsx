"use client";

/**
 * Date selector for Daily Logs — Prev / Date popover / Next / Today.
 *
 * Lives inside the table toolbar (a sibling of Search and Set Targets),
 * which keeps the unsaved-changes confirm fully synchronous and lets us
 * pass `dirtyCount` down through props instead of bridging a cross-tree
 * subscribable store. The toolbar sits OUTSIDE the dim/disable Card, so
 * the selector remains interactive while the table dims to 60% opacity
 * during a fetch — same UX guarantee the previous architecture provided.
 *
 * `useTransition` wraps `router.push` so the click handler returns
 * instantly while the RSC payload streams in the background. The Card's
 * `isFetching` overlay (driven by TanStack Query's `keepPreviousData`)
 * handles the visual dim.
 *
 * The calendar popover uses month/year dropdowns (captionLayout
 * "dropdown") bounded to the app-wide window in lib/date-bounds — data
 * epoch (2019) through end of next year. Future days stay reachable on
 * purpose: per-day targets are edited inline in the grid, so admins
 * navigate ahead to plan.
 */

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  segmentedButtonClass,
  segmentedDividerClass,
  segmentedGroupClass,
} from "@/components/toolbar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { navigationPendingStore } from "@/lib/navigation-pending";
import {
  DATA_EPOCH_YEAR,
  dataEpochDate,
  maxSelectableYear,
} from "@/lib/date-bounds";

const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** ISO floor for Prev/Next clamping — first day of the data epoch. */
const EPOCH_ISO = `${DATA_EPOCH_YEAR}-01-01`;

function toLocalDateString(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function shiftDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const shifted = new Date(y, m - 1, d + days);
  return toLocalDateString(shifted);
}

function formatShortDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return `${SHORT_DAYS[dow]}, ${d} ${LONG_MONTHS[m - 1]} ${y}`;
}

type Props = {
  date: string;
  /** Number of rows with unsaved edits. Drives the unsaved-changes
   *  confirm before navigating. Passed in as a prop now that the
   *  selector lives in the same tree as the view that tracks dirty
   *  state. */
  dirtyCount: number;
};

export function DailyLogDateSelector({ date, dirtyCount }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [calendarOpen, setCalendarOpen] = useState(false);
  // `mounted` gates the "Today" pill — Date.now() differs between server
  // render and client hydration if the user opens the page near midnight.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Mirror this hook-local isPending into the shared navigation store
  // so the data view below (which sits in a different tree branch and
  // has no other signal for in-flight RSC) can dim the moment the
  // user clicks Prev / Next / Today / a calendar day.
  useEffect(() => {
    if (isPending) {
      navigationPendingStore.start();
      return () => navigationPendingStore.end();
    }
  }, [isPending]);

  const selectedDate = useMemo(() => {
    const [y, m, d] = date.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [date]);

  const today = useMemo(() => toLocalDateString(new Date()), []);

  // Selectable window: data epoch → end of next year. The future stays
  // reachable on purpose (per-day targets are planned ahead in the grid);
  // the epoch floor matches every other time filter in the app.
  const bounds = useMemo(() => {
    const lastYear = maxSelectableYear();
    return {
      startMonth: dataEpochDate(),
      endMonth: new Date(lastYear, 11, 1),
      maxIso: `${lastYear}-12-31`,
    };
  }, []);

  const navigate = useCallback(
    (newDate: string) => {
      if (newDate === date) return;
      if (newDate < EPOCH_ISO || newDate > bounds.maxIso) return;
      if (
        dirtyCount > 0 &&
        !window.confirm("You have unsaved changes. Discard?")
      ) {
        return;
      }
      // Merge with existing URL params so other filters (e.g. ?query=) survive.
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", newDate);
      startTransition(() => {
        router.push(`/daily-logs?${params.toString()}`);
      });
    },
    [date, dirtyCount, router, searchParams, bounds.maxIso],
  );

  // We deliberately do NOT disable buttons on isPending here. The Card
  // below dims to opacity-60 during the fetch; double-disabling here
  // would make rapid Prev/Next clicks feel laggy.
  //
  // One fused segmented control — ‹ | date | › — matching the shared
  // MonthSelector's cluster, with the Today pill floating alongside.
  return (
    <div className="flex items-center gap-2">
      <div className={segmentedGroupClass}>
        <button
          type="button"
          onClick={() => navigate(shiftDate(date, -1))}
          disabled={date <= EPOCH_ISO}
          aria-label="Previous day"
          className={segmentedButtonClass}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span aria-hidden className={segmentedDividerClass} />

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                id="daily-logs-date-trigger"
                className="flex h-full items-center gap-2 px-3 text-sm font-medium text-slate-700 outline-none transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:bg-indigo-50/70 data-[popup-open]:bg-slate-50"
              />
            }
          >
            <CalendarDays className="h-4 w-4 text-indigo-500/80" />
            <span className="tabular-nums">{formatShortDate(date)}</span>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 shadow-lg" align="start">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(day) => {
                if (day) {
                  setCalendarOpen(false);
                  navigate(toLocalDateString(day));
                }
              }}
              defaultMonth={selectedDate}
              captionLayout="dropdown"
              startMonth={bounds.startMonth}
              endMonth={bounds.endMonth}
            />
          </PopoverContent>
        </Popover>

        <span aria-hidden className={segmentedDividerClass} />

        {/* maxIso derives from the clock — gate behind `mounted` like the
            Today pill so an SSR/client year-boundary drift can't cause a
            hydration mismatch. (EPOCH_ISO is a constant; no gate needed.) */}
        <button
          type="button"
          onClick={() => navigate(shiftDate(date, 1))}
          disabled={mounted && date >= bounds.maxIso}
          aria-label="Next day"
          className={segmentedButtonClass}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {mounted && date !== today && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(today)}
          className="h-9 rounded-lg px-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
        >
          Today
        </Button>
      )}
    </div>
  );
}
