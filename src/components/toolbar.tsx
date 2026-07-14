"use client";

/**
 * Shared toolbar primitives — the control strip above every data grid
 * (Monthly, Cumulative, Daily Logs, Employees, Users).
 *
 * One place owns the "premium strip" look: a frosted, softly elevated
 * container; h-9 controls on the app's rounded-lg control radius; hairline
 * separators between logical groups; and a search field with a centred
 * icon, a `/` focus hotkey, an inline clear affordance and a pending
 * spinner. Pages compose these instead of re-pasting container classes,
 * so the next visual pass is a one-file change.
 */

import { useEffect, useRef, type ReactNode } from "react";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/* ── Container & structure ─────────────────────────────────────────── */

export function Toolbar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200/80 bg-white/85 p-3 backdrop-blur-md",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-20px_rgba(79,70,229,0.25)]",
        "transition-shadow duration-300 hover:shadow-[0_1px_3px_rgba(15,23,42,0.05),0_16px_40px_-20px_rgba(79,70,229,0.35)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-2", className)}>
      {children}
    </div>
  );
}

/** Hairline between logically distinct control groups. Hidden on the
 *  smallest screens, where wrapping makes a vertical rule meaningless. */
export function ToolbarSeparator({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("hidden h-6 w-px shrink-0 self-center bg-slate-200 sm:block", className)}
    />
  );
}

/** The standard cross-page refetch indicator, so every toolbar's loading
 *  hint is the same size, colour and placement. */
export function ToolbarSpinner({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <Loader2
      role="status"
      aria-label="Loading"
      className="h-4 w-4 shrink-0 animate-spin text-indigo-400"
    />
  );
}

/* ── Search ────────────────────────────────────────────────────────── */

export function ToolbarSearch({
  value,
  onValueChange,
  placeholder = "Search…",
  isPending = false,
  id,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  /** Shows an inline spinner in place of the hotkey hint / clear button. */
  isPending?: boolean;
  id?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  // "/" focuses the search from anywhere on the page (the GitHub/Linear
  // convention) — unless the user is already typing somewhere or a dialog
  // is open. Escape clears the query, then blurs.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (
        t instanceof HTMLElement &&
        t.closest("input, textarea, select, [contenteditable='true'], [contenteditable='']")
      ) {
        return;
      }
      if (document.querySelector("[role='dialog']")) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showClear = !isPending && value.length > 0;
  const showHint = !isPending && value.length === 0;

  return (
    <div className={cn("group/search relative min-w-0", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/search:text-indigo-500" />
      <Input
        ref={inputRef}
        id={id}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            if (value) onValueChange("");
            else e.currentTarget.blur();
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "h-9 w-full rounded-lg border-slate-200 bg-slate-50/70 pl-9 pr-10",
          "transition-all hover:border-slate-300 hover:bg-white",
          "focus-visible:border-indigo-300 focus-visible:bg-white focus-visible:ring-4 focus-visible:ring-indigo-500/10",
        )}
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center">
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
        ) : showClear ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              onValueChange("");
              inputRef.current?.focus();
            }}
            className="flex h-5 w-5 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : showHint ? (
          <kbd className="pointer-events-none hidden h-5 min-w-5 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 font-mono text-[11px] font-medium text-slate-400 transition-opacity group-focus-within/search:opacity-0 sm:flex">
            /
          </kbd>
        ) : null}
      </div>
    </div>
  );
}

/* ── Segmented control recipes ─────────────────────────────────────────
 * Class strings for fused "Prev | Value | Next" clusters (the Monthly Data
 * month/year stepper, the Daily Logs date stepper). Exported as recipes
 * rather than components because the middle segment differs per consumer
 * (two Selects vs. a Popover trigger). */

export const segmentedGroupClass =
  "flex h-9 items-center overflow-clip rounded-lg border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus-within:border-indigo-200 hover:border-slate-300";

export const segmentedButtonClass =
  "flex h-full w-8 items-center justify-center text-slate-400 outline-none transition-colors hover:bg-slate-50 hover:text-indigo-600 focus-visible:bg-indigo-50 focus-visible:text-indigo-600 active:bg-slate-100 disabled:pointer-events-none disabled:opacity-40";

export const segmentedDividerClass = "h-5 w-px shrink-0 bg-slate-200";
