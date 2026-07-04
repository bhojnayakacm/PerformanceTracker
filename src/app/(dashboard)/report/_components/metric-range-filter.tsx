"use client";

/**
 * Per-card, granularity-aware time filter. The whole point of the Report:
 * every card owns its OWN window, so this is local state (via onChange) —
 * NOT a URL-driven page-global filter. `mode` decides which preset set is
 * offered, which keeps "Last 7 Days" off the monthly-atomic cards.
 *
 * The popover has two screens. "presets" lists the quick ranges + a "Custom…"
 * row; clicking it swaps to "custom", which is granularity-aware:
 *   • daily   → a shadcn Calendar range picker (day-level, future disabled).
 *   • monthly → a month+year From/To selector, so nobody mistakes it for a
 *     day-level filter and the payload is always whole months.
 * Custom selection is plain local state layered over the SSR default window,
 * so hydration + keepPreviousData are untouched.
 */

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import {
  CalendarRange,
  Check,
  ChevronDown,
  ChevronLeft,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import {
  dailyPresets,
  dailyWindowFromDates,
  dailyWindowLabel,
  monthlyPresets,
  monthlyWindowLabel,
  monthOrd,
  type DailyWindow,
  type MonthlyWindow,
} from "../_lib/report-ranges";

type Props =
  | { mode: "daily"; window: DailyWindow; onChange: (w: DailyWindow) => void }
  | {
      mode: "monthly";
      window: MonthlyWindow;
      onChange: (w: MonthlyWindow) => void;
    };

const MONTHS_FULL = [
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

export function MetricRangeFilter(props: Props) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"presets" | "custom">("presets");

  // Always reopen on the preset list, even if a custom range is active.
  useEffect(() => {
    if (open) setScreen("presets");
  }, [open]);

  const { items, activeIndex, kindLabel } = useMemo(() => {
    if (props.mode === "daily") {
      const presets = dailyPresets();
      const w = props.window;
      return {
        kindLabel: "Daily range",
        items: presets.map((p) => ({ label: p.label, window: p.window })),
        activeIndex: presets.findIndex(
          (p) =>
            p.window.from === w.from &&
            p.window.to === w.to &&
            p.window.bucket === w.bucket,
        ),
      };
    }
    const presets = monthlyPresets();
    const w = props.window;
    return {
      kindLabel: "Monthly range",
      items: presets.map((p) => ({ label: p.label, window: p.window })),
      activeIndex: presets.findIndex(
        (p) =>
          p.window.fromMonth === w.fromMonth &&
          p.window.fromYear === w.fromYear &&
          p.window.toMonth === w.toMonth &&
          p.window.toYear === w.toYear,
      ),
    };
  }, [props.mode, props.window]);

  const pick = (w: DailyWindow | MonthlyWindow) => {
    if (props.mode === "daily") props.onChange(w as DailyWindow);
    else props.onChange(w as MonthlyWindow);
    setOpen(false);
  };

  const isCustomActive = activeIndex < 0;
  const label = isCustomActive
    ? props.mode === "daily"
      ? dailyWindowLabel(props.window)
      : monthlyWindowLabel(props.window)
    : items[activeIndex].label;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 max-w-[190px] gap-1.5 px-2.5 text-xs font-medium"
          >
            <CalendarRange className="h-3.5 w-3.5 shrink-0 text-indigo-500/70" />
            <span className="truncate tracking-tight">{label}</span>
            <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={6}
        className={cn(
          "gap-0 p-0 ring-slate-200",
          screen === "presets" ? "w-52" : props.mode === "daily" ? "w-auto" : "w-60",
        )}
      >
        {screen === "presets" ? (
          <div className="p-1.5">
            <div className="mb-1 px-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {kindLabel}
            </div>
            <div className="flex flex-col">
              {items.map((it, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={it.label}
                    type="button"
                    onClick={() => pick(it.window)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                      active
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {it.label}
                    {active && <Check className="h-3.5 w-3.5" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 border-t border-slate-100 pt-1">
              <button
                type="button"
                onClick={() => setScreen("custom")}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  isCustomActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Custom…
                </span>
                {isCustomActive && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ) : props.mode === "daily" ? (
          <DailyCustomPicker
            initial={props.window}
            onBack={() => setScreen("presets")}
            onApply={(w) => {
              props.onChange(w);
              setOpen(false);
            }}
          />
        ) : (
          <MonthlyCustomPicker
            initial={props.window}
            onBack={() => setScreen("presets")}
            onApply={(w) => {
              props.onChange(w);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function PickerHeader({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back
      </button>
      <span className="text-xs font-semibold text-slate-700">Custom range</span>
    </div>
  );
}

function PickerFooter({
  hint,
  disabled,
  onCancel,
  onApply,
}: {
  hint: string;
  disabled: boolean;
  onCancel: () => void;
  onApply: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <span className="truncate text-xs text-slate-500">{hint}</span>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} className="h-8">
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={onApply}
          disabled={disabled}
          className="h-8 bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function DailyCustomPicker({
  initial,
  onBack,
  onApply,
}: {
  initial: DailyWindow;
  onBack: () => void;
  onApply: (w: DailyWindow) => void;
}) {
  const today = useMemo(() => new Date(), []);
  const startMonth = useMemo(
    () => new Date(today.getFullYear() - 5, 0, 1),
    [today],
  );
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: new Date(`${initial.from}T00:00:00`),
    to: new Date(`${initial.to}T00:00:00`),
  }));

  const previewWindow =
    range?.from && range?.to
      ? dailyWindowFromDates(range.from, range.to)
      : null;

  return (
    <div className="flex flex-col">
      <PickerHeader onBack={onBack} />
      <Calendar
        mode="range"
        numberOfMonths={1}
        selected={range}
        onSelect={setRange}
        captionLayout="dropdown"
        startMonth={startMonth}
        endMonth={today}
        defaultMonth={range?.from ?? today}
        disabled={{ after: today }}
        className="p-2"
      />
      <PickerFooter
        hint={
          previewWindow
            ? dailyWindowLabel(previewWindow)
            : "Pick a start & end date"
        }
        disabled={!previewWindow}
        onCancel={onBack}
        onApply={() => {
          if (previewWindow) onApply(previewWindow);
        }}
      />
    </div>
  );
}

function MonthlyCustomPicker({
  initial,
  onBack,
  onApply,
}: {
  initial: MonthlyWindow;
  onBack: () => void;
  onApply: (w: MonthlyWindow) => void;
}) {
  const [from, setFrom] = useState({
    month: initial.fromMonth,
    year: initial.fromYear,
  });
  const [to, setTo] = useState({
    month: initial.toMonth,
    year: initial.toYear,
  });

  const years = useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 7 }, (_, i) => cy - 5 + i); // cy-5 … cy+1
  }, []);

  const inverted = monthOrd(from.month, from.year) > monthOrd(to.month, to.year);
  const spanMonths =
    monthOrd(to.month, to.year) - monthOrd(from.month, from.year) + 1;

  return (
    <div className="flex flex-col">
      <PickerHeader onBack={onBack} />
      <div className="flex flex-col gap-3 px-3 py-3">
        <MonthYearPanel label="From" value={from} onChange={setFrom} years={years} />
        <MonthYearPanel label="To" value={to} onChange={setTo} years={years} />
        {inverted && (
          <p className="text-xs text-rose-600">
            &ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.
          </p>
        )}
      </div>
      <PickerFooter
        hint={inverted ? "" : `${spanMonths} month${spanMonths === 1 ? "" : "s"} selected`}
        disabled={inverted}
        onCancel={onBack}
        onApply={() =>
          onApply({
            fromMonth: from.month,
            fromYear: from.year,
            toMonth: to.month,
            toYear: to.year,
          })
        }
      />
    </div>
  );
}

function MonthYearPanel({
  label,
  value,
  onChange,
  years,
}: {
  label: string;
  value: { month: number; year: number };
  onChange: (v: { month: number; year: number }) => void;
  years: number[];
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <Select
          value={String(value.month)}
          onValueChange={(v) => onChange({ ...value, month: Number(v) })}
        >
          <SelectTrigger className="flex-1 bg-white">
            <span className="flex-1 text-left">{MONTHS_FULL[value.month - 1]}</span>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {MONTHS_FULL.map((name, i) => (
              <SelectItem key={i + 1} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={String(value.year)}
          onValueChange={(v) => onChange({ ...value, year: Number(v) })}
        >
          <SelectTrigger className="w-[86px] bg-white">
            <span className="flex-1 text-left">{value.year}</span>
          </SelectTrigger>
          <SelectContent align="start" alignItemWithTrigger={false}>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
