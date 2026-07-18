import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ProgressClient, { type Subject } from './ProgressClient'

export default async function ProgressPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 未登录 -> 跳转到登录页（middleware 也会兜底保护）
  if (!user) {
    redirect('/login')
  }

  // 服务端获取初始数据：科目 + 嵌套章节 + 嵌套小节
  const { data: subjects } = await supabase
    .from('subjects')
    .select(
      `id, name, chapters(
        id, name, video_url, is_completed, created_at,
        subsections(id, name, video_url, is_completed, created_at)
      )`
    )
    .order('created_at', { ascending: true })

  const initialSubjects: Subject[] = (subjects ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    chapters: (s.chapters ?? []).sort(
      (a: any, b: any) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ).map((c: any) => ({
      ...c,
      subsections: (c.subsections ?? []).sort(
        (a: any, b: any) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      ),
    })),
  }))

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">学习进度</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理你的科目、章节与小节，勾选已完成即可自动计算进度。
        </p>
        <ProgressClient userId={user.id} initialSubjects={initialSubjects} />
      </div>
    </main>
  )
}
