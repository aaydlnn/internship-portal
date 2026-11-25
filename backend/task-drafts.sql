begin;
alter table public.tasks add column published boolean not null default true;
grant insert (published), update (published) on public.tasks to authenticated;

create policy tasks_published_or_mentor on public.tasks
  as restrictive for select to authenticated
  using (published or exists (
    select 1 from public.members where id = (select auth.uid()) and role = 'mentor'
  ));

create policy submissions_published_task on public.submissions
  as restrictive for insert to authenticated
  with check (exists (
    select 1 from public.tasks where id = task_id and published
  ));
commit;
