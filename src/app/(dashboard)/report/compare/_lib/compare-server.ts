import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/queries/auth";
import { getEmployeesForUser } from "@/lib/queries/employees";
import { parseCompareIds } from "../../_lib/comparative";
import type { MultiOption } from "../../_components/report-employee-multi-select";

/**
 * Shared server prelude for every Compare page: resolve the caller, scope the
 * roster (getEmployeesForUser), and turn `?ids=` into the effective id list.
 *
 * The scope model hinges on distinguishing an ABSENT param from an EMPTY one:
 *   • absent (`undefined`) → the whole roster, the default. Company-wide
 *     analysis is what management reaches for first, and expressing it as the
 *     absence of a param keeps the URL short no matter how large the roster.
 *   • `?ids=a,b`          → that subset, validated against the roster.
 *   • `?ids=` (empty)     → explicitly nobody, so the page can show its prompt
 *     instead of silently snapping back to everyone.
 *
 * Every page calls this, so the multi-select's options AND the prefetch id list
 * come from the same scoped source — an id outside the roster is dropped here,
 * before it can reach an RPC. Returns the authed client so the page can prefetch
 * on the same connection without a second getAuthUser.
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

  const isAllScope = idsRaw === undefined;
  const selectedIds = isAllScope
    ? options.map((o) => o.id)
    : parseCompareIds(idsRaw, options);

  return { auth, options, selectedIds, isAllScope };
}
