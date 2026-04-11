import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

/**
 * Deduplicated auth + profile role fetch for the current request.
 * React cache() ensures this runs at most once per server render pass,
 * so multiple server components in the same tree can call it for free.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    supabase,
    id: user.id,
    role: (profile?.role ?? "viewer") as UserRole,
  };
});
