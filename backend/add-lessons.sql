begin;

alter table public.tasks add column if not exists lesson integer not null default 1
  check (lesson between 1 and 2);
grant insert (lesson) on public.tasks to authenticated;

commit;
