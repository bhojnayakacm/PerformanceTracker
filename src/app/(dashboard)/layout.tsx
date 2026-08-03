import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import {
  RouteProgress,
  RouteTransitionDimmer,
} from "@/components/route-progress";
import { QueryProvider } from "@/components/providers/query-provider";
import type { UserRole } from "@/lib/types";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name ?? user.email ?? "User";
  const userRole = (profile?.role ?? "viewer") as UserRole;

  return (
    <QueryProvider>
      {/* Reads useSearchParams to detect route commits — Suspense-wrapped so it
          can never opt a route out of static generation. */}
      <Suspense fallback={null}>
        <RouteProgress />
      </Suspense>
      <SidebarProvider className="h-svh overflow-hidden">
        <AppSidebar userId={user.id} userRole={userRole} />
        <SidebarInset className="min-w-0 min-h-0 overflow-hidden bg-slate-50">
          <AppHeader userName={userName} userRole={userRole} />
          <main className="flex-1 min-h-0 min-w-0 overflow-y-auto bg-slate-50 p-6">
            <RouteTransitionDimmer>{children}</RouteTransitionDimmer>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </QueryProvider>
  );
}
