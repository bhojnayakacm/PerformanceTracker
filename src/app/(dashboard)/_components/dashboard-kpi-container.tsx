"use client";

/**
 * Client wrapper for the dashboard stat cards — same shape as
 * CumulativeGridContainer. Owns the data lifecycle (useQuery +
 * keepPreviousData + browser Supabase singleton); the view owns presentation
 * and the navigation-pending dim.
 *
 * On a range change the URL flips (via MonthRangeSelector), the queryKey
 * changes, and TanStack returns the previous KPIs (placeholderData) until the
 * new fetch resolves — so the cards dim instead of flashing a skeleton.
 */

import { useMemo } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { UserRole } from "@/lib/types";
import {
  fetchDashboardKpis,
  dashboardKpisQueryKey,
  type DashboardKpisParams,
} from "../_lib/fetch-dashboard-kpis";
import { DashboardStatCards } from "./dashboard-stat-cards";

type Props = {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  userId: string;
  userRole: UserRole;
};

export function DashboardKpiContainer({
  fromMonth,
  fromYear,
  toMonth,
  toYear,
  userId,
  userRole,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  const params: DashboardKpisParams = useMemo(
    () => ({ fromMonth, fromYear, toMonth, toYear, userId, userRole }),
    [fromMonth, fromYear, toMonth, toYear, userId, userRole],
  );

  const { data, isFetching } = useQuery({
    queryKey: dashboardKpisQueryKey(params),
    queryFn: () => fetchDashboardKpis(supabase, params),
    placeholderData: keepPreviousData,
  });

  return <DashboardStatCards data={data} isFetching={isFetching} />;
}
