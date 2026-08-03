"use client";

/**
 * Employee scope picker for the Compare views. Drives three URL states (see the
 * scope model in _lib/comparative.ts): no param = the ENTIRE ROSTER, `?ids=a,b`
 * = an explicit subset, `?ids=` = explicitly nobody.
 *
 * "All employees" is the DEFAULT and is a first-class row at the top of the
 * list, not a bulk action that expands into 200 ticked boxes — that keeps the
 * URL clean (no ids enumerated) and makes the company-wide question, which is
 * the one management actually asks, a single click. Picking an individual from
 * the all-scope state starts a fresh explicit selection, so the two modes never
 * blur into a half-state.
 *
 * There is NO cap on how many people you can analyse — the rich table and the
 * attainment filter work across the whole roster. The only bound is
 * MAX_EXPLICIT_IDS, which exists to keep the query string within safe length,
 * and it applies only to hand-picked subsets. Chart capacity is a separate
 * concern handled by pinning in the table.
 *
 * Selection changes navigate (`router.replace` — toggles shouldn't stack
 * history) inside a transition mirrored into navigationPendingStore, so the
 * table and chart dim-not-flash while the new scope streams in.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Users, UsersRound, X } from "lucide-react";
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
  MAX_EXPLICIT_IDS,
  serializeCompareIds,
} from "../_lib/comparative";

export type MultiOption = { id: string; name: string; emp_id: string };

/** Local mirror of the URL scope, so a click paints instantly. */
type Scope = { all: boolean; ids: string[] };

export function ReportEmployeeMultiSelect({
  employees,
  selectedIds,
  isAllScope,
}: {
  employees: MultiOption[];
  /** Effective ids — the full roster when isAllScope. */
  selectedIds: string[];
  isAllScope: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [scope, setScope] = useState<Scope>(() => ({
    all: isAllScope,
    ids: isAllScope ? [] : selectedIds,
  }));
  useEffect(() => {
    setScope({ all: isAllScope, ids: isAllScope ? [] : selectedIds });
  }, [isAllScope, selectedIds]);

  useEffect(() => {
    if (isPending) {
      navigationPendingStore.start();
      return () => navigationPendingStore.end();
    }
  }, [isPending]);

  const explicitSet = useMemo(() => new Set(scope.ids), [scope.ids]);
  const atCap = !scope.all && scope.ids.length >= MAX_EXPLICIT_IDS;

  const commit = (next: Scope) => {
    setScope(next);
    startTransition(() => {
      // Absent param = whole roster; empty param = explicitly nobody.
      const qs = next.all
        ? ""
        : next.ids.length
          ? `?ids=${serializeCompareIds(next.ids)}`
          : "?ids=";
      router.replace(`${pathname}${qs}`, { scroll: false });
    });
  };

  const toggle = (id: string) => {
    // From all-scope, picking someone starts a fresh explicit selection rather
    // than trying to express "everyone except them" (which for a large roster
    // wouldn't fit in the URL anyway).
    if (scope.all) {
      commit({ all: false, ids: [id] });
      return;
    }
    if (explicitSet.has(id)) {
      commit({ all: false, ids: scope.ids.filter((x) => x !== id) });
    } else if (!atCap) {
      commit({ all: false, ids: [...scope.ids, id] });
    }
  };

  const label = scope.all
    ? `All employees · ${employees.length}`
    : scope.ids.length === 0
      ? "Select employees…"
      : `${scope.ids.length} of ${employees.length} selected`;

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
              <span
                className={cn(
                  "truncate tabular-nums",
                  scope.all || scope.ids.length
                    ? "text-slate-800"
                    : "text-slate-500",
                )}
              >
                {label}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Button>
        }
      />
      <PopoverContent
        align="start"
        sideOffset={6}
        className="w-80 gap-0 p-0 ring-slate-200"
      >
        <Command>
          <CommandInput placeholder="Search by name or ID…" />

          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-2 py-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              {scope.all
                ? "Whole roster"
                : `${scope.ids.length} / ${MAX_EXPLICIT_IDS} picked`}
            </span>
            {!scope.all && scope.ids.length > 0 && (
              <button
                type="button"
                onClick={() => commit({ all: false, ids: [] })}
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
              {/* Scope row: one click back to company-wide. */}
              <CommandItem
                value="__all__ all employees entire roster company"
                onSelect={() => commit({ all: true, ids: [] })}
                className="gap-2"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ring-1 transition-colors",
                    scope.all
                      ? "bg-indigo-600 ring-indigo-600"
                      : "bg-white ring-slate-300",
                  )}
                >
                  {scope.all && (
                    <Check className="h-3 w-3 text-white" strokeWidth={3} />
                  )}
                </span>
                <UsersRound className="h-3.5 w-3.5 shrink-0 text-indigo-500/70" />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium text-slate-800">
                    All employees
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Analyse the entire roster ({employees.length})
                  </span>
                </span>
              </CommandItem>
            </CommandGroup>

            <CommandGroup>
              {employees.map((e) => {
                const isSelected = !scope.all && explicitSet.has(e.id);
                const disabled = atCap && !isSelected;
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
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] ring-1 transition-colors",
                        isSelected
                          ? "bg-indigo-600 ring-indigo-600"
                          : "bg-white ring-slate-300",
                      )}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
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
