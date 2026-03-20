"use client";

import { useMemo, useState, useTransition } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
} from "@tanstack/react-table";
import { Search, ShieldPlus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Profile } from "@/lib/types";
import { updateUserRole, toggleUserStatus } from "../actions";
import { getColumns } from "./columns";

type Props = {
  data: Profile[];
  currentUserId: string;
};

export function UsersDataTable({ data, currentUserId }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [, startTransition] = useTransition();

  const columns = useMemo(
    () =>
      getColumns(currentUserId, {
        onRoleChange: (userId, newRole) => {
          startTransition(async () => {
            const result = await updateUserRole(userId, newRole);
            if ("error" in result) {
              toast.error(result.error);
            } else {
              const roleLabel =
                newRole === "super_admin"
                  ? "Super Admin"
                  : newRole === "editor"
                    ? "Editor"
                    : "Viewer";
              toast.success(`Role updated to ${roleLabel}`);
            }
          });
        },
        onToggleStatus: (userId, currentStatus) => {
          startTransition(async () => {
            const result = await toggleUserStatus(userId, currentStatus);
            if ("error" in result) {
              toast.error(result.error);
            } else {
              toast.success(
                `User ${currentStatus ? "deactivated" : "activated"}`
              );
            }
          });
        },
      }),
    [currentUserId, startTransition]
  );

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase();
      const name = (row.original.full_name ?? "").toLowerCase();
      const role = (row.original.role ?? "").toLowerCase();
      return name.includes(search) || role.includes(search);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or role..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          onClick={() =>
            toast.info("User invitations coming soon.", {
              description:
                "For now, users can sign up and will be assigned the Viewer role automatically.",
            })
          }
        >
          <ShieldPlus className="mr-2 h-4 w-4" />
          Invite User
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
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
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <UserCog className="h-10 w-10" />
                    <p className="text-lg font-medium">No users found</p>
                    <p className="text-sm">
                      {globalFilter
                        ? "Try adjusting your search."
                        : "Users will appear here after they sign up."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
