begin;

alter table public.members
  add column must_change_password boolean not null default true;
update public.members set must_change_password = false where role = 'mentor';

create function public.portal_password_ready() returns boolean
language sql stable set search_path = '' as $$
  select exists (
    select 1 from public.members
    where id = (select auth.uid()) and (role = 'mentor' or not must_change_password)
  );
$$;
revoke all on function public.portal_password_ready() from public, anon;
grant execute on function public.portal_password_ready() to authenticated;

create policy tasks_password_ready on public.tasks
  as restrictive for all to authenticated
  using ((select public.portal_password_ready()))
  with check ((select public.portal_password_ready()));

create policy submissions_password_ready on public.submissions
  as restrictive for all to authenticated
  using ((select public.portal_password_ready()))
  with check ((select public.portal_password_ready()));

create policy details_password_ready on public.site_details
  as restrictive for all to authenticated
  using (section = 'portal' or (select public.portal_password_ready()))
  with check (section = 'portal' or (select public.portal_password_ready()));

create policy internship_files_password_ready on storage.objects
  as restrictive for all to authenticated
  using (bucket_id <> 'internship-files' or (select public.portal_password_ready()))
  with check (bucket_id <> 'internship-files' or (select public.portal_password_ready()));

create function public.record_portal_password_change() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.members
    set must_change_password = false
    where id = new.id and role = 'student' and must_change_password;
  return new;
end;
$$;
revoke all on function public.record_portal_password_change() from public, anon, authenticated;

-- Supabase Auth updates recovery_token as part of a password change. A sign-in
-- that re-encrypts the old password updates only encrypted_password.
create trigger record_portal_password_change
  after update of recovery_token on auth.users
  for each row
  when (old.encrypted_password is distinct from new.encrypted_password
    and nullif(new.encrypted_password, '') is not null)
  execute function public.record_portal_password_change();

commit;
