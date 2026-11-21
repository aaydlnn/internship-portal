begin;

create table public.members (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('student', 'mentor'))
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  week integer not null check (week between 1 and 6),
  lesson integer not null default 1 check (lesson between 1 and 2),
  title text not null check (char_length(trim(title)) between 1 and 120),
  instructions text not null check (char_length(trim(instructions)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create table public.submissions (
  id uuid primary key,
  task_id uuid not null references public.tasks(id),
  student_id uuid not null references auth.users(id) on delete cascade,
  student_email text not null,
  answer text not null default '' check (char_length(answer) <= 6000),
  file_path text unique,
  file_name text,
  feedback text check (char_length(trim(feedback)) between 1 and 4000),
  submitted_at timestamptz not null default now(),
  unique (task_id, student_id),
  check (trim(answer) <> '' or file_path is not null),
  check ((file_path is null and file_name is null) or
    (file_path is not null and file_name is not null and char_length(trim(file_name)) between 1 and 255 and
    file_path = student_id::text || '/' || id::text))
);

alter table public.members enable row level security;
alter table public.tasks enable row level security;
alter table public.submissions enable row level security;

revoke all on public.members, public.tasks, public.submissions from public, anon, authenticated;
grant select on public.members, public.tasks, public.submissions to authenticated;
grant insert (id, week, lesson, title, instructions) on public.tasks to authenticated;
grant insert (id, task_id, student_id, answer, file_path, file_name) on public.submissions to authenticated;

create policy members_read_own on public.members for select to authenticated
using (id = (select auth.uid()));

create policy tasks_read on public.tasks for select to authenticated
using (exists (select 1 from public.members where id = (select auth.uid())));

create policy tasks_add on public.tasks for insert to authenticated
with check (exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'));

create policy submissions_read on public.submissions for select to authenticated
using (exists (select 1 from public.members m where m.id = (select auth.uid()) and
  (m.role = 'mentor' or (m.role = 'student' and student_id = m.id))));

create policy submissions_add on public.submissions for insert to authenticated
with check (student_id = (select auth.uid()) and exists (
  select 1 from public.members where id = (select auth.uid()) and role = 'student'
));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('internship-files', 'internship-files', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png']);

create policy internship_files_add on storage.objects for insert to authenticated
with check (bucket_id = 'internship-files'
  and name ~ ('^' || (select auth.uid())::text || '/[0-9a-f-]{36}$')
  and exists (select 1 from public.members where id = (select auth.uid()) and role = 'student'));

create policy internship_files_read on storage.objects for select to authenticated
using (bucket_id = 'internship-files'
  and exists (select 1 from public.members where id = (select auth.uid()))
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or exists (select 1 from public.submissions where file_path = name)
  ));

create policy internship_files_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'internship-files'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.submissions where file_path = name));

create function public.prepare_submission() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  new.student_email := coalesce(auth.jwt() ->> 'email', new.student_id::text);
  if new.file_path is not null and not exists (
    select 1 from storage.objects where bucket_id = 'internship-files' and name = new.file_path
  ) then
    raise exception 'Attachment is missing';
  end if;
  return new;
end;
$$;
revoke all on function public.prepare_submission() from public, anon, authenticated;

create trigger prepare_submission before insert on public.submissions
for each row execute function public.prepare_submission();

create function public.review_submission(submission_id uuid, note text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.members where id = auth.uid() and role = 'mentor') then
    raise exception 'Mentor access required' using errcode = '42501';
  end if;
  if note is null or char_length(trim(note)) not between 1 and 4000 then
    raise exception 'Feedback must contain 1 to 4000 characters';
  end if;
  update public.submissions set feedback = trim(note) where id = submission_id;
  if not found then raise exception 'Submission not found'; end if;
end;
$$;
revoke all on function public.review_submission(uuid, text) from public, anon, authenticated;
grant execute on function public.review_submission(uuid, text) to authenticated;

insert into public.tasks (id, week, title, instructions) values
('43d2a439-4eff-4ec4-99d4-c8d4372c2441', 1, 'Özünə uyğun rolu seç',
 'Kibertəhlükəsizlik üzrə bir peşə seç. Hansı rolu seçdin? Niyə məhz bu rol? Bu roldan nə gözləyirsən?'),
('43d2a439-4eff-4ec4-99d4-c8d4372c2442', 1, 'Bir kiberhadisəni təsvir et',
 'Yaşadığın, eşitdiyin və ya oxuduğun bir hadisəni seç. Nə baş verdi, nəticəsi nə oldu və bundan nə öyrənmək olar? Şəxsi və məxfi məlumatları paylaşma.');

commit;
