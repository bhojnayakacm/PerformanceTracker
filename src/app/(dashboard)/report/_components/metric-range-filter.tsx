"use client";

/**
 * Per-card, granularity-aware time filter. The whole point of the Report:
 * every card owns its OWN window, so this is local state (via onChange) —
 * NOT a URL-driven page-global filter. `mode` decides which preset set is
 * offered, which is how we keep "Last 7 Days" off the monthly-atomic cards
 * (Dispatch/Visits/Conversion/Tour/Costing) where sub-monthly data doesn't
 * exist.
 */

import { useMemo, useState } from "react";
import { CalendarRange, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  dailyPresets,
  monthlyPresets,
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

export function MetricRangeFilter(props: Props) {
  const [open, setOpen] = useState(false);

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
    // Safe by construction: in `daily` mode `items` only holds DailyWindows,
    // and vice-versa — TS just can't correlate the union across the closure.
    if (props.mode === "daily") props.onChange(w as DailyWindow);
    else props.onChange(w as MonthlyWindow);
    setOpen(false);
  };

  const label = activeIndex >= 0 ? items[activeIndex].label : "Custom";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-xs font-medium"
          >
            <CalendarRange className="h-3.5 w-3.5 text-indigo-500/70" />
            <span className="tracking-tight">{label}</span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={6}
        className="w-48 gap-0 p-1.5 ring-slate-200"
      >
        <div className="mb-1 px-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {kindLabel}
        </div>
        <div className="flex flex-col">
          {items.map((it, i) => {
            const isActive = i === activeIndex;
            return (
              <button
                key={it.label}
                type="button"
                onClick={() => pick(it.window)}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                  isActive
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                {it.label}
                {isActive && <Check className="h-3.5 w-3.5" />}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
