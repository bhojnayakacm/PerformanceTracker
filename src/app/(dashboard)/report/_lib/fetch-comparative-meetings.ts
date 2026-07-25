/**
 * Comparative Meetings fetch (DAILY tier) — wraps get_comparative_meetings_series
 * (migration 0025). One row per (employee, bucket); the client aligns them into a
 * shared axis via buildSeries. `meetings` is the combined architect+client+site
 * universe the daily target is defined over, so the head-to-head compares like
 * with like. The query key sorts ids so {A,B} and {B,A} share one cache entry —
 * colour slotting stays with the URL order, held separately by the component.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DailyBucket, DailyWindow } from "./report-ranges";

export type ComparativeMeetingsParams = {
  employeeIds: string[];
  window: DailyWindow;
  userId: string;
};

export type ComparativeMeetingsRow = {
  employeeId: string;
  bucketStart: string;
  architect: number;
  client: number;
  siteVisits: number;
  /** architect + client + siteVisits, pre-summed server-side. */
  meetings: number;
  calls: number;
  targetMeetings: number;
  targetCalls: number;
};

export type ComparativeMeetingsPayload = {
  rows: ComparativeMeetingsRow[];
  bucket: DailyBucket;
};

export function comparativeMeetingsQueryKey(p: ComparativeMeetingsParams) {
  return [
    "report-cmp-meetings",
    {
      ids: [...p.employeeIds].sort(),
      from: p.window.from,
      to: p.window.to,
      bucket: p.window.bucket,
      userId: p.userId,
    },
  ] as const;
}

export async function fetchComparativeMeetings(
  supabase: SupabaseClient<Database>,
  { employeeIds, window }: ComparativeMeetingsParams,
): Promise<ComparativeMeetingsPayload> {
  if (employeeIds.length === 0) return { rows: [], bucket: window.bucket };

  const { data, error } = await supabase.rpc(
    "get_comparative_meetings_series",
    {
      _employee_ids: employeeIds,
      _from: window.from,
      _to: window.to,
      _bucket: window.bucket,
    },
  );
  if (error) throw error;

  const rows: ComparativeMeetingsRow[] = (data ?? []).map((r) => ({
    employeeId: r.employee_id,
    bucketStart: r.bucket_start,
    architect: Number(r.architect_meetings) || 0,
    client: Number(r.client_meetings) || 0,
    siteVisits: Number(r.site_visits) || 0,
    meetings: Number(r.meetings) || 0,
    calls: Number(r.calls) || 0,
    targetMeetings: Number(r.target_meetings) || 0,
    targetCalls: Number(r.target_calls) || 0,
  }));

  return { rows, bucket: window.bucket };
}
