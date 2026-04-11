import { redirect } from "next/navigation";
import type { EmployeeMonthlyData, CityTourWithCity } from "@/lib/types";
import { getAuthUser } from "@/lib/queries/auth";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { PerformanceGrid } from "./performance-grid";

type Props = {
  month: number;
  year: number;
  query: string;
};

export async function MonthlyDataContent({ month, year, query }: Props) {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const { supabase, id: userId, role: userRole } = auth;

  const [
    employees,
    { data: targets },
    { data: actuals },
    { data: cityTours },
    { data: cities },
  ] = await Promise.all([
    getEmployeesForUser(supabase, userId, userRole, {
      activeOnly: true,
      search: query,
    }),
    supabase
      .from("monthly_targets")
      .select("*")
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("monthly_actuals")
      .select("*")
      .eq("month", month)
      .eq("year", year),
    supabase
      .from("monthly_city_tours")
      .select("*, city:cities(id, name)")
      .eq("month", month)
      .eq("year", year),
    supabase.from("cities").select("*").order("name", { ascending: true }),
  ]);

  // Determine if viewing the current month for MTD pacing
  const now = new Date();
  const isCurrentMonth =
    month === now.getMonth() + 1 && year === now.getFullYear();

  // For current month, compute Month-to-Date targets from daily_metrics
  const mtdCallTargets: Record<string, number> = {};
  const mtdMeetingTargets: Record<string, number> = {};

  if (isCurrentMonth) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${year}-${pad(month)}-${pad(now.getDate())}`;

    const { data: dailyRows } = await supabase
      .from("daily_metrics")
      .select("employee_id, target_calls, target_total_meetings")
      .gte("date", `${year}-${pad(month)}-01`)
      .lte("date", today);

    for (const row of dailyRows ?? []) {
      mtdCallTargets[row.employee_id] =
        (mtdCallTargets[row.employee_id] ?? 0) + row.target_calls;
      mtdMeetingTargets[row.employee_id] =
        (mtdMeetingTargets[row.employee_id] ?? 0) +
        row.target_total_meetings;
    }
  }

  // Group city tours by employee
  const toursByEmployee = new Map<string, CityTourWithCity[]>();
  for (const row of (cityTours ?? []) as CityTourWithCity[]) {
    const list = toursByEmployee.get(row.employee_id) ?? [];
    list.push(row);
    toursByEmployee.set(row.employee_id, list);
  }

  // Index targets & actuals by employee_id for O(1) lookups
  const targetsByEmployee = new Map(
    (targets ?? []).map((t) => [t.employee_id, t])
  );
  const actualsByEmployee = new Map(
    (actuals ?? []).map((a) => [a.employee_id, a])
  );

  // Merge employees with their target/actual/city tour data
  const data: EmployeeMonthlyData[] = employees.map((emp) => {
    const target = targetsByEmployee.get(emp.id) ?? null;
    const actual = actualsByEmployee.get(emp.id) ?? null;
    const tours = toursByEmployee.get(emp.id) ?? [];

    // For current month, override synced targets with MTD pacing values
    if (isCurrentMonth && target) {
      return {
        employee: emp,
        target: {
          ...target,
          target_total_calls: mtdCallTargets[emp.id] ?? 0,
          target_total_meetings: mtdMeetingTargets[emp.id] ?? 0,
        },
        actual,
        cityTours: tours,
      };
    }

    return { employee: emp, target, actual, cityTours: tours };
  });

  return (
    <PerformanceGrid
      data={data}
      userRole={userRole}
      month={month}
      year={year}
      isCurrentMonth={isCurrentMonth}
      cities={cities ?? []}
    />
  );
}
