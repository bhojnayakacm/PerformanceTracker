import { MonthlyComparePage } from "../_components/monthly-compare-page";

export default async function CompareCostingPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return <MonthlyComparePage measure="costing" idsRaw={ids} />;
}
