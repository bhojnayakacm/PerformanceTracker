-- Add optional state column to employees
alter table public.employees
  add column state text;
