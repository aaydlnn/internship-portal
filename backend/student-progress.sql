begin;

alter table public.members drop constraint members_role_check;
alter table public.members add constraint members_role_check
  check (role in ('student', 'mentor', 'viewer'));

create function public.apply_portal_viewer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.role = 'student' and exists (
    select 1 from auth.users
    where id = new.id and raw_app_meta_data -> 'portal_read_only' = 'true'::jsonb
  ) then
    new.role := 'viewer';
  end if;
  return new;
end;
$$;
revoke all on function public.apply_portal_viewer() from public, anon, authenticated;
create trigger apply_portal_viewer before insert or update of role on public.members
  for each row execute function public.apply_portal_viewer();

create or replace function public.record_portal_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.members set must_change_password = false
  where id = new.id and role in ('student', 'viewer') and must_change_password;
  return new;
end;
$$;

create policy submissions_viewer_read on public.submissions for select to authenticated
using (exists (
  select 1 from public.members where id = (select auth.uid()) and role = 'viewer'
));

create function public.portal_student_roster()
returns table (id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select student.id, coalesce(
    nullif(trim(auth_user.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(auth_user.email, '@', 1), ''),
    student.id::text
  )
  from public.members student
  join auth.users auth_user on auth_user.id = student.id
  where student.role = 'student' and exists (
    select 1 from public.members staff
    where staff.id = (select auth.uid()) and
      (staff.role = 'mentor' or (staff.role = 'viewer' and not staff.must_change_password))
  )
  order by 2, 1;
$$;
revoke all on function public.portal_student_roster() from public, anon, authenticated;
grant execute on function public.portal_student_roster() to authenticated;

commit;
