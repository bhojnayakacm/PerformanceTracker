"use client";

import { type ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown, Check, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_CONFIG: Record<
  string,
  { label: string; variant: "destructive" | "default" | "outline" }
> = {
  super_admin: { label: "Super Admin", variant: "destructive" },
  editor: { label: "Editor", variant: "default" },
  viewer: { label: "Viewer", variant: "outline" },
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "editor", label: "Editor" },
  { value: "viewer", label: "Viewer" },
];

type ColumnActions = {
  onRoleChange: (userId: string, newRole: UserRole) => void;
  onToggleStatus: (userId: string, currentStatus: boolean) => void;
};

export function getColumns(
  currentUserId: string,
  actions: ColumnActions
): ColumnDef<Profile>[] {
  return [
    {
      accessorKey: "full_name",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3"
        >
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const isSelf = row.original.id === currentUserId;
        return (
          <div>
            <span className="font-medium">
              {row.original.full_name || "Unnamed User"}
            </span>
            {isSelf && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                (You)
              </span>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Role",
      cell: ({ row }) => {
        const role = row.original.role;
        const isSelf = row.original.id === currentUserId;
        const config = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;

        if (isSelf) {
          return <Badge variant={config.variant}>{config.label}</Badge>;
        }

        return (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-auto rounded-full p-0 hover:bg-transparent focus-visible:ring-offset-0"
                />
              }
            >
              <Badge
                variant={config.variant}
                className="cursor-pointer pr-1.5 transition-shadow hover:ring-2 hover:ring-ring/20"
              >
                {config.label}
                <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
              </Badge>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {ROLE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() =>
                    actions.onRoleChange(row.original.id, opt.value)
                  }
                >
                  {role === opt.value ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <span className="mr-2 w-4" />
                  )}
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      },
      filterFn: (row, _columnId, value) => {
        if (value === "all") return true;
        return row.original.role === value;
      },
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => {
        const isActive = row.original.is_active;
        const isSelf = row.original.id === currentUserId;

        return (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-0 hover:bg-transparent"
            onClick={() =>
              actions.onToggleStatus(row.original.id, isActive)
            }
            disabled={isSelf}
          >
            <Badge variant={isActive ? "default" : "outline"}>
              {isActive ? "Active" : "Inactive"}
            </Badge>
          </Button>
        );
      },
    },
    {
      accessorKey: "created_at",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-3"
        >
          Joined
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(
            new Date(row.original.created_at)
          )}
        </span>
      ),
    },
  ];
}
