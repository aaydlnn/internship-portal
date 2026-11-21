begin;

create table public.site_details (
  section text primary key check (section ~ '^(portal|week-[1-6]|lesson-[1-6]-[12])$'),
  title text not null check (char_length(trim(title)) between 1 and 120),
  subtitle text not null default '' check (char_length(subtitle) <= 120),
  description text not null default '' check (char_length(description) <= 2400),
  material_title text not null default '' check (char_length(material_title) <= 120),
  material_url text not null default '' check (
    char_length(material_url) <= 2000 and (material_url = '' or material_url ~ '^https://[^[:space:]]+$')
  ),
  material_hidden boolean not null default false,
  check (section like 'lesson-%' or (
    description = '' and material_title = '' and material_url = '' and not material_hidden
  )),
  check (section = 'portal' or subtitle = '')
);

alter table public.site_details enable row level security;
revoke all on public.site_details from public, anon, authenticated;
grant select on public.site_details to anon, authenticated;
grant insert on public.site_details to authenticated;
grant update (title, subtitle, description, material_title, material_url, material_hidden)
  on public.site_details to authenticated;

create policy site_details_read_portal on public.site_details for select to anon, authenticated
using (section = 'portal');

create policy site_details_read_member on public.site_details for select to authenticated
using (exists (select 1 from public.members where id = (select auth.uid())));

create policy site_details_add on public.site_details for insert to authenticated
with check (exists (
  select 1 from public.members where id = (select auth.uid()) and role = 'mentor'
));

create policy site_details_edit on public.site_details for update to authenticated
using (exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'))
with check (exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'));

grant update (title, instructions) on public.tasks to authenticated;
create policy tasks_edit on public.tasks for update to authenticated
using (exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'))
with check (exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'));

-- An upsert needs permission to update its conflict column. Keep that column stable.
create function public.prevent_detail_move() returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.section <> old.section then
    raise exception 'Section cannot change';
  end if;
  return new;
end;
$$;
create trigger prevent_detail_move before update on public.site_details
for each row execute function public.prevent_detail_move();
grant update (section) on public.site_details to authenticated;

commit;
