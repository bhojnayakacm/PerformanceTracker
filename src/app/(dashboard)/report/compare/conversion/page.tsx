import { MonthlyComparePage } from "../_components/monthly-compare-page";

export default async function CompareConversionPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return <MonthlyComparePage measure="conversion" idsRaw={ids} />;
}
