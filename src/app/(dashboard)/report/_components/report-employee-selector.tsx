"use client";

/**
 * Searchable employee combobox (cmdk) that drives `?employeeId=`. The roster
 * is passed in already scoped to the caller (getEmployeesForUser on the
 * server), so a user can only ever pick employees they're allowed to see.
 *
 * Switching employee is a real navigation (URL change → server re-prefetch),
 * wrapped in a transition and mirrored into navigationPendingStore so every
 * card dims-not-flashes while the new employee's data streams in — the same
 * mechanism the shared MonthRangeSelector uses.
 */

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronsUpDown, UserRound } from "lucide-react";
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

export type ReportEmployeeOption = {
  id: string;
  name: string;
  emp_id: string;
};

export function ReportEmployeeSelector({
  employees,
  selectedId,
}: {
  employees: ReportEmployeeOption[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (isPending) {
      navigationPendingStore.start();
      return () => navigationPendingStore.end();
    }
  }, [isPending]);

  const selected = useMemo(
    () => employees.find((e) => e.id === selectedId) ?? null,
    [employees, selectedId],
  );

  const select = (id: string) => {
    setOpen(false);
    if (id === selectedId) return;
    startTransition(() => {
      router.push(`/report?employeeId=${id}`);
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="h-9 w-full justify-between gap-2 px-3 sm:w-72"
          >
            <span className="flex min-w-0 items-center gap-2">
              <UserRound className="h-4 w-4 shrink-0 text-indigo-500/70" />
              <span className="truncate">
                {selected ? selected.name : "Select an employee…"}
              </span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
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
          <CommandList>
            <CommandEmpty>No employee found.</CommandEmpty>
            <CommandGroup>
              {employees.map((e) => {
                const isSelected = e.id === selectedId;
                return (
                  <CommandItem
                    key={e.id}
                    // name + emp_id so typing either filters; id guarantees a
                    // unique cmdk value even for duplicate display names.
                    value={`${e.name} ${e.emp_id} ${e.id}`}
                    onSelect={() => select(e.id)}
                    className="gap-2"
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm text-slate-800">
                        {e.name}
                      </span>
                      <span className="truncate text-[11px] text-muted-foreground">
                        {e.emp_id}
                      </span>
                    </span>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4 text-indigo-600",
                        isSelected ? "opacity-100" : "opacity-0",
                      )}
                    />
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
