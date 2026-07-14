/**
 * App-wide bounds for date / month / year filters.
 *
 * Performance data starts in DATA_EPOCH_YEAR — nothing earlier was ever
 * digitised — and planning flows (monthly targets, FY ranges) legitimately
 * reach into next year. Every time filter derives its year list and
 * calendar bounds from here, so the window widens by itself each January
 * and no hardcoded year list can rot again.
 *
 * One intentional exception: pickers over ACTUALS-only data (the Report's
 * daily Meetings range) additionally cap at "today", since logged history
 * can't exist in the future.
 */

export const DATA_EPOCH_YEAR = 2019;

/** First selectable calendar day (Jan 1 of the epoch year). */
export function dataEpochDate(): Date {
  return new Date(DATA_EPOCH_YEAR, 0, 1);
}

/** Latest selectable year: next year, so targets can be planned ahead. */
export function maxSelectableYear(now: Date = new Date()): number {
  return now.getFullYear() + 1;
}

/** Ascending year list for every month/year dropdown: epoch → next year. */
export function selectableYears(now: Date = new Date()): number[] {
  const last = maxSelectableYear(now);
  return Array.from(
    { length: last - DATA_EPOCH_YEAR + 1 },
    (_, i) => DATA_EPOCH_YEAR + i,
  );
}
