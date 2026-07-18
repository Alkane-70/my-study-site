import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import NotesClient, { type Note, type SubjectLite } from './NotesClient'

export default async function NotesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 科目列表
  const { data: subjects } = await supabase
    .from('subjects')
    .select('id, name')
    .order('created_at', { ascending: true })

  // 当前用户所有笔记（用于跨科目搜索）
  const { data: notes } = await supabase
    .from('notes')
    .select(
      'id, subject_id, chapter_id, subsection_id, title, content, images, created_at, updated_at'
    )
    .order('updated_at', { ascending: false })

  const initialSubjects: SubjectLite[] = subjects ?? []
  const initialNotes: Note[] = notes ?? []

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">科目笔记</h1>
        <p className="mt-1 text-sm text-slate-500">
          按科目整理笔记，支持图片、关联章节小节，以及全文搜索。
        </p>
        <NotesClient subjects={initialSubjects} notes={initialNotes} />
      </div>
    </main>
  )
}
