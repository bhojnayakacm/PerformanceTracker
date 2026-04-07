-- Add optional remarks column to daily_metrics
alter table public.daily_metrics
  add column remarks text;
