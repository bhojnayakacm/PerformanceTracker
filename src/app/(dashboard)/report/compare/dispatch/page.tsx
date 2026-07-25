import { MonthlyComparePage } from "../_components/monthly-compare-page";

export default async function CompareDispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  return <MonthlyComparePage measure="dispatch" idsRaw={ids} />;
}
