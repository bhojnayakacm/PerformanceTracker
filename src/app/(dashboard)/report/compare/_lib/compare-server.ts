import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/queries/auth";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { parseCompareIds } from "../../_lib/comparative";
import type { MultiOption } from "../../_components/report-employee-multi-select";

/**
 * Shared server prelude for every Compare page: resolve the caller, scope the
 * roster (getEmployeesForUser), and parse `?ids=` down to a validated in-roster
 * id list. Every page calls this so the multi-select options AND the prefetch id
 * list come from the same scoped source — a hand-typed id outside the roster is
 * dropped here, before it ever reaches an RPC. Returns the authed client so the
 * page can prefetch on the same connection without a second getAuthUser.
 */
export async function resolveCompareContext(idsRaw: string | undefined) {
  const auth = await getAuthUser();
  if (!auth) redirect("/login");

  const roster = await getEmployeesForUser(auth.supabase, auth.id, auth.role, {
    activeOnly: false,
  });
  const options: MultiOption[] = roster.map((e) => ({
    id: e.id,
    name: e.name,
    emp_id: e.emp_id,
  }));

  const selectedIds = parseCompareIds(idsRaw, options);

  return { auth, options, selectedIds };
}
