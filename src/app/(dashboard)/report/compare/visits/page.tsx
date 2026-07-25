import { MonthlyComparePage } from "../_components/monthly-compare-page";

export default async function CompareVisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return <MonthlyComparePage measure="visits" idsRaw={ids} />;
}
