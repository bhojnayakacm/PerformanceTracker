"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Save,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Employee, UserRole, DailyMetric } from "@/lib/types";
import { saveDailyMetrics } from "../actions";

/* ── Types ── */

type MetricFields =
  | "target_calls"
  | "target_architect_meetings"
  | "target_client_meetings"
  | "target_site_visits"
  | "actual_calls"
  | "actual_architect_meetings"
  | "actual_client_meetings"
  | "actual_site_visits";

type EntryValues = Record<MetricFields, number>;

const EMPTY_ENTRY: EntryValues = {
  target_calls: 0,
  target_architect_meetings: 0,
  target_client_meetings: 0,
  target_site_visits: 0,
  actual_calls: 0,
  actual_architect_meetings: 0,
  actual_client_meetings: 0,
  actual_site_visits: 0,
};

type Props = {
  employees: Employee[];
  initialData: Record<string, DailyMetric>;
  date: string;
  userRole: UserRole;
};

/* ── Helpers ── */

function toEntryValues(dm: DailyMetric | undefined): EntryValues {
  if (!dm) return { ...EMPTY_ENTRY };
  return {
    target_calls: dm.target_calls,
    target_architect_meetings: dm.target_architect_meetings,
    target_client_meetings: dm.target_client_meetings,
    target_site_visits: dm.target_site_visits,
    actual_calls: dm.actual_calls,
    actual_architect_meetings: dm.actual_architect_meetings,
    actual_client_meetings: dm.actual_client_meetings,
    actual_site_visits: dm.actual_site_visits,
  };
}

/** Format a Date as YYYY-MM-DD using local time (avoids UTC shift). */
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

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateDisplay(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const day = WEEKDAYS[date.getDay()];
  return `${day}, ${date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

/* ── Component ── */

export function DailyLogView({
  employees,
  initialData,
  date,
  userRole,
}: Props) {
  const router = useRouter();
  const [isSaving, startSaveTransition] = useTransition();
  const [isNavigating, startNavigation] = useTransition();
  const canEditTargets = userRole === "super_admin";
  const canEdit = userRole !== "viewer";

  // State: employee_id -> entry values
  const [entries, setEntries] = useState<Record<string, EntryValues>>(() => {
    const init: Record<string, EntryValues> = {};
    for (const emp of employees) {
      init[emp.id] = toEntryValues(initialData[emp.id]);
    }
    return init;
  });

  const [dirty, setDirty] = useState<Set<string>>(new Set());

  const handleChange = useCallback(
    (empId: string, field: MetricFields, value: string) => {
      const num = Math.max(0, parseInt(value) || 0);
      setEntries((prev) => ({
        ...prev,
        [empId]: { ...prev[empId], [field]: num },
      }));
      setDirty((prev) => new Set(prev).add(empId));
    },
    []
  );

  const handleNavigate = useCallback(
    (newDate: string) => {
      if (dirty.size > 0 && !confirm("You have unsaved changes. Discard?")) {
        return;
      }
      startNavigation(() => {
        router.push(`/daily-logs?date=${newDate}`);
      });
    },
    [dirty, router, startNavigation]
  );

  const handleSave = () => {
    if (dirty.size === 0) return;

    const changedEntries = Array.from(dirty).map((empId) => ({
      employee_id: empId,
      ...entries[empId],
    }));

    startSaveTransition(async () => {
      const result = await saveDailyMetrics({ date, entries: changedEntries });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(`Saved daily data for ${changedEntries.length} employee(s)`);
      setDirty(new Set());
    });
  };

  const today = toLocalDateString(new Date());
  const isBusy = isSaving || isNavigating;

  return (
    <div className="space-y-4">
      {/* ── Date Navigation ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleNavigate(shiftDate(date, -1))}
            disabled={isBusy}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                if (e.target.value) handleNavigate(e.target.value);
              }}
              disabled={isBusy}
              className="pl-9 w-[170px] text-sm"
            />
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => handleNavigate(shiftDate(date, 1))}
            disabled={isBusy}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          {date !== today && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate(today)}
              disabled={isBusy}
            >
              Today
            </Button>
          )}

          {isNavigating ? (
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground ml-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading...
            </span>
          ) : (
            <span className="text-sm text-muted-foreground hidden sm:inline ml-1">
              {formatDateDisplay(date)}
            </span>
          )}
        </div>

        {canEdit && dirty.size > 0 && (
          <Button onClick={handleSave} disabled={isBusy} size="sm">
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {isSaving ? "Saving..." : `Save Changes (${dirty.size})`}
          </Button>
        )}
      </div>

      {/* ── Data Grid ── */}
      <Card className={`transition-opacity duration-150 ${isNavigating ? "opacity-50 pointer-events-none" : ""}`}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th
                    className="text-left p-3 font-medium sticky left-0 bg-background z-10"
                    rowSpan={2}
                  >
                    Employee
                  </th>
                  <th
                    className="text-center px-2 pt-2 pb-1 font-medium border-l"
                    colSpan={2}
                  >
                    Calls
                  </th>
                  <th
                    className="text-center px-2 pt-2 pb-1 font-medium border-l"
                    colSpan={2}
                  >
                    Arch. Meetings
                  </th>
                  <th
                    className="text-center px-2 pt-2 pb-1 font-medium border-l"
                    colSpan={2}
                  >
                    Client Meetings
                  </th>
                  <th
                    className="text-center px-2 pt-2 pb-1 font-medium border-l"
                    colSpan={2}
                  >
                    Site Visits
                  </th>
                </tr>
                <tr className="border-b bg-muted/50">
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal border-l">
                    Tgt
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal">
                    Act
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal border-l">
                    Tgt
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal">
                    Act
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal border-l">
                    Tgt
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal">
                    Act
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal border-l">
                    Tgt
                  </th>
                  <th className="text-center px-1 py-1 text-xs text-muted-foreground font-normal">
                    Act
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <EmployeeRow
                    key={emp.id}
                    employee={emp}
                    values={entries[emp.id]}
                    isDirty={dirty.has(emp.id)}
                    canEditTargets={canEditTargets}
                    canEdit={canEdit}
                    onChange={handleChange}
                  />
                ))}
                {employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="text-center py-12 text-muted-foreground"
                    >
                      No active employees found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Legend ── */}
      {canEdit && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-amber-100 border border-amber-300 dark:bg-amber-950/40 dark:border-amber-800" />
            <span>Unsaved changes</span>
          </div>
          <span>&middot;</span>
          <span>
            Tgt = Target (super admin only) &middot; Act = Actual
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Employee Row ── */

const METRICS: {
  target: MetricFields;
  actual: MetricFields;
}[] = [
  { target: "target_calls", actual: "actual_calls" },
  { target: "target_architect_meetings", actual: "actual_architect_meetings" },
  { target: "target_client_meetings", actual: "actual_client_meetings" },
  { target: "target_site_visits", actual: "actual_site_visits" },
];

function EmployeeRow({
  employee,
  values,
  isDirty,
  canEditTargets,
  canEdit,
  onChange,
}: {
  employee: Employee;
  values: EntryValues;
  isDirty: boolean;
  canEditTargets: boolean;
  canEdit: boolean;
  onChange: (empId: string, field: MetricFields, value: string) => void;
}) {
  return (
    <tr
      className={`border-b transition-colors ${
        isDirty
          ? "bg-amber-50 dark:bg-amber-950/20"
          : "hover:bg-muted/30"
      }`}
    >
      <td className="p-3 sticky left-0 bg-inherit z-10">
        <div className="flex items-center gap-2">
          <div>
            <div className="font-medium whitespace-nowrap">{employee.name}</div>
            <div className="text-xs text-muted-foreground">{employee.emp_id}</div>
          </div>
          {isDirty && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-amber-600 border-amber-300">
              edited
            </Badge>
          )}
        </div>
      </td>
      {METRICS.map((m, i) => (
        <MetricCells
          key={m.target}
          empId={employee.id}
          targetField={m.target}
          actualField={m.actual}
          targetValue={values[m.target]}
          actualValue={values[m.actual]}
          canEditTargets={canEditTargets}
          canEdit={canEdit}
          onChange={onChange}
        />
      ))}
    </tr>
  );
}

/* ── Metric Input Cells ── */

function MetricCells({
  empId,
  targetField,
  actualField,
  targetValue,
  actualValue,
  canEditTargets,
  canEdit,
  onChange,
}: {
  empId: string;
  targetField: MetricFields;
  actualField: MetricFields;
  targetValue: number;
  actualValue: number;
  canEditTargets: boolean;
  canEdit: boolean;
  onChange: (empId: string, field: MetricFields, value: string) => void;
}) {
  const inputClass =
    "h-8 w-16 block mx-auto text-sm px-1 [text-align:center] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

  return (
    <>
      <td className="px-1 py-1.5 border-l">
        <Input
          type="number"
          min={0}
          value={targetValue || ""}
          onChange={(e) => onChange(empId, targetField, e.target.value)}
          disabled={!canEditTargets}
          className={inputClass}
          placeholder="0"
        />
      </td>
      <td className="px-1 py-1.5">
        <Input
          type="number"
          min={0}
          value={actualValue || ""}
          onChange={(e) => onChange(empId, actualField, e.target.value)}
          disabled={!canEdit}
          className={inputClass}
          placeholder="0"
        />
      </td>
    </>
  );
}
