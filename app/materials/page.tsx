import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import MaterialsClient, { type Material } from './MaterialsClient'

// 查询兜底：最多等 8 秒，避免 Supabase 异常时页面永远停在 loading 骨架
async function withTimeout<T>(p: PromiseLike<T>, ms = 8000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export default async function MaterialsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const result = await withTimeout(
    supabase
      .from('materials')
      .select('id, subject_id, folder_path, file_name, file_url, file_size, created_at')
      .order('created_at', { ascending: false })
  )

  const materials = result?.data ?? null
  const error = result?.error ?? null

  if (error) {
    console.error('[materials] 查询失败：', error.message)
  }

  const initialMaterials: Material[] = materials ?? []

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">资料库</h1>
        <p className="mt-1 text-sm text-slate-500">
          按文件夹管理学习资料，支持上传、下载与搜索。
        </p>
        <MaterialsClient userId={user.id} initialMaterials={initialMaterials} />
      </div>
    </main>
  )
}
