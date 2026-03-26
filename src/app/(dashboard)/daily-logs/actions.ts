"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { success: true } | { error: string };

type DailyEntry = {
  employee_id: string;
  target_calls: number;
  target_architect_meetings: number;
  target_client_meetings: number;
  target_site_visits: number;
  actual_calls: number;
  actual_architect_meetings: number;
  actual_client_meetings: number;
  actual_site_visits: number;
};

type SaveInput = {
  date: string;
  entries: DailyEntry[];
};

export async function saveDailyMetrics(
  input: SaveInput
): Promise<ActionResult> {
  const { date, entries } = input;

  if (!date || entries.length === 0) {
    return { error: "No data to save" };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "Unauthorized" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role ?? "viewer";

    if (role === "viewer") {
      return { error: "You don't have permission to edit data" };
    }

    const isSuperAdmin = role === "super_admin";

    // Build upsert rows based on role
    const rows = entries.map((e) => {
      if (isSuperAdmin) {
        // Super admin can set both targets and actuals
        return {
          employee_id: e.employee_id,
          date,
          target_calls: e.target_calls,
          target_architect_meetings: e.target_architect_meetings,
          target_client_meetings: e.target_client_meetings,
          target_site_visits: e.target_site_visits,
          actual_calls: e.actual_calls,
          actual_architect_meetings: e.actual_architect_meetings,
          actual_client_meetings: e.actual_client_meetings,
          actual_site_visits: e.actual_site_visits,
        };
      }
      // Editor can only set actuals
      return {
        employee_id: e.employee_id,
        date,
        actual_calls: e.actual_calls,
        actual_architect_meetings: e.actual_architect_meetings,
        actual_client_meetings: e.actual_client_meetings,
        actual_site_visits: e.actual_site_visits,
      };
    });

    const { error } = await supabase
      .from("daily_metrics")
      .upsert(rows, { onConflict: "employee_id,date" });

    if (error) return { error: error.message };

    revalidatePath("/daily-logs");
    revalidatePath("/monthly-data");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
