-- ============================================================
-- Study site · Supabase 策略与存储桶配置
-- 在 Supabase 控制台的 SQL Editor 里一次性执行本文件即可。
-- 注意：Storage 桶（materials / avatars）需先在
--       Storage → New bucket 里手动创建（设为 Public 公开桶），
--       SQL 无法直接建桶。
-- ============================================================

-- ---------- 1. 表级 RLS（每张表只让本人操作自己的行） ----------
alter table public.subjects    enable row level security;
alter table public.chapters    enable row level security;
alter table public.notes       enable row level security;
alter table public.materials   enable row level security;
alter table public.profiles    enable row level security;

create policy "own subjects"  on public.subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own chapters"  on public.chapters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes"     on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own materials" on public.materials
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own profile"   on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- 2. Storage 策略（materials 桶） ----------
-- 读取公开（公开桶本就公开可读，这里再明确一次）
create policy "materials read"
  on storage.objects for select
  using (bucket_id = 'materials');

-- 写入：仅本人，且文件路径第一段必须是自己的 user_id
create policy "materials insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 删除：仅本人
create policy "materials delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'materials'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------- 3. Storage 策略（avatars 桶） ----------
create policy "avatars read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
