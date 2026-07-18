-- ============================================================
-- Study site 第二轮改动所需的 Supabase 操作
-- 在 Supabase 控制台的 SQL Editor 里整段执行即可
-- ============================================================

-- ------------------------------------------------------------
-- 1) 新增「小节」表 subsections（挂在章节 chapter 下）
-- ------------------------------------------------------------
create table if not exists public.subsections (
  id           bigserial primary key,
  user_id      uuid        not null references auth.users(id) on delete cascade,
  chapter_id   bigint      not null references public.chapters(id) on delete cascade,
  name         text        not null,
  video_url    text,
  is_completed boolean     not null default false,
  created_at   timestamptz not null default now()
);
alter table public.subsections enable row level security;

drop policy if exists "subsections own select" on public.subsections;
drop policy if exists "subsections own insert" on public.subsections;
drop policy if exists "subsections own update" on public.subsections;
drop policy if exists "subsections own delete" on public.subsections;

create policy "subsections own select" on public.subsections
  for select using (auth.uid() = user_id);
create policy "subsections own insert" on public.subsections
  for insert with check (auth.uid() = user_id);
create policy "subsections own update" on public.subsections
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "subsections own delete" on public.subsections
  for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 2) notes 表增加字段：关联章节/小节 + 图片
-- ------------------------------------------------------------
alter table public.notes add column if not exists chapter_id   bigint references public.chapters(id)    on delete set null;
alter table public.notes add column if not exists subsection_id bigint references public.subsections(id) on delete set null;
alter table public.notes add column if not exists images       text[];

-- ------------------------------------------------------------
-- 3) 修复「昵称保存失败」：给 profiles 补一条 UPDATE 策略
--    （之前只开了 select/insert，没有 update，所以保存昵称被 RLS 拦掉）
-- ------------------------------------------------------------
drop policy if exists "profiles own update" on public.profiles;
create policy "profiles own update" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 顺手确保 select / insert 也在（如果之前漏了）
drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles
  for select using (auth.uid() = user_id);
drop policy if exists "profiles own insert" on public.profiles;
create policy "profiles own insert" on public.profiles
  for insert with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4) 笔记图片存储桶 note-images（公开桶）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do update set public = true;

drop policy if exists "note-images own insert" on storage.objects;
drop policy if exists "note-images own select" on storage.objects;
drop policy if exists "note-images own update" on storage.objects;
drop policy if exists "note-images own delete" on storage.objects;

create policy "note-images own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note-images own select" on storage.objects
  for select to authenticated
  using (bucket_id = 'note-images');
create policy "note-images own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note-images own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'note-images' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------
-- 5) 若之前还没建 materials / avatars 桶，这里一并补齐
--    （资料库上传、头像上传都依赖这两个公开桶 + 策略）
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('materials', 'materials', true), ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists "materials own insert" on storage.objects;
drop policy if exists "materials own select" on storage.objects;
drop policy if exists "materials own update" on storage.objects;
drop policy if exists "materials own delete" on storage.objects;
create policy "materials own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials own select" on storage.objects
  for select to authenticated using (bucket_id = 'materials');
create policy "materials own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "materials own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'materials' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own select" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars own insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own select" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');
create policy "avatars own update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
