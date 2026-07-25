"use client";

/**
 * Multi-select employee combobox for the Compare views — the multi sibling of
 * ReportEmployeeSelector. Selecting drives `?ids=a,b,c`; the roster is already
 * scoped to the caller (getEmployeesForUser) so a user can only ever compare
 * employees they may see.
 *
 * Selection is CAPPED at MAX_COMPARE (the palette has exactly that many CVD-safe
 * slots), so the "9th series" problem is impossible by construction — past the
 * cap, unpicked rows disable rather than silently no-op. Each toggle updates an
 * optimistic local set for instant check feedback, then navigates (router.replace
 * — toggles shouldn't stack history) inside a transition mirrored into
 * navigationPendingStore, so the charts dim-not-flash while the new set streams
 * in (the same mechanism the single-select + MonthRangeSelector use). Colour is
 * fixed by SELECTION ORDER, so the dot beside each name previews the exact hue
 * that employee will own in the chart.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { navigationPendingStore } from "@/lib/navigation-pending";
import {
  MAX_COMPARE,
  SERIES_PALETTE,
  serializeCompareIds,
} from "../_lib/comparative";

export type MultiOption = { id: string; name: string; emp_id: string };

export function ReportEmployeeMultiSelect({
  employees,
  selectedIds,
}: {
  employees: MultiOption[];
  selectedIds: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Optimistic mirror of the URL selection: toggles paint the checkbox instantly
  // while the navigation settles, then re-sync when the URL prop lands.
  const [selected, setSelected] = useState<string[]>(selectedIds);
  useEffect(() => setSelected(selectedIds), [selectedIds]);

  useEffect(() => {
    if (isPending) {
      navigationPendingStore.start();
      return () => navigationPendingStore.end();
    }
  }, [isPending]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const atCap = selected.length >= MAX_COMPARE;
  const slotOf = useMemo(() => {
    const m = new Map<string, number>();
    selected.forEach((id, i) => m.set(id, i));
    return m;
  }, [selected]);

  const commit = (next: string[]) => {
    setSelected(next);
    startTransition(() => {
      const qs = next.length ? `?ids=${serializeCompareIds(next)}` : "";
      router.replace(`${pathname}${qs}`, { scroll: false });
    });
  };

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      commit(selected.filter((x) => x !== id));
    } else if (!atCap) {
      commit([...selected, id]);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-9 w-full justify-between gap-2 rounded-lg border-slate-200 bg-white px-3 sm:w-72",
              "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all",
              "hover:border-slate-300 hover:bg-slate-50",
              open && "border-indigo-300 ring-4 ring-indigo-500/10",
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <Users className="h-4 w-4 shrink-0 text-indigo-500/70" />
              {selected.length > 0 && (
                <span className="flex -space-x-1">
                  {selected.slice(0, 5).map((id, i) => (
                    <span
                      key={id}
                      className="h-2.5 w-2.5 rounded-full ring-2 ring-white"
                      style={{ background: SERIES_PALETTE[i] }}
                    />
                  ))}
                </span>
              )}
              <span
                className={cn(
                  "truncate",
                  selected.length ? "text-slate-800" : "text-slate-500",
                )}
              >
                {selected.length === 0
                  ? "Select employees…"
                  : `${selected.length} ${
                      selected.length === 1 ? "employee" : "employees"
                    }`}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-72 gap-0 p-0 ring-slate-200"
      >
        <Command>
          <CommandInput placeholder="Search by name or ID…" />
          <div className="flex items-center justify-between px-2 pt-2 pb-1">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {selected.length} / {MAX_COMPARE} selected
            </span>
            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => commit([])}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            )}
          </div>
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {employees.map((e) => {
                const isSelected = selectedSet.has(e.id);
                const disabled = atCap && !isSelected;
                const slot = slotOf.get(e.id);
                return (
                  <CommandItem
                    key={e.id}
                    value={`${e.name} ${e.emp_id} ${e.id}`}
                    onSelect={() => toggle(e.id)}
                    disabled={disabled}
                    className={cn("gap-2", disabled && "opacity-40")}
                  >
                    <span
                      className={cn(
                        "flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ring-1 transition-colors",
                        isSelected
                          ? "ring-transparent"
                          : "bg-white ring-slate-300",
                      )}
                      style={
                        isSelected && slot !== undefined
                          ? { background: SERIES_PALETTE[slot] }
                          : undefined
                      }
                    >
                      {isSelected && (
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-slate-800">
                        {e.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {e.emp_id}
                      </span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
