import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, DailyMetric } from "@/lib/types";
import { DailyLogView } from "./daily-log-view";

export async function DailyLogsData({ date }: { date: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: employees }, { data: dailyMetrics }] =
    await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single(),
      supabase
        .from("employees")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      supabase.from("daily_metrics").select("*").eq("date", date),
    ]);

  const userRole = (profile?.role ?? "viewer") as UserRole;

  const dataMap: Record<string, DailyMetric> = {};
  for (const row of dailyMetrics ?? []) {
    dataMap[row.employee_id] = row;
  }

  return (
    <DailyLogView
      key={date}
      employees={employees ?? []}
      initialData={dataMap}
      date={date}
      userRole={userRole}
    />
  );
}
