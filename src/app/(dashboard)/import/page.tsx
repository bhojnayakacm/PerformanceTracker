import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/queries/auth";
import { ImportWizard } from "./_components/import-wizard";
import { CityPoolImport } from "./_components/city-pool-import";

const DESCRIPTION =
  "Bulk import employees, monthly figures, daily logs, city tours, and the city pool from CSV files.";

export default async function ImportPage() {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  if (auth.role !== "super_admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Import Data</h1>
          <p className="text-muted-foreground mt-1">{DESCRIPTION}</p>
        </div>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          Only Super Admins can import data.
        </div>
      </div>
    );
  }

  // Pool snapshot for the City Pool module's instant dedupe preview. RLS
  // cities_select is USING(true), so this read is fine for a super_admin.
  const { data: cityRows } = await auth.supabase
    .from("cities")
    .select("name")
    .order("name");
  const existingCityNames = (cityRows ?? []).map((c) => c.name);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground mt-1">{DESCRIPTION}</p>
      </div>

      <ImportWizard />

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            City Pool
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <CityPoolImport existingCityNames={existingCityNames} />
      </div>
    </div>
  );
}
