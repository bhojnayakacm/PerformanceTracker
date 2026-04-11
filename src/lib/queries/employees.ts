import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Employee } from "@/lib/types";

/**
 * Fetch employees scoped to the user's role.
 * Managers see only their assigned employees; everyone else sees all.
 */
export async function getEmployeesForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  role: string,
  {
    activeOnly = false,
    search = "",
  }: { activeOnly?: boolean; search?: string } = {}
): Promise<Employee[]> {
  if (role === "manager") {
    const { data: assignments } = await supabase
      .from("manager_assignments")
      .select("employee_id")
      .eq("manager_id", userId);

    const assignedIds = (assignments ?? []).map((a) => a.employee_id);
    if (assignedIds.length === 0) return [];

    let query = supabase
      .from("employees")
      .select("*")
      .in("id", assignedIds)
      .order("name", { ascending: true });

    if (activeOnly) query = query.eq("is_active", true);
    if (search) {
      query = query.or(`name.ilike.%${search}%,emp_id.ilike.%${search}%`);
    }

    const { data } = await query;
    return data ?? [];
  }

  let query = supabase
    .from("employees")
    .select("*")
    .order("name", { ascending: true });

  if (activeOnly) query = query.eq("is_active", true);
  if (search) {
    query = query.or(`name.ilike.%${search}%,emp_id.ilike.%${search}%`);
  }

  const { data } = await query;
  return data ?? [];
}

/**
 * Verify that a manager has access to the given employee IDs.
 * Returns true only if ALL IDs are assigned to this manager.
 */
export async function assertManagerEmployeeAccess(
  supabase: SupabaseClient<Database>,
  managerId: string,
  employeeIds: string[]
): Promise<boolean> {
  if (employeeIds.length === 0) return true;

  const { data } = await supabase
    .from("manager_assignments")
    .select("employee_id")
    .eq("manager_id", managerId)
    .in("employee_id", employeeIds);

  return (data?.length ?? 0) === employeeIds.length;
}
