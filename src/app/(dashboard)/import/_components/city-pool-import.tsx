"use client";

/**
 * Bulk City Pool import — standalone from the employee-referencing wizard.
 *
 * A raw list of city names → the master `cities` pool. Because there's no
 * employee reference and the interesting validation is *duplication* (not
 * per-row shape), this gets its own tailored 3-step flow instead of the
 * generic wizard: upload → dedupe preview ("42 new, 3 already in pool") →
 * commit via the bulk_add_cities RPC, which re-checks authoritatively.
 *
 * The preview diff is computed client-side against the pool snapshot passed
 * from the server (instant UX), augmented with anything added earlier in this
 * session so back-to-back imports stay accurate without a refetch. The RPC is
 * still the source of truth for the final counts.
 */

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Building2,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  RotateCcw,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileDropzone } from "./file-dropzone";
import { parseFile } from "../_lib/import-helpers";
import { importCityPool, type CityPoolImportResult } from "../actions";

/** Header aliases we'll accept for the city column (post-normalization to
 *  lowercase_underscore by parseFile). */
const CITY_COLUMNS = ["city_name", "city", "name"];

const NEW_CAP = 48;
const DUP_CAP = 24;

type Step = "upload" | "preview" | "result";

type Preview = {
  fileName: string;
  newCities: string[];
  duplicates: string[];
  ignored: number;
};

/** Title-case a raw city name — mirrors the app's existing importCityTours
 *  convention so preview text matches what the RPC stores. */
function titleCase(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function downloadCityTemplate() {
  const csv = "city_name\nBengaluru\nJaipur\nSurat\nKochi\n";
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "city_pool_template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function CityPoolImport({
  existingCityNames,
}: {
  existingCityNames: string[];
}) {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CityPoolImportResult | null>(null);
  const [sessionAdded, setSessionAdded] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  // Pool snapshot (lowercased) + anything we've added this session, so a
  // second consecutive import doesn't re-offer a just-added city as "new".
  const existingLower = useMemo(() => {
    const set = new Set(existingCityNames.map((n) => n.toLowerCase()));
    for (const n of sessionAdded) set.add(n.toLowerCase());
    return set;
  }, [existingCityNames, sessionAdded]);

  async function handleFileAccepted(file: File) {
    try {
      const parsed = await parseFile(file);
      const col = CITY_COLUMNS.find((c) => parsed.headers.includes(c));
      if (!col) {
        toast.error(
          'No city column found — include a "city_name" header (grab the template).',
        );
        return;
      }

      const seen = new Set<string>();
      const newCities: string[] = [];
      const duplicates: string[] = [];
      let ignored = 0;

      for (const row of parsed.rows) {
        const raw = (row[col] ?? "").trim();
        if (!raw) {
          ignored++;
          continue;
        }
        const name = titleCase(raw);
        const key = name.toLowerCase();
        if (seen.has(key)) continue; // collapse within-file duplicates
        seen.add(key);
        if (existingLower.has(key)) duplicates.push(name);
        else newCities.push(name);
      }

      if (seen.size === 0) {
        toast.error("No valid city names found in that file.");
        return;
      }

      newCities.sort((a, b) => a.localeCompare(b));
      duplicates.sort((a, b) => a.localeCompare(b));
      setPreview({ fileName: file.name, newCities, duplicates, ignored });
      setStep("preview");
    } catch (err) {
      toast.error(`Failed to parse file: ${(err as Error).message}`);
    }
  }

  function handleImport() {
    if (!preview || preview.newCities.length === 0) return;
    // Send every distinct city we found (new + duplicates); the RPC de-dupes
    // authoritatively and reports the real inserted/skipped split.
    const all = [...preview.newCities, ...preview.duplicates];
    startTransition(async () => {
      const res = await importCityPool(all);
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setResult(res);
      setSessionAdded((prev) => [...prev, ...res.insertedNames]);
      setStep("result");
      if (res.inserted > 0) {
        toast.success(
          `Added ${res.inserted} ${res.inserted === 1 ? "city" : "cities"} to the pool.`,
        );
      } else {
        toast.info("Nothing added — every city was already in the pool.");
      }
    });
  }

  function reset() {
    setStep("upload");
    setPreview(null);
    setResult(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Bulk City Pool Import
            </CardTitle>
            <CardDescription>
              Populate the master city list from a plain CSV of names — no
              employee assignment needed.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={downloadCityTemplate}
          >
            <Download className="mr-1.5 h-4 w-4" />
            CSV Template
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {step === "upload" && (
          <>
            <div className="rounded-lg bg-muted/50 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                One column, one city per row
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="default" className="font-mono text-xs">
                  city_name
                </Badge>
                <span className="text-xs text-muted-foreground">
                  (also accepts a <code className="font-mono">city</code> or{" "}
                  <code className="font-mono">name</code> header). Names are
                  title-cased; duplicates already in the pool are skipped
                  automatically.
                </span>
              </div>
            </div>

            <Separator />

            <FileDropzone onFileAccepted={handleFileAccepted} />
          </>
        )}

        {step === "preview" && preview && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">
                {preview.fileName}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="default">{preview.newCities.length} new</Badge>
                {preview.duplicates.length > 0 && (
                  <Badge variant="secondary">
                    {preview.duplicates.length} already in pool
                  </Badge>
                )}
              </div>
            </div>

            {preview.newCities.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
                  Will be added ({preview.newCities.length})
                </p>
                <ChipList names={preview.newCities} cap={NEW_CAP} variant="new" />
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                Every city in this file is already in the pool — nothing to add.
              </div>
            )}

            {preview.duplicates.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Already in pool — will be skipped ({preview.duplicates.length})
                </p>
                <ChipList names={preview.duplicates} cap={DUP_CAP} variant="dup" />
              </div>
            )}

            {preview.ignored > 0 && (
              <p className="text-xs text-muted-foreground">
                {preview.ignored} blank row{preview.ignored !== 1 ? "s" : ""}{" "}
                ignored.
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={reset} disabled={isPending}>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={preview.newCities.length === 0 || isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Add {preview.newCities.length} Cit
                    {preview.newCities.length === 1 ? "y" : "ies"}
                  </>
                )}
              </Button>
            </div>
          </>
        )}

        {step === "result" && result && (
          <>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <p className="font-medium">Import complete</p>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-500/10">
                <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                  {result.inserted}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">
                  Added
                </p>
              </div>
              <div className="flex-1 rounded-lg bg-slate-50 p-4 text-center dark:bg-slate-500/10">
                <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                  {result.skipped}
                </p>
                <p className="text-xs text-slate-500">Skipped (existed)</p>
              </div>
            </div>

            {result.insertedNames.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">
                  Added to the pool
                </p>
                <ChipList
                  names={result.insertedNames}
                  cap={NEW_CAP}
                  variant="new"
                />
              </div>
            )}

            <Button onClick={reset}>
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Import another list
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ChipList({
  names,
  cap,
  variant,
}: {
  names: string[];
  cap: number;
  variant: "new" | "dup";
}) {
  const shown = names.slice(0, cap);
  const rest = names.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map((n) => (
        <span
          key={n}
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1",
            variant === "new"
              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
              : "bg-slate-100 text-slate-500 ring-slate-200",
          )}
        >
          {n}
        </span>
      ))}
      {rest > 0 && (
        <span className="self-center text-xs text-muted-foreground">
          +{rest} more
        </span>
      )}
    </div>
  );
}
