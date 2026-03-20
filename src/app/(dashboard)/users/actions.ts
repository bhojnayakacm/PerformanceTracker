"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

type ActionResult = { success: true } | { error: string };

const VALID_ROLES: UserRole[] = ["super_admin", "editor", "viewer"];

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

  return { supabase, currentUserId: user.id };
}

export async function updateUserRole(
  userId: string,
  newRole: UserRole
): Promise<ActionResult> {
  if (!VALID_ROLES.includes(newRole)) {
    return { error: "Invalid role" };
  }

  try {
    const { supabase, currentUserId } = await assertSuperAdmin();

    if (userId === currentUserId) {
      return { error: "You cannot change your own role" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", userId);

    if (error) return { error: error.message };

    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleUserStatus(
  userId: string,
  currentStatus: boolean
): Promise<ActionResult> {
  try {
    const { supabase, currentUserId } = await assertSuperAdmin();

    if (userId === currentUserId) {
      return { error: "You cannot deactivate your own account" };
    }

    const { error } = await supabase
      .from("profiles")
      .update({ is_active: !currentStatus })
      .eq("id", userId);

    if (error) return { error: error.message };

    revalidatePath("/users");
    return { success: true };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
