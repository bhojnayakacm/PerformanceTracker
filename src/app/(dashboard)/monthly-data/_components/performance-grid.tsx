"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { Search, CalendarDays, Building2, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { EmployeeMonthlyData, UserRole, City } from "@/lib/types";
import { useDebouncedSearch } from "@/hooks/use-debounced-search";
import { getColumns } from "./columns";
import { EmployeeDetailDialog } from "./employee-detail-dialog";
import { ManageCitiesDialog } from "./manage-cities-dialog";
import { MonthSelector } from "@/components/month-selector";

type Props = {
  data: EmployeeMonthlyData[];
  userRole: UserRole;
  month: number;
  year: number;
  isCurrentMonth?: boolean;
  cities: City[];
};

export function PerformanceGrid({
  data,
  userRole,
  month,
  year,
  isCurrentMonth,
  cities,
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const { inputValue, setInputValue, isPending } = useDebouncedSearch("query", 300);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<EmployeeMonthlyData | null>(
    null
  );
  const [manageCitiesOpen, setManageCitiesOpen] = useState(false);

  const columns = useMemo(() => getColumns(isCurrentMonth), [isCurrentMonth]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-border/60 bg-card p-3 transition-shadow duration-300 hover:shadow-md">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            className="pl-9"
          />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {userRole === "super_admin" && (
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5"
              onClick={() => setManageCitiesOpen(true)}
            >
              <Building2 className="h-4 w-4" />
              Manage Cities
            </Button>
          )}
          <MonthSelector month={month} year={year} basePath="/monthly-data" />
        </div>
      </div>

      {/* Table */}
      <Card className={cn("border-0 py-0 gap-0 shadow-sm ring-1 ring-border/50 overflow-hidden transition-all duration-300 hover:shadow-md", isPending && "opacity-60 pointer-events-none")}>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="hover:bg-transparent">
                {hg.headers.map((h) => (
                  <TableHead key={h.id} className="border-r border-slate-200/60 dark:border-slate-700/60 last:border-r-0">
                    {h.isPlaceholder
                      ? null
                      : flexRender(
                          h.column.columnDef.header,
                          h.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => {
                    setSelectedRow(row.original);
                    setDetailOpen(true);
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="border-r border-slate-200/60 dark:border-slate-700/60 last:border-r-0">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center gap-3 py-4">
                    <div className="flex size-12 items-center justify-center rounded-full bg-muted/60">
                      <CalendarDays className="h-6 w-6 text-muted-foreground/80" />
                    </div>
                    <div className="space-y-1 text-center">
                      <p className="text-sm font-medium text-foreground/70">
                        No data for this month
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {inputValue
                          ? "Try adjusting your search."
                          : "Click on an employee row to enter their monthly data."}
                      </p>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog — expansive bento-grid takeover */}
      <EmployeeDetailDialog
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) setSelectedRow(null);
        }}
        data={selectedRow}
        month={month}
        year={year}
        userRole={userRole}
        cities={cities}
      />

      {/* Manage Cities Dialog (super_admin only) */}
      {userRole === "super_admin" && (
        <ManageCitiesDialog
          open={manageCitiesOpen}
          onOpenChange={setManageCitiesOpen}
          cities={cities}
        />
      )}
    </div>
  );
}
