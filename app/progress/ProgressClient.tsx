'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import ConfirmDialog from '@/components/ConfirmDialog'

export type Subsection = {
  id: number
  name: string
  video_url: string | null
  is_completed: boolean
  created_at: string
}

export type Chapter = {
  id: number
  name: string
  video_url: string | null
  is_completed: boolean
  created_at: string
  subsections: Subsection[]
}

export type Subject = {
  id: number
  name: string
  chapters: Chapter[]
}

export default function ProgressClient({
  userId,
  initialSubjects,
}: {
  userId: string
  initialSubjects: Subject[]
}) {
  const supabase = createClient()
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Record<number, boolean>>({})
  const [addSubjectOpen, setAddSubjectOpen] = useState(false)
  const [newSubject, setNewSubject] = useState('')
  const [editingSubject, setEditingSubject] = useState<number | null>(null)
  const [subjectName, setSubjectName] = useState('')
  const [addChapterFor, setAddChapterFor] = useState<number | null>(null)
  const [chapterName, setChapterName] = useState('')
  const [addSubFor, setAddSubFor] = useState<number | null>(null) // chapterId
  const [subName, setSubName] = useState('')
  const [confirmSubject, setConfirmSubject] = useState<number | null>(null)

  const q = search.trim().toLowerCase()
  const visibleSubjects = subjects.filter((s) =>
    q ? s.name.toLowerCase().includes(q) : true
  )

  const toggleExpand = (id: number) =>
    setExpanded((p) => ({ ...p, [id]: !p[id] }))
  const expand = (id: number) => setExpanded((p) => ({ ...p, [id]: true }))

  const addSubject = async () => {
    const name = newSubject.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('subjects')
      .insert({ user_id: userId, name })
      .select('id, name')
      .single()
    if (!error && data) {
      setSubjects((p) => [...p, { id: data.id, name: data.name, chapters: [] }])
      setNewSubject('')
      setAddSubjectOpen(false)
    }
  }

  const renameSubject = async (id: number) => {
    const name = subjectName.trim()
    if (!name) return
    const { error } = await supabase
      .from('subjects')
      .update({ name })
      .eq('id', id)
    if (!error) {
      setSubjects((p) => p.map((s) => (s.id === id ? { ...s, name } : s)))
    }
    setEditingSubject(null)
  }

  const deleteSubject = async (id: number) => {
    const { error } = await supabase.from('subjects').delete().eq('id', id)
    if (!error) setSubjects((p) => p.filter((s) => s.id !== id))
  }

  const addChapter = async (subjectId: number) => {
    const name = chapterName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('chapters')
      .insert({ user_id: userId, subject_id: subjectId, name })
      .select('id, name, video_url, is_completed, created_at')
      .single()
    if (!error && data) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? { ...s, chapters: [...s.chapters, { ...data, subsections: [] }] }
            : s
        )
      )
    }
    setChapterName('')
    setAddChapterFor(null)
  }

  const updateChapter = async (
    subjectId: number,
    chapterId: number,
    patch: Partial<Chapter>
  ) => {
    const { error } = await supabase
      .from('chapters')
      .update(patch)
      .eq('id', chapterId)
    if (!error) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                chapters: s.chapters.map((c) =>
                  c.id === chapterId ? { ...c, ...patch } : c
                ),
              }
            : s
        )
      )
    }
  }

  const deleteChapter = async (subjectId: number, chapterId: number) => {
    const { error } = await supabase.from('chapters').delete().eq('id', chapterId)
    if (!error) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? { ...s, chapters: s.chapters.filter((c) => c.id !== chapterId) }
            : s
        )
      )
    }
  }

  const addSubsection = async (subjectId: number, chapterId: number) => {
    const name = subName.trim()
    if (!name) return
    const { data, error } = await supabase
      .from('subsections')
      .insert({ user_id: userId, chapter_id: chapterId, name })
      .select('id, name, video_url, is_completed, created_at')
      .single()
    if (!error && data) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                chapters: s.chapters.map((c) =>
                  c.id === chapterId
                    ? { ...c, subsections: [...c.subsections, data] }
                    : c
                ),
              }
            : s
        )
      )
    }
    setSubName('')
    setAddSubFor(null)
  }

  const updateSubsection = async (
    subjectId: number,
    chapterId: number,
    subId: number,
    patch: Partial<Subsection>
  ) => {
    const { error } = await supabase
      .from('subsections')
      .update(patch)
      .eq('id', subId)
    if (!error) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                chapters: s.chapters.map((c) =>
                  c.id === chapterId
                    ? {
                        ...c,
                        subsections: c.subsections.map((x) =>
                          x.id === subId ? { ...x, ...patch } : x
                        ),
                      }
                    : c
                ),
              }
            : s
        )
      )
    }
  }

  const deleteSubsection = async (
    subjectId: number,
    chapterId: number,
    subId: number
  ) => {
    const { error } = await supabase
      .from('subsections')
      .delete()
      .eq('id', subId)
    if (!error) {
      setSubjects((p) =>
        p.map((s) =>
          s.id === subjectId
            ? {
                ...s,
                chapters: s.chapters.map((c) =>
                  c.id === chapterId
                    ? {
                        ...c,
                        subsections: c.subsections.filter((x) => x.id !== subId),
                      }
                    : c
                ),
              }
            : s
        )
      )
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* 顶部：搜索 + 添加科目 */}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索科目…"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <button
          onClick={() => setAddSubjectOpen(true)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          添加科目
        </button>
      </div>

      {visibleSubjects.length === 0 && (
        <p className="rounded-lg bg-white p-6 text-center text-sm text-slate-500">
          {q ? '没有匹配的科目' : '还没有科目，先添加一个吧～'}
        </p>
      )}

      {visibleSubjects.map((s) => {
        const total = s.chapters.length + s.chapters.reduce(
          (n, c) => n + c.subsections.length,
          0
        )
        const done =
          s.chapters.filter((c) => c.is_completed).length +
          s.chapters.reduce(
            (n, c) => n + c.subsections.filter((x) => x.is_completed).length,
            0
          )
        const pct = total ? Math.round((done / total) * 100) : 0
        return (
          <div
            key={s.id}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => toggleExpand(s.id)}
                className="flex items-center gap-2 text-left text-base font-semibold text-slate-800"
              >
                <span className="text-slate-400">
                  {expanded[s.id] ? '▾' : '▸'}
                </span>
                {editingSubject === s.id ? (
                  <input
                    autoFocus
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    onBlur={() => renameSubject(s.id)}
                    onKeyDown={(e) => e.key === 'Enter' && renameSubject(s.id)}
                    className="rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none"
                  />
                ) : (
                  <span>{s.name}</span>
                )}
              </button>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {done}/{total} · {pct}%
                </span>
                <button
                  onClick={() => {
                    setSubjectName(s.name)
                    setEditingSubject(s.id)
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600"
                >
                  重命名
                </button>
                <button
                  onClick={() => {
                    expand(s.id)
                    setAddChapterFor(s.id)
                  }}
                  className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200"
                >
                  + 章节
                </button>
                <button
                  onClick={() => setConfirmSubject(s.id)}
                  className="text-xs text-red-500 hover:underline"
                >
                  删除科目
                </button>
              </div>
            </div>

            {/* 进度条 */}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {expanded[s.id] && (
              <div className="mt-4 space-y-3">
                {addChapterFor === s.id && (
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      value={chapterName}
                      onChange={(e) => setChapterName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && addChapter(s.id)}
                      placeholder="章节名称，如：第一章 函数"
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      onClick={() => addChapter(s.id)}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => {
                        setAddChapterFor(null)
                        setChapterName('')
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                    >
                      取消
                    </button>
                  </div>
                )}

                {s.chapters.length === 0 && (
                  <p className="py-2 text-sm text-slate-400">
                    暂无章节，点「+ 章节」添加
                  </p>
                )}

                {s.chapters.map((c) => (
                  <ChapterRow
                    key={c.id}
                    subjectId={s.id}
                    chapter={c}
                    onToggle={() =>
                      updateChapter(s.id, c.id, {
                        is_completed: !c.is_completed,
                      })
                    }
                    onRename={(name) => updateChapter(s.id, c.id, { name })}
                    onVideo={(video_url) =>
                      updateChapter(s.id, c.id, { video_url })
                    }
                    onDelete={() => deleteChapter(s.id, c.id)}
                    addSubFor={addSubFor}
                    setAddSubFor={setAddSubFor}
                    subName={subName}
                    setSubName={setSubName}
                    onAddSub={() => addSubsection(s.id, c.id)}
                    onToggleSub={(subId, val) =>
                      updateSubsection(s.id, c.id, subId, {
                        is_completed: val,
                      })
                    }
                    onRenameSub={(subId, name) =>
                      updateSubsection(s.id, c.id, subId, { name })
                    }
                    onVideoSub={(subId, video_url) =>
                      updateSubsection(s.id, c.id, subId, { video_url })
                    }
                    onDeleteSub={(subId) =>
                      deleteSubsection(s.id, c.id, subId)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}

      {/* 添加科目弹窗 */}
      {addSubjectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">添加科目</h3>
            <input
              autoFocus
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubject()}
              placeholder="输入科目名称，如：高等数学"
              className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setAddSubjectOpen(false)
                  setNewSubject('')
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={addSubject}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmSubject !== null}
        title="删除科目"
        message="确定删除该科目及其下所有章节、小节吗？此操作不可撤销。"
        onConfirm={() => {
          if (confirmSubject !== null) deleteSubject(confirmSubject)
          setConfirmSubject(null)
        }}
        onCancel={() => setConfirmSubject(null)}
      />
    </div>
  )
}

function ChapterRow({
  subjectId,
  chapter,
  onToggle,
  onRename,
  onVideo,
  onDelete,
  addSubFor,
  setAddSubFor,
  subName,
  setSubName,
  onAddSub,
  onToggleSub,
  onRenameSub,
  onVideoSub,
  onDeleteSub,
}: {
  subjectId: number
  chapter: Chapter
  onToggle: () => void
  onRename: (name: string) => void
  onVideo: (video_url: string | null) => void
  onDelete: () => void
  addSubFor: number | null
  setAddSubFor: (v: number | null) => void
  subName: string
  setSubName: (v: string) => void
  onAddSub: () => void
  onToggleSub: (subId: number, val: boolean) => void
  onRenameSub: (subId: number, name: string) => void
  onVideoSub: (subId: number, video_url: string | null) => void
  onDeleteSub: (subId: number) => void
}) {
  const [editName, setEditName] = useState(false)
  const [nameVal, setNameVal] = useState(chapter.name)
  const [editVideo, setEditVideo] = useState(false)
  const [videoVal, setVideoVal] = useState(chapter.video_url ?? '')
  const [confirm, setConfirm] = useState(false)

  const saveName = () => {
    if (nameVal.trim()) onRename(nameVal.trim())
    setEditName(false)
  }
  const saveVideo = () => {
    onVideo(videoVal.trim() || null)
    setEditVideo(false)
  }

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="checkbox"
          checked={chapter.is_completed}
          onChange={onToggle}
          className="h-4 w-4 accent-green-600"
        />
        {editName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none"
          />
        ) : (
          <span
            className={
              chapter.is_completed
                ? 'flex-1 text-sm text-slate-400 line-through'
                : 'flex-1 text-sm text-slate-800'
            }
          >
            {chapter.name}
          </span>
        )}

        {chapter.video_url && !editVideo && (
          <a
            href={chapter.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            ▶ 视频
          </a>
        )}

        <button
          onClick={() => setEditName((v) => !v)}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          {editName ? '完成' : '重命名'}
        </button>
        <button
          onClick={() => setEditVideo((v) => !v)}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          {editVideo ? '完成' : '链接'}
        </button>
        <button
          onClick={() => setConfirm(true)}
          className="text-xs text-red-500 hover:underline"
        >
          删除
        </button>
      </div>

      {editVideo && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={videoVal}
            onChange={(e) => setVideoVal(e.target.value)}
            placeholder="粘贴教学视频网站链接，如 B 站 / 慕课网"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none"
          />
          <button
            onClick={saveVideo}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      )}

      {/* 小节列表 */}
      <div className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3">
        {chapter.subsections.map((x) => (
          <SubsectionRow
            key={x.id}
            sub={x}
            onToggle={(val) => onToggleSub(x.id, val)}
            onRename={(name) => onRenameSub(x.id, name)}
            onVideo={(v) => onVideoSub(x.id, v)}
            onDelete={() => onDeleteSub(x.id)}
          />
        ))}

        {addSubFor === chapter.id ? (
          <div className="flex gap-2">
            <input
              autoFocus
              value={subName}
              onChange={(e) => setSubName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onAddSub()}
              placeholder="小节名称，如：1.1 极限的定义"
              className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none"
            />
            <button
              onClick={onAddSub}
              className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
            >
              保存
            </button>
            <button
              onClick={() => {
                setAddSubFor(null)
                setSubName('')
              }}
              className="rounded border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              取消
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAddSubFor(chapter.id)}
            className="text-xs text-slate-500 hover:text-blue-600"
          >
            + 小节
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirm}
        message={`确定删除章节「${chapter.name}」吗？其下小节也会一并删除。`}
        onConfirm={() => {
          onDelete()
          setConfirm(false)
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}

function SubsectionRow({
  sub,
  onToggle,
  onRename,
  onVideo,
  onDelete,
}: {
  sub: Subsection
  onToggle: (val: boolean) => void
  onRename: (name: string) => void
  onVideo: (video_url: string | null) => void
  onDelete: () => void
}) {
  const [editName, setEditName] = useState(false)
  const [nameVal, setNameVal] = useState(sub.name)
  const [editVideo, setEditVideo] = useState(false)
  const [videoVal, setVideoVal] = useState(sub.video_url ?? '')
  const [confirm, setConfirm] = useState(false)

  const saveName = () => {
    if (nameVal.trim()) onRename(nameVal.trim())
    setEditName(false)
  }
  const saveVideo = () => {
    onVideo(videoVal.trim() || null)
    setEditVideo(false)
  }

  return (
    <div className="rounded border border-slate-100 bg-white p-2">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="checkbox"
          checked={sub.is_completed}
          onChange={(e) => onToggle(e.target.checked)}
          className="h-3.5 w-3.5 accent-green-600"
        />
        {editName ? (
          <input
            autoFocus
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="flex-1 rounded border border-slate-300 px-2 py-0.5 text-sm focus:outline-none"
          />
        ) : (
          <span
            className={
              sub.is_completed
                ? 'flex-1 text-sm text-slate-400 line-through'
                : 'flex-1 text-sm text-slate-700'
            }
          >
            {sub.name}
          </span>
        )}
        {sub.video_url && !editVideo && (
          <a
            href={sub.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            ▶ 视频
          </a>
        )}
        <button
          onClick={() => setEditName((v) => !v)}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          {editName ? '完成' : '重命名'}
        </button>
        <button
          onClick={() => setEditVideo((v) => !v)}
          className="text-xs text-slate-500 hover:text-blue-600"
        >
          {editVideo ? '完成' : '链接'}
        </button>
        <button
          onClick={() => setConfirm(true)}
          className="text-xs text-red-500 hover:underline"
        >
          删除
        </button>
      </div>
      {editVideo && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={videoVal}
            onChange={(e) => setVideoVal(e.target.value)}
            placeholder="粘贴教学视频网站链接，如 B 站 / 慕课网"
            className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:outline-none"
          />
          <button
            onClick={saveVideo}
            className="rounded bg-blue-600 px-3 py-1 text-xs text-white hover:bg-blue-700"
          >
            保存
          </button>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        message={`确定删除小节「${sub.name}」吗？`}
        onConfirm={() => {
          onDelete()
          setConfirm(false)
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  )
}
