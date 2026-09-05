"use client";

/**
 * Owns the Compare table's sort order.
 *
 * This lives in a hook, held by the METRIC component, rather than inside
 * <ComparativeViews>, because three separate things need the same ordered
 * array and they sit in different parts of the tree:
 *   • the rich table renders it,
 *   • the trend chart auto-plots the top MAX_PLOTTED of it,
 *   • the Export button (up in the toolbar, a sibling of the card) writes it
 *     to a spreadsheet.
 * With the sort buried in the card, the toolbar's export could only guess at
 * the order on screen. Hoisting it makes the metric component the single owner
 * of "what the user is currently looking at", and every consumer reads from
 * that one source.
 */

import { useCallback, useMemo, useState } from "react";
import type { CompareColumn, ComparativeSeries } from "./comparative";

export type SortState = { key: string; dir: "asc" | "desc" };

export function useCompareSort(columns: CompareColumn[]) {
  const headlineKey = useMemo(
    () => columns.find((c) => c.emphasis)?.key ?? columns[0]?.key ?? "",
    [columns],
  );

  const [sort, setSort] = useState<SortState>(() => ({
    key: headlineKey,
    dir: "desc",
  }));

  const onSort = useCallback((key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );
  }, []);

  const columnByKey = useMemo(
    () => new Map(columns.map((c) => [c.key, c])),
    [columns],
  );

  const sortSeries = useCallback(
    (series: ComparativeSeries[]): ComparativeSeries[] => {
      // Fall back to the headline column if the sorted key isn't in this
      // metric's spec (possible if the same component serves several metrics).
      const col = columnByKey.get(sort.key) ?? columnByKey.get(headlineKey);
      if (!col) return series;
      const dir = sort.dir === "asc" ? 1 : -1;
      return [...series].sort((a, b) => {
        const av = col.value(a);
        const bv = col.value(b);
        // Nulls always sink, regardless of direction.
        if (av === null && bv === null) return a.name.localeCompare(b.name);
        if (av === null) return 1;
        if (bv === null) return -1;
        return av === bv ? a.name.localeCompare(b.name) : (av - bv) * dir;
      });
    },
    [columnByKey, sort, headlineKey],
  );

  return { sort, onSort, sortSeries };
}
