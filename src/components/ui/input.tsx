"use client";

import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

/**
 * Shared text/number input.
 *
 * Numeric fields (`type="number"`) get two data-entry behaviours automatically,
 * because every editable grid in the app funnels through here — Monthly Data
 * (via PendingInput), Daily Logs and Set Targets — and fixing it once beats
 * remembering it at ~40 call sites:
 *
 *  1. SELECT-ON-FOCUS. These fields are pre-populated (often with `0`), so
 *     landing in one used to mean backspacing before you could type. Focusing
 *     now selects the contents, making the first keystroke an overwrite. This
 *     is done here rather than by blanking zeros in state because the values
 *     are controlled by react-hook-form / grid state: swapping `0` for `""`
 *     while focused would mean touching every call site's value + dirty-diffing.
 *
 *  2. NO SCROLL-TO-CHANGE. A focused number input treats a mouse wheel as
 *     increment/decrement, so scrolling the page silently corrupted whichever
 *     cell happened to be focused. We blur on wheel instead of calling
 *     `preventDefault()`, because React registers `onWheel` as a PASSIVE
 *     listener — `preventDefault()` there is ignored (and warns). Blurring
 *     removes the target of the scroll-step entirely, and matches intent: a
 *     user spinning the wheel is reading the page, not editing the cell.
 *     Pairs with the spin-button CSS reset in globals.css, which closes the
 *     other accidental-change vector (misclicking the spinners).
 *
 * All three handlers still call through to any caller-supplied handler, so
 * existing `onKeyDown`/`onFocus` wiring (e.g. the "-/+/e" blocker in
 * employee-detail-dialog) keeps working.
 */
function Input({
  className,
  type,
  onFocus,
  onBlur,
  onMouseUp,
  onWheel,
  ...props
}: React.ComponentProps<"input">) {
  const isNumeric = type === "number";
  /** True only between focusing a field and the click that focused it
   *  finishing — see handleMouseUp. */
  const selectedOnFocus = React.useRef(false);

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (isNumeric) {
      selectedOnFocus.current = true;
      e.currentTarget.select();
    }
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    selectedOnFocus.current = false;
    onBlur?.(e);
  };

  // When focus came from a click, the click's own mouseup lands AFTER the
  // focus handler and collapses our selection back to a caret. Suppressing
  // that one mouseup preserves the select-all. Later clicks in an
  // already-focused field are untouched, so you can still click to place the
  // caret and edit a single digit.
  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (isNumeric && selectedOnFocus.current) {
      selectedOnFocus.current = false;
      e.preventDefault();
    }
    onMouseUp?.(e);
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // Only when focused — that's the only time the wheel would change the value.
    if (isNumeric && document.activeElement === e.currentTarget) {
      e.currentTarget.blur();
    }
    onWheel?.(e);
  };

  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      onFocus={handleFocus}
      onBlur={handleBlur}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
