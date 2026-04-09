"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertManagerEmployeeAccess } from "@/lib/queries/employees";
import {
  monthlyDataSchema,
  type MonthlyDataInput,
} from "@/lib/validators/monthly-data";

type ActionResult = { success: true } | { error: string };

type SaveInput = MonthlyDataInput & {
  employeeId: string;
  month: number;
  year: number;
};

async function getAuthenticatedRole() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return { supabase, userId: user.id, role: (profile?.role ?? "viewer") as string };
}

export async function saveMonthlyData(
  input: SaveInput
): Promise<ActionResult> {
  const { employeeId, month, year, ...values } = input;

  const parsed = monthlyDataSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const { supabase, userId, role } = await getAuthenticatedRole();

    if (role === "viewer") {
      return { error: "You don't have permission to edit data" };
    }

    const canEditTargets = role === "super_admin" || role === "manager";

    // If manager, verify access to this employee
    if (role === "manager") {
      const hasAccess = await assertManagerEmployeeAccess(
        supabase,
        userId,
        [employeeId]
      );
      if (!hasAccess) {
        return { error: "You don't have access to this employee" };
      }
    }

    const data = parsed.data;

    // Upsert targets (super_admin and manager)
    // Note: target_total_meetings & target_total_calls are now auto-synced from daily_metrics
    if (canEditTargets) {
      const { error: targetError } = await supabase
        .from("monthly_targets")
        .upsert(
          {
            employee_id: employeeId,
            month,
            year,
            target_client_visits: data.target_client_visits,
            target_dispatched_sqft: data.target_dispatched_sqft,
            target_tour_days: data.target_tour_days,
            target_travelling_cities: data.target_travelling_cities,
          },
          { onConflict: "employee_id,month,year" }
        );

      if (targetError) return { error: targetError.message };
    }

    // Upsert actuals (super_admin, manager, and editor)
    // Note: actual_calls, actual_architect_meetings, actual_client_meetings,
    //       actual_site_visits are now auto-synced from daily_metrics
    const cities = data.actual_travelling_cities
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const { error: actualError } = await supabase
      .from("monthly_actuals")
      .upsert(
        {
          employee_id: employeeId,
          month,
          year,
          actual_client_visits: data.actual_client_visits,
          actual_dispatched_sqft: data.actual_dispatched_sqft,
          actual_dispatched_amount: data.actual_dispatched_amount,
          actual_conversions: data.actual_conversions,
          actual_tour_days: data.actual_tour_days,
          actual_travelling_cities: cities.length > 0 ? cities : null,
          salary: data.salary,
          tada: data.tada,
          incentive: data.incentive,
          sales_promotion: data.sales_promotion,
        },
        { onConflict: "employee_id,month,year" }
      );

    if (actualError) return { error: actualError.message };

    revalidatePath("/monthly-data");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
