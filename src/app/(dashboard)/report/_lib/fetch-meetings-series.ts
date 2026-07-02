/**
 * Report — Meetings & Field Activity fetch (DAILY tier).
 *
 * Wraps get_employee_meetings_series (migration 0023). The RPC buckets by
 * day / week / month server-side, so one function serves every horizon from
 * "Last 7 Days" to "Last 12 Months". "Meetings" = architect + client + site
 * visits, which is exactly the universe daily_metrics.target_total_meetings
 * is defined over (migration 0004) — so attainment compares like with like.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { DailyBucket, DailyWindow } from "./report-ranges";

export type MeetingsSeriesParams = {
  employeeId: string;
  window: DailyWindow;
  userId: string;
};

export type MeetingsPoint = {
  bucketStart: string;
  architect: number;
  client: number;
  siteVisits: number;
  calls: number;
  /** architect + client + siteVisits — the tracked "meetings" bucket. */
  meetings: number;
  targetMeetings: number;
  targetCalls: number;
};

export type MeetingsSeriesPayload = {
  points: MeetingsPoint[];
  bucket: DailyBucket;
  totals: {
    architect: number;
    client: number;
    siteVisits: number;
    calls: number;
    meetings: number;
    targetMeetings: number;
  };
};

export function meetingsSeriesQueryKey(p: MeetingsSeriesParams) {
  return [
    "report-meetings-series",
    {
      employeeId: p.employeeId,
      from: p.window.from,
      to: p.window.to,
      bucket: p.window.bucket,
      userId: p.userId,
    },
  ] as const;
}

export async function fetchMeetingsSeries(
  supabase: SupabaseClient<Database>,
  { employeeId, window }: MeetingsSeriesParams,
): Promise<MeetingsSeriesPayload> {
  const { data, error } = await supabase.rpc("get_employee_meetings_series", {
    _employee_id: employeeId,
    _from: window.from,
    _to: window.to,
    _bucket: window.bucket,
  });
  if (error) throw error;

  const points: MeetingsPoint[] = (data ?? []).map((r) => {
    const architect = Number(r.architect_meetings) || 0;
    const client = Number(r.client_meetings) || 0;
    const siteVisits = Number(r.site_visits) || 0;
    return {
      bucketStart: r.bucket_start,
      architect,
      client,
      siteVisits,
      calls: Number(r.calls) || 0,
      meetings: architect + client + siteVisits,
      targetMeetings: Number(r.target_meetings) || 0,
      targetCalls: Number(r.target_calls) || 0,
    };
  });

  const totals = points.reduce(
    (acc, p) => {
      acc.architect += p.architect;
      acc.client += p.client;
      acc.siteVisits += p.siteVisits;
      acc.calls += p.calls;
      acc.meetings += p.meetings;
      acc.targetMeetings += p.targetMeetings;
      return acc;
    },
    {
      architect: 0,
      client: 0,
      siteVisits: 0,
      calls: 0,
      meetings: 0,
      targetMeetings: 0,
    },
  );

  return { points, bucket: window.bucket, totals };
}
