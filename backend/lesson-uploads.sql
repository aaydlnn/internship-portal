begin;
alter table public.site_details
  add column material_file_path text,
  add column material_file_name text,
  add constraint lesson_material_file check (
    (material_file_path is null and material_file_name is null) or
    (section like 'lesson-%' and material_url = '' and material_file_path is not null
      and material_file_path ~ '^[0-9a-f-]{36}\.(pdf|pptx?|html)$'
      and material_file_name is not null and char_length(material_file_name) between 1 and 255)
  );
grant update (material_file_path, material_file_name) on public.site_details to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('lesson-materials','lesson-materials',false,20971520,array[
  'application/pdf','application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint','text/html'
]);
create policy lesson_material_upload on storage.objects for insert to authenticated
with check (bucket_id = 'lesson-materials' and name ~ '^[0-9a-f-]{36}\.(pdf|pptx?|html)$'
  and exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor'));
create policy lesson_material_read on storage.objects for select to authenticated
using (bucket_id = 'lesson-materials' and (
  exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor')
  or exists (select 1 from public.site_details where material_file_path = name and not material_hidden)
));
create policy lesson_material_cleanup on storage.objects for delete to authenticated
using (bucket_id = 'lesson-materials'
  and exists (select 1 from public.members where id = (select auth.uid()) and role = 'mentor')
  and not exists (select 1 from public.site_details where material_file_path = name));
commit;
