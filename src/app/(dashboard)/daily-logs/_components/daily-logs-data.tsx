import { redirect } from "next/navigation";
import type { DailyMetric } from "@/lib/types";
import { getAuthUser } from "@/lib/queries/auth";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { DailyLogView } from "./daily-log-view";

export async function DailyLogsData({ date }: { date: string }) {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const { supabase, id: userId, role: userRole } = auth;

  const [employees, { data: dailyMetrics }] = await Promise.all([
    getEmployeesForUser(supabase, userId, userRole, { activeOnly: true }),
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
