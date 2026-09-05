"use client";

/**
 * Toolbar Export control for the Compare views.
 *
 * Sits at the far right of the strip, behind a separator, so it reads as an
 * OUTPUT action rather than another filter — everything to its left changes
 * what you see; this one takes what you see away with you.
 *
 * Styled as an outline control matching the toolbar's other h-9 buttons, with
 * the emerald tint reserved for spreadsheet output so it is distinguishable
 * from the indigo filter controls at a glance without shouting.
 */

import { useState, useTransition } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { exportComparative, type ExportPayload } from "../_lib/compare-export";

export function ComparativeExportButton({
  /** Called at CLICK time, not render time — so the payload always reflects
   *  the sort, filter and window in effect at the moment of export rather
   *  than whatever they were when this button last rendered. */
  getPayload,
  disabled,
}: {
  getPayload: () => ExportPayload;
  disabled?: boolean;
}) {
  // useTransition keeps the click responsive; a separate flag covers the
  // dynamic import + file write, which is async work outside React's control.
  const [, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = () => {
    if (isExporting) return;
    setIsExporting(true);
    startTransition(() => {
      void (async () => {
        try {
          const filename = await exportComparative(getPayload());
          toast.success(`Exported ${filename}`);
        } catch (e) {
          toast.error(
            `Export failed: ${(e as Error).message || "please try again"}`,
          );
        } finally {
          setIsExporting(false);
        }
      })();
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={disabled || isExporting}
      title={
        disabled
          ? "Nothing to export for the current filters"
          : "Download the table as an Excel file"
      }
      className={cn(
        "h-9 gap-2 rounded-lg border-slate-200 bg-white px-3",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all",
        "hover:border-emerald-300 hover:bg-emerald-50/70 hover:text-emerald-700",
        "focus-visible:border-emerald-300 focus-visible:ring-4 focus-visible:ring-emerald-500/10",
      )}
    >
      {isExporting ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
      ) : (
        <FileSpreadsheet className="h-4 w-4 shrink-0 text-emerald-600/80" />
      )}
      <span className="text-sm font-medium">
        {isExporting ? "Exporting…" : "Export"}
      </span>
    </Button>
  );
}
