/** Shared number/label formatters for the Report cards. en-IN grouping to
 *  match the rest of the app (dashboard stat cards use the same locale). */

const nf = new Intl.NumberFormat("en-IN");
const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export const fmtNum = (n: number) => nf.format(Math.round(n));
export const fmtCompact = (n: number) => compact.format(n);
export const fmtINR = (n: number) => inr.format(Math.round(n));
export const fmtINRCompact = (n: number) =>
  `₹${compact.format(Math.round(n))}`;
export const fmtDays = (n: number) =>
  n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
export const fmtPct = (n: number | null) =>
  n === null ? "—" : `${n.toFixed(1)}%`;

/** attainment ratio → status color, matching the dashboard threshold rule
 *  (<70% red, 70–99% amber, ≥100% green). */
export function attainmentStatus(
  pct: number | null,
): "green" | "amber" | "red" | "neutral" {
  if (pct === null) return "neutral";
  if (pct >= 100) return "green";
  if (pct >= 70) return "amber";
  return "red";
}

export const STATUS_TEXT: Record<
  "green" | "amber" | "red" | "neutral",
  string
> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  neutral: "text-slate-500",
};
