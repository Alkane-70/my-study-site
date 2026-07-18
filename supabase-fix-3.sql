-- ============================================================
-- Study site · 修复 profiles 表（昵称 / 头像保存失败）
-- 在 Supabase 控制台 → SQL Editor 整段执行一次。
-- 本脚本幂等、可重复执行。
-- ============================================================

-- 1) 确保 profiles 表有 username / avatar_url 两列
--    （若之前用 SQL 加过列但缓存没刷新，这里也会补齐）
alter table public.profiles add column if not exists username    text;
alter table public.profiles add column if not exists avatar_url  text;

-- 2) 修正外键：profiles.user_id 必须引用 auth.users(id)
--    先删除可能指向错误父表（或错误列）的旧外键，再重建正确外键。
--    ⚠️ 若执行此处报错 “violates foreign key constraint / 无法删除”，
--      说明现有数据里有 user_id 不在 auth.users 中的脏数据，
--      可临时执行： delete from public.profiles where user_id not in (select id from auth.users);
--      然后再跑这两行。
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles
  add constraint profiles_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- 3) 确保 user_id 有唯一约束（代码里 upsert 用 onConflict:'user_id' 需要它）
alter table public.profiles drop constraint if exists profiles_user_id_key;
alter table public.profiles
  add constraint profiles_user_id_key unique (user_id);

-- 4) 刷新 PostgREST 的 schema 缓存（关键！否则仍报“找不到 username 列”）
--    执行后若还报同样的错，再到 Supabase 控制台：
--    Database → PostgREST → 点 “Reload schema cache” 按钮手动刷新一次。
select pg_notify('pgrst', 'reload schema');
