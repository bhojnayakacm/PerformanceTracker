import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserRole, DailyMetric } from "@/lib/types";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { DailyLogView } from "./daily-log-view";

export async function DailyLogsData({ date }: { date: string }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const userRole = (profile?.role ?? "viewer") as UserRole;

  const [employees, { data: dailyMetrics }] = await Promise.all([
    getEmployeesForUser(supabase, user.id, userRole, { activeOnly: true }),
    supabase.from("daily_metrics").select("*").eq("date", date),
  ]);

  const dataMap: Record<string, DailyMetric> = {};
  for (const row of dailyMetrics ?? []) {
    dataMap[row.employee_id] = row;
  }

  return (
    <DailyLogView
      key={date}
      employees={employees}
      initialData={dataMap}
      date={date}
      userRole={userRole}
    />
  );
}
