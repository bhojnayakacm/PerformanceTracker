/**
 * Client-side export for the Compare views.
 *
 * WHY CLIENT-SIDE: the rows are already fetched, filtered by the attainment
 * band and sorted in the browser for the rich table. Re-deriving that on the
 * server would mean duplicating the filter/sort/reduce logic and risking an
 * export that quietly disagrees with what's on screen. Exporting the exact
 * array the table just rendered makes the file WYSIWYG by construction.
 *
 * DRY WITH THE TABLE: headers and cells both come from the metric's own
 * CompareColumn[] spec — the same objects that drive <ComparativeTable>. Add a
 * column to a metric and it appears in the table and the export together;
 * there is no second schema to keep in sync.
 *
 * RAW NUMBERS, NOT FORMATTED STRINGS: the table renders "₹1.2L" and "112.2%"
 * because those read well on screen. A spreadsheet needs the underlying
 * numbers or SUM/AVERAGE/pivots break, so `column.format` is deliberately NOT
 * used here — only `column.value`. Units live in the header labels and on the
 * "Report info" sheet instead.
 *
 * xlsx is imported DYNAMICALLY inside the click handler: SheetJS is a few
 * hundred KB, and the Compare routes should not pay for it on first paint just
 * because an export button exists. First click fetches the chunk; later clicks
 * hit cache. If that import fails for any reason we still hand back a CSV.
 */

import {
  sumColumn,
  type CompareColumn,
  type ComparativeSeries,
} from "./comparative";
import type { DailyWindow, MonthlyWindow } from "./report-ranges";

const MONTHS_SLUG = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Jul2026" for a single month, "Apr2025-Sep2025" for a span. */
export function monthlyPeriodSlug(w: MonthlyWindow): string {
  const from = `${MONTHS_SLUG[w.fromMonth - 1]}${w.fromYear}`;
  const to = `${MONTHS_SLUG[w.toMonth - 1]}${w.toYear}`;
  return from === to ? from : `${from}-${to}`;
}

/** A daily window inside one calendar month collapses to "Jul2026" (the common
 *  case — the default window is the previous full month); anything wider keeps
 *  explicit ISO bounds so the range stays unambiguous. */
export function dailyPeriodSlug(w: DailyWindow): string {
  const from = new Date(`${w.from}T00:00:00`);
  const to = new Date(`${w.to}T00:00:00`);
  if (
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth()
  ) {
    return `${MONTHS_SLUG[from.getMonth()]}${from.getFullYear()}`;
  }
  return `${w.from}_${w.to}`;
}

export type ExportPayload = {
  /** Human title, e.g. "Compare · Dispatch". */
  metricTitle: string;
  /** Filename fragment, e.g. "Dispatch". */
  metricSlug: string;
  /** Filename fragment, e.g. "Jul2026". */
  periodSlug: string;
  /** Human period, e.g. "Jul '26 — Jul '26". */
  windowLabel: string;
  /** The metric's column spec — drives headers AND cells. */
  columns: CompareColumn[];
  /** Exactly the rows on screen: attainment-filtered and in table sort order. */
  series: ComparativeSeries[];
  /** e.g. "All employees (24)" or "6 selected". */
  scopeLabel: string;
  /** e.g. "All" or "100%+". */
  filterLabel: string;
};

type Cell = string | number;

/** Round for readability while staying a NUMBER so Excel can aggregate it. */
function cellValue(v: number | null): Cell {
  if (v === null || !Number.isFinite(v)) return "";
  return Math.round(v * 100) / 100;
}

/** Header + one row per employee + a trailing team-total row, mirroring the
 *  table's own footer so the export matches the view exactly. */
export function buildExportRows({ columns, series }: ExportPayload): Cell[][] {
  const header: Cell[] = [
    "#",
    "Employee",
    "Emp ID",
    ...columns.map((c) => c.label),
  ];

  const body: Cell[][] = series.map((s, i) => [
    i + 1,
    s.name,
    s.empId,
    ...columns.map((c) => cellValue(c.value(s))),
  ]);

  const totals: Cell[] = [
    "",
    "Team total",
    "",
    ...columns.map((c) =>
      cellValue(c.total ? c.total(series) : sumColumn(series, c.value)),
    ),
  ];

  return [header, ...body, totals];
}

/** Provenance for the second sheet — what this file is a snapshot OF. Without
 *  it an exported table is undated and unscoped the moment it is emailed on. */
function buildInfoRows(p: ExportPayload): Cell[][] {
  return [
    ["Report", p.metricTitle],
    ["Period", p.windowLabel],
    ["Employees", p.scopeLabel],
    ["Attainment filter", p.filterLabel],
    ["Rows", p.series.length],
    ["Generated", new Date().toLocaleString("en-IN")],
  ];
}

function columnWidths(rows: Cell[][]): { wch: number }[] {
  if (rows.length === 0) return [];
  return rows[0].map((_, col) => {
    let max = 8;
    for (const row of rows) {
      const len = String(row[col] ?? "").length;
      if (len > max) max = len;
    }
    return { wch: Math.min(max + 2, 40) };
  });
}

function csvCell(v: Cell): string {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** CSV fallback, used only if the xlsx chunk cannot be loaded. The BOM makes
 *  Excel read it as UTF-8 so city and employee names aren't mangled. */
function exportCsv(rows: Cell[][], baseName: string) {
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  downloadBlob(
    new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }),
    `${baseName}.csv`,
  );
}

/**
 * Build and download the file. Returns the filename actually written so the
 * caller can name it in a toast.
 */
export async function exportComparative(p: ExportPayload): Promise<string> {
  const rows = buildExportRows(p);
  const baseName = `Compare_${p.metricSlug}_${p.periodSlug}`;

  try {
    const XLSX = await import("xlsx");

    const dataSheet = XLSX.utils.aoa_to_sheet(rows);
    dataSheet["!cols"] = columnWidths(rows);
    // Freeze the header row so long rosters stay readable while scrolling.
    dataSheet["!freeze"] = { xSplit: 0, ySplit: 1 };

    const infoRows = buildInfoRows(p);
    const infoSheet = XLSX.utils.aoa_to_sheet(infoRows);
    infoSheet["!cols"] = columnWidths(infoRows);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, dataSheet, "Data");
    XLSX.utils.book_append_sheet(wb, infoSheet, "Report info");

    const filename = `${baseName}.xlsx`;
    XLSX.writeFile(wb, filename);
    return filename;
  } catch {
    exportCsv(rows, baseName);
    return `${baseName}.csv`;
  }
}
