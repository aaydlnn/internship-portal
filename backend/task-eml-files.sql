begin;
alter table public.tasks add column eml_file text
  check (eml_file ~ '^sample-[0-9]+[.]eml$');
insert into storage.buckets (id, name, public, file_size_limit)
values ('task-eml-files','task-eml-files',false,1048576);
create policy task_eml_read on storage.objects for select to authenticated
using (bucket_id = 'task-eml-files' and exists (
  select 1 from public.tasks where eml_file = storage.objects.name
));
commit;
