import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { UsersDataTable } from "./_components/users-data-table";

export default async function UsersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: profiles }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true }),
  ]);

  if (profile?.role !== "super_admin") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            User Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage application users and their roles.
          </p>
        </div>
        <div className="rounded-lg border p-8 text-center text-muted-foreground">
          <p>Only Super Admins can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
        <p className="text-muted-foreground mt-1">
          Manage application users and their roles.
        </p>
      </div>
      <UsersDataTable data={profiles ?? []} currentUserId={user.id} />
    </div>
  );
}
