"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  segmentedButtonClass,
  segmentedDividerClass,
  segmentedGroupClass,
} from "@/components/toolbar";
import { cn } from "@/lib/utils";
import { navigationPendingStore } from "@/lib/navigation-pending";
import { selectableYears } from "@/lib/date-bounds";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Select triggers rendered as flush segments inside the fused group —
 *  borderless, full-height, with a soft fill on hover/focus instead of the
 *  standalone ring (the group's border does the framing). */
const SEGMENT_TRIGGER =
  "data-[size=default]:h-full rounded-none border-none bg-transparent px-2.5 shadow-none transition-colors hover:bg-slate-50 focus-visible:bg-indigo-50/70 focus-visible:ring-0";

type Props = {
  month: number;
  year: number;
  basePath: string;
  /**
   * Optional extras to merge into the URL at navigation time.
   * Callers use this to inject client-held values (e.g. a pending
   * debounced search) that may not yet be in the URL when the user
   * clicks a month control — prevents filter loss when a sibling
   * Suspense boundary remounts on month/year change.
   * Key with empty-string value means "delete this param".
   */
  getExtraParams?: () => Record<string, string>;
};

export function MonthSelector({
  month,
  year,
  basePath,
  getExtraParams,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Wrap router.push so React holds the old UI during the RSC fetch
  // instead of freezing the click handler. Pairs with TanStack Query's
  // placeholderData on the consuming grid — the table dims while the
  // new month resolves, never flashes a skeleton.
  const [isPending, startTransition] = useTransition();

  // Mirror this hook-local isPending into the shared navigation store
  // so the Grid below us (which has no other signal that a navigation
  // has started) can apply the dim overlay the moment the user clicks.
  // Cleanup pair guarantees the refcount stays balanced.
  useEffect(() => {
    if (isPending) {
      navigationPendingStore.start();
      return () => navigationPendingStore.end();
    }
  }, [isPending]);

  const navigate = (m: number, y: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", String(m));
    params.set("year", String(y));
    const extras = getExtraParams?.();
    if (extras) {
      for (const [k, v] of Object.entries(extras)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
    }
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`);
    });
  };

  const goPrev = () => {
    if (month === 1) navigate(12, year - 1);
    else navigate(month - 1, year);
  };

  const goNext = () => {
    if (month === 12) navigate(1, year + 1);
    else navigate(month + 1, year);
  };

  const years = selectableYears();

  // One fused segmented control — ‹ | month | year | › — instead of four
  // free-floating fields. Hairlines separate the segments; the shared
  // outer border keeps the cluster reading as a single instrument.
  return (
    <div className={segmentedGroupClass}>
      <button
        type="button"
        onClick={goPrev}
        aria-label="Previous month"
        className={segmentedButtonClass}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <span aria-hidden className={segmentedDividerClass} />

      <Select
        value={String(month)}
        onValueChange={(val) => navigate(Number(val), year)}
      >
        <SelectTrigger className={cn(SEGMENT_TRIGGER, "w-[126px]")}>
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-indigo-500/80" />
          <span className="flex-1 truncate text-left font-medium text-slate-700">
            {MONTHS[month - 1]}
          </span>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {MONTHS.map((name, i) => (
            <SelectItem key={i + 1} value={String(i + 1)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden className={segmentedDividerClass} />

      <Select
        value={String(year)}
        onValueChange={(val) => navigate(month, Number(val))}
      >
        <SelectTrigger className={cn(SEGMENT_TRIGGER, "w-[78px]")}>
          <span className="flex-1 text-left font-medium tabular-nums text-slate-700">
            {year}
          </span>
        </SelectTrigger>
        <SelectContent align="start" alignItemWithTrigger={false}>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <span aria-hidden className={segmentedDividerClass} />

      <button
        type="button"
        onClick={goNext}
        aria-label="Next month"
        className={segmentedButtonClass}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
