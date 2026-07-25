"use client";

/**
 * Attainment threshold filter for the Compare toolbars — "show me only the
 * people above 100%", the question management asks first.
 *
 * Deliberately mirrors MetricRangeFilter's two-screen popover (preset list →
 * "Custom…" screen with Apply/Cancel), because that interaction already exists
 * one control to its right; a slider would have been a second, unrelated idiom
 * in the same strip. Bands are min-inclusive / max-exclusive so the presets tile
 * the number line — an employee at exactly 100% lands in "On target", never in
 * "Near target" as well.
 *
 * Filtering is pure presentation over data already in the browser: it never
 * refetches, so results are instant and the trend axis stays stable.
 */

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronLeft, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  ATTAINMENT_ALL,
  ATTAINMENT_PRESETS,
  attainmentRangeLabel,
  isAttainmentActive,
  sameAttainmentRange,
  type AttainmentPreset,
  type AttainmentRange,
} from "../_lib/comparative";

export function AttainmentFilter({
  value,
  onChange,
  label = "Attainment",
  presets = ATTAINMENT_PRESETS,
}: {
  value: AttainmentRange;
  onChange: (r: AttainmentRange) => void;
  /** Metric-specific noun — Conversion filters on its rate, not on a target. */
  label?: string;
  /** Bands offered; Conversion swaps in rate-shaped ones. */
  presets?: AttainmentPreset[];
}) {
  const [open, setOpen] = useState(false);
  const [screen, setScreen] = useState<"presets" | "custom">("presets");

  useEffect(() => {
    if (open) setScreen("presets");
  }, [open]);

  const active = isAttainmentActive(value);
  const activePresetIndex = useMemo(
    () => presets.findIndex((p) => sameAttainmentRange(p.range, value)),
    [presets, value],
  );
  const isCustom = active && activePresetIndex < 0;

  const pick = (r: AttainmentRange) => {
    onChange(r);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 gap-2 rounded-lg border-slate-200 bg-white px-3",
              "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all",
              "hover:border-slate-300 hover:bg-slate-50",
              active &&
                "border-indigo-200 bg-indigo-50/70 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50",
              open && "border-indigo-300 ring-4 ring-indigo-500/10",
            )}
          >
            <Gauge
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-indigo-500" : "text-indigo-500/70",
              )}
            />
            <span className="truncate text-sm font-medium tabular-nums">
              {active ? attainmentRangeLabel(value) : label}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                active ? "text-indigo-400" : "text-slate-400",
                open && "rotate-180",
              )}
            />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn("gap-0 p-0 ring-slate-200", screen === "presets" ? "w-56" : "w-60")}
      >
        {screen === "presets" ? (
          <div className="p-1.5">
            <div className="mb-1 px-1.5 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {label}
            </div>
            <div className="flex flex-col">
              {presets.map((p, i) => {
                const isActive = i === activePresetIndex;
                return (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => pick(p.range)}
                    className={cn(
                      "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50",
                    )}
                  >
                    {p.label}
                    {isActive && <Check className="h-3.5 w-3.5" />}
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
                  isCustom
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <span className="flex items-center gap-1.5">
                  <Gauge className="h-3.5 w-3.5" />
                  Custom…
                </span>
                {isCustom && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
        ) : (
          <CustomBand
            initial={value}
            onBack={() => setScreen("presets")}
            onApply={pick}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

function CustomBand({
  initial,
  onBack,
  onApply,
}: {
  initial: AttainmentRange;
  onBack: () => void;
  onApply: (r: AttainmentRange) => void;
}) {
  const [min, setMin] = useState(initial.min === null ? "" : String(initial.min));
  const [max, setMax] = useState(initial.max === null ? "" : String(initial.max));

  const parse = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  const minNum = parse(min);
  const maxNum = parse(max);
  // A typed-but-unparseable value is an error; both empty is just "All".
  const invalid =
    (min.trim() !== "" && minNum === null) ||
    (max.trim() !== "" && maxNum === null) ||
    (minNum !== null && maxNum !== null && minNum >= maxNum);

  const hint = invalid
    ? "Min must be below max."
    : minNum === null && maxNum === null
      ? "Leave both blank to show everyone."
      : minNum !== null && maxNum !== null
        ? `Shows ${minNum}% up to (not including) ${maxNum}%.`
        : minNum !== null
          ? `Shows ${minNum}% and above.`
          : `Shows below ${maxNum}%.`;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
        <span className="text-xs font-semibold text-slate-700">Custom band</span>
      </div>

      <div className="flex items-end gap-2 px-3 py-3">
        <Field label="Min %" value={min} onChange={setMin} placeholder="0" />
        <span className="pb-2 text-xs text-slate-400">to</span>
        <Field label="Max %" value={max} onChange={setMax} placeholder="∞" />
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/60 px-3 py-2.5">
        <span
          className={cn(
            "flex-1 text-[11px] leading-tight",
            invalid ? "text-rose-600" : "text-slate-500",
          )}
        >
          {hint}
        </span>
        <Button
          size="sm"
          disabled={invalid}
          onClick={() => onApply({ min: minNum, max: maxNum })}
          className="h-8 shrink-0 bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Apply
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex-1 space-y-1">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="decimal"
        className="h-8 rounded-lg border-slate-200 bg-white tabular-nums focus-visible:border-indigo-300 focus-visible:ring-4 focus-visible:ring-indigo-500/10"
      />
    </label>
  );
}

export { ATTAINMENT_ALL };
