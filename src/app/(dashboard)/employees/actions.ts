"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  employeeCreateSchema,
  employeeUpdateSchema,
  type EmployeeCreateInput,
  type EmployeeUpdateInput,
} from "@/lib/validators/employee";

type ActionResult = { success: true } | { error: string; field?: string };

/* ── 23505 disambiguation ──────────────────────────────────────────────────
 *
 * Both emp_id and name are unique on employees (the latter via
 * 0011_unique_employee_name.sql). Postgres returns the same SQLSTATE 23505
 * for either collision, so the action has to inspect the message/details
 * to attribute the violation to the right form field.
 *
 * PostgrestError surfaces the constraint name in `error.message` like:
 *   `duplicate key value violates unique constraint "employees_name_unique"`
 * and the offending key in `error.details` like:
 *   `Key (name)=(John Doe) already exists.`
 *
 * We sniff for the constraint name in `message` first (cheaper, more
 * specific than a regex against `details`), then fall back to a generic
 * "this ID already exists" wording if Supabase ever returns a 23505 we
 * don't recognise — better than rendering raw SQL to the operator.
 * ─────────────────────────────────────────────────────────────────────── */
function explain23505(error: {
  message?: string | null;
  details?: string | null;
}): { error: string; field: "emp_id" | "name" } {
  const msg = `${error.message ?? ""} ${error.details ?? ""}`;
  if (/employees_name_unique|Key \(name\)/i.test(msg)) {
    return {
      error: "An employee with this exact name already exists.",
      field: "name",
    };
  }
  // Default branch covers `employees_emp_id_key` and any unrecognised
  // 23505 — emp_id is the historical primary uniqueness contract, so
  // it's the safer default than no field attribution at all.
  return {
    error: "An employee with this ID already exists.",
    field: "emp_id",
  };
}

async function assertSuperAdmin() {
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

  if (profile?.role !== "super_admin") throw new Error("Forbidden");

  return supabase;
}

export async function createEmployee(
  input: EmployeeCreateInput
): Promise<ActionResult> {
  const parsed = employeeCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const supabase = await assertSuperAdmin();

    const { error } = await supabase.from("employees").insert({
      emp_id: parsed.data.emp_id,
      name: parsed.data.name,
      location: parsed.data.location || null,
      state: parsed.data.state || null,
      date_of_joining: parsed.data.date_of_joining || null,
      reporting_manager_id: parsed.data.reporting_manager_id || null,
    });

    if (error) {
      if (error.code === "23505") return explain23505(error);
      return { error: error.message };
    }

    revalidatePath("/employees");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function updateEmployee(
  input: EmployeeUpdateInput
): Promise<ActionResult> {
  const parsed = employeeUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  try {
    const supabase = await assertSuperAdmin();

    const { error } = await supabase
      .from("employees")
      .update({
        emp_id: parsed.data.emp_id,
        name: parsed.data.name,
        location: parsed.data.location || null,
        state: parsed.data.state || null,
        date_of_joining: parsed.data.date_of_joining || null,
        reporting_manager_id: parsed.data.reporting_manager_id || null,
      })
      .eq("id", parsed.data.id);

    if (error) {
      if (error.code === "23505") return explain23505(error);
      return { error: error.message };
    }

    revalidatePath("/employees");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleEmployeeStatus(
  id: string,
  currentStatus: boolean
): Promise<ActionResult> {
  try {
    const supabase = await assertSuperAdmin();

    const { error } = await supabase
      .from("employees")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) return { error: error.message };

    revalidatePath("/employees");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

/* ── Hard delete ───────────────────────────────────────────────────────────
 *
 * WHY THIS COUNTS FIRST INSTEAD OF RELYING ON A 23503
 *
 * Every child table declares its FK to employees as ON DELETE **CASCADE**
 * (monthly_targets/monthly_actuals in 0001, daily_metrics in 0002,
 * manager_assignments in 0007, monthly_city_tours in 0008). So a bare
 * `DELETE FROM employees` does NOT raise a foreign-key violation — Postgres
 * happily deletes the employee AND silently takes every daily log, target,
 * actual and city-tour row with them. Catching 23503 would therefore never
 * fire, and the "safe" delete would be the most destructive operation in the
 * app.
 *
 * So the guard has to be an explicit pre-flight dependency count: we refuse
 * the delete whenever the employee has any performance history, and only ever
 * hard-delete genuinely empty records (the "created by mistake" case).
 * Migration 0027 additionally flips those constraints to ON DELETE RESTRICT
 * so the database enforces the same rule; the 23503 branch below is what
 * catches it once that migration is applied, and covers any FK added later
 * that this function doesn't know about. Belt and braces, deliberately.
 *
 * Counting and deleting are not atomic — a log written in between would be
 * lost. That window is why the RESTRICT migration matters: with it applied,
 * Postgres rejects the delete outright and we report it via the 23503 branch.
 */

/** Child tables that make an employee "in use", with human labels for the
 *  error message. `reporting_manager_id` is handled separately below since
 *  it lives on employees itself and reads differently to an operator. */
const EMPLOYEE_DEPENDENCIES = [
  { table: "daily_metrics", label: "daily logs" },
  { table: "monthly_targets", label: "monthly targets" },
  { table: "monthly_actuals", label: "monthly actuals" },
  { table: "monthly_city_tours", label: "city tours" },
  { table: "manager_assignments", label: "manager assignments" },
] as const;

export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    const supabase = await assertSuperAdmin();

    // Read the name from the DB rather than trusting the client's copy — it
    // is what the confirmation and error messages quote back to the operator.
    const { data: employee, error: fetchError } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", id)
      .single();

    if (fetchError || !employee) {
      return { error: "That employee no longer exists. Refresh the page." };
    }

    // Fail CLOSED: if any count query errors we abort rather than risk a
    // cascade against an unverified dependency set.
    const counts = await Promise.all(
      EMPLOYEE_DEPENDENCIES.map(async ({ table, label }) => {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("employee_id", id);
        if (error) throw new Error(`Could not verify ${label}: ${error.message}`);
        return { label, count: count ?? 0 };
      }),
    );

    const blocking = counts.filter((c) => c.count > 0);
    if (blocking.length > 0) {
      const detail = blocking.map((c) => `${c.count} ${c.label}`).join(", ");
      return {
        error: `Cannot delete ${employee.name} because they have existing performance records (${detail}). Please Deactivate them instead.`,
      };
    }

    // Deleting a manager would silently null out their reports'
    // reporting_manager_id (0016 declares that FK as ON DELETE SET NULL), so
    // reassigning is made an explicit decision rather than a side effect.
    const { count: reportCount, error: reportError } = await supabase
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("reporting_manager_id", id);

    if (reportError) {
      return { error: `Could not verify direct reports: ${reportError.message}` };
    }
    if ((reportCount ?? 0) > 0) {
      return {
        error: `Cannot delete ${employee.name} — they are the reporting manager for ${reportCount} employee(s). Reassign those employees first, or Deactivate this one instead.`,
      };
    }

    const { error } = await supabase.from("employees").delete().eq("id", id);

    if (error) {
      // Live once migration 0027 converts the child FKs to ON DELETE RESTRICT,
      // and the net for any FK added after this function was written.
      if (error.code === "23503") {
        return {
          error: `Cannot delete ${employee.name} because they have existing performance records. Please Deactivate them instead.`,
        };
      }
      return { error: error.message };
    }

    // The employee disappears from every roster, not just this page.
    revalidatePath("/employees");
    revalidatePath("/monthly-data");
    revalidatePath("/daily-logs");
    revalidatePath("/cumulative-data");
    revalidatePath("/report");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
