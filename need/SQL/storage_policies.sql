-- =============================================
--  学习助手 - 存储桶与权限设置
-- =============================================

-- 创建头像存储桶（公开访问）
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;   -- 如果已经存在则跳过

-- 允许登录用户上传头像（只能上传到 avatars 桶，且文件属于自己）
CREATE POLICY "Allow avatar upload for authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid() = owner);

-- 允许公开读取头像
CREATE POLICY "Allow public read of avatars"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');


-- 创建资料存储桶
INSERT INTO storage.buckets (id, name, public)
VALUES ('materials', 'materials', true)
ON CONFLICT (id) DO NOTHING;

-- 允许登录用户上传学习资料
CREATE POLICY "Allow materials upload for authenticated users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'materials' AND auth.uid() = owner);

-- 允许用户读取自己上传的资料（如果你希望所有登录用户都能读取，可以把 AND auth.uid() = owner 去掉）
CREATE POLICY "Allow read own materials"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'materials' AND auth.uid() = owner);