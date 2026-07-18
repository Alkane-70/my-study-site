-- ============================================================
-- Study site · 最终版 Supabase 配置（幂等，可重复执行）
-- 在 Supabase 控制台 → SQL Editor 里整段执行。
--
-- ⚠️ 关于存储桶：下面的 SQL 会尝试用 SQL 建桶；
--    如果你的 Supabase 版本禁止 SQL 建桶（报错 permission denied），
--    请忽略那几行报错，改到 Storage → New bucket 手动建 3 个桶：
--      materials（Public 公开）
--      avatars  （Public 公开）
--      note-images（Public 公开）
--    桶建好后再执行本文件剩余部分即可。
-- ============================================================

-- ---------- 0. 建存储桶（public） ----------
insert into storage.buckets (id, name, public)
values
  ('materials',   'materials',   true),
  ('avatars',     'avatars',     true),
  ('note-images', 'note-images', true)
on conflict (id) do update set public = true;

-- ---------- 1. 表级 RLS ----------
alter table public.subjects     enable row level security;
alter table public.chapters     enable row level security;
alter table public.notes        enable row level security;
alter table public.materials    enable row level security;
alter table public.profiles     enable row level security;
alter table public.subsections  enable row level security;

-- 删除旧策略（兼容之前两次脚本的不同命名，全部 drop 再重建）
drop policy if exists "own subjects"    on public.subjects;
drop policy if exists "own chapters"    on public.chapters;
drop policy if exists "own notes"       on public.notes;
drop policy if exists "own materials"   on public.materials;
drop policy if exists "own profile"     on public.profiles;
drop policy if exists "profiles own select" on public.profiles;
drop policy if exists "profiles own insert" on public.profiles;
drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "subsections own select" on public.subsections;
drop policy if exists "subsections own insert" on public.subsections;
drop policy if exists "subsections own update" on public.subsections;
drop policy if exists "subsections own delete" on public.subsections;

-- 重建表策略（本人只能操作自己的数据）
create policy "subjects_all"  on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "chapters_all"  on public.chapters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_all"     on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "materials_all" on public.materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_all"  on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subsections_all" on public.subsections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 2. Storage 策略（三桶一套） ----------
do $$
declare
  b text;
begin
  foreach b in array array['materials','avatars','note-images']
  loop
    execute format('drop policy if exists "%s_read"   on storage.objects;', b);
    execute format('drop policy if exists "%s_insert" on storage.objects;', b);
    execute format('drop policy if exists "%s_update" on storage.objects;', b);
    execute format('drop policy if exists "%s_delete" on storage.objects;', b);
    execute format('drop policy if exists "%s own insert" on storage.objects;', b);
    execute format('drop policy if exists "%s own select" on storage.objects;', b);
    execute format('drop policy if exists "%s own update" on storage.objects;', b);
    execute format('drop policy if exists "%s own delete" on storage.objects;', b);

    -- 公开读
    execute format(
      'create policy "%s_read" on storage.objects for select using (bucket_id = %L);', b, b);
    -- 本人写：路径首段必须是自己的 user_id
    execute format(
      'create policy "%s_insert" on storage.objects for insert to authenticated
         with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);', b, b);
    execute format(
      'create policy "%s_update" on storage.objects for update to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text)
         with check (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);', b, b, b);
    execute format(
      'create policy "%s_delete" on storage.objects for delete to authenticated
         using (bucket_id = %L and (storage.foldername(name))[1] = auth.uid()::text);', b, b);
  end loop;
end $$;

-- ---------- 3. 确认 notes 表有新增字段 ----------
alter table public.notes add column if not exists chapter_id    bigint references public.chapters(id)    on delete set null;
alter table public.notes add column if not exists subsection_id bigint references public.subsections(id) on delete set null;
alter table public.notes add column if not exists images       text[];
