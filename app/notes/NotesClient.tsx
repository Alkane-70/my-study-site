'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import ConfirmDialog from '@/components/ConfirmDialog'

export type Note = {
  id: number
  subject_id: number | null
  chapter_id: number | null
  subsection_id: number | null
  title: string
  content: string | null
  images: string[] | null
  created_at: string
  updated_at: string
}

export type SubjectLite = {
  id: number
  name: string
}

type ChapterOpt = {
  id: number
  name: string
  subsections: { id: number; name: string }[]
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`
}

// 给公开 URL 加时间戳，避免浏览器/CDN 缓存导致新图片不刷新
function bust(url: string) {
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
}

export default function NotesClient({
  subjects,
  notes,
}: {
  subjects: SubjectLite[]
  notes: Note[]
}) {
  const supabase = createClient()
  const [subjectMap] = useState<Record<number, string>>(
    Object.fromEntries(subjects.map((s) => [s.id, s.name]))
  )
  const [allNotes, setAllNotes] = useState<Note[]>(notes)
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(
    subjects[0]?.id ?? null
  )
  const [search, setSearch] = useState('')

  // 章节 / 小节结构（用于关联下拉）
  const [chMap, setChMap] = useState<Record<number, ChapterOpt[]>>({})
  useEffect(() => {
    supabase
      .from('chapters')
      .select('id, name, subject_id, subsections(id, name)')
      .then(({ data }) => {
        const map: Record<number, ChapterOpt[]> = {}
        ;(data ?? []).forEach((c: any) => {
          ;(map[c.subject_id] ||= []).push({
            id: c.id,
            name: c.name,
            subsections: c.subsections ?? [],
          })
        })
        setChMap(map)
      })
  }, [supabase])

  // 新建 / 编辑
  const [editing, setEditing] = useState<Note | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [selSubjectId, setSelSubjectId] = useState<number | null>(null)
  const [selChapterId, setSelChapterId] = useState<number | null>(null)
  const [selSubId, setSelSubId] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Note | null>(null)
  const [zoom, setZoom] = useState<string | null>(null)
  const [zoomScale, setZoomScale] = useState(1)
  // 图片预览的平移偏移（放大后可拖动）
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{
    active: boolean
    sx: number
    sy: number
    bx: number
    by: number
  }>({ active: false, sx: 0, sy: 0, bx: 0, by: 0 })
  const imgRef = useRef<HTMLInputElement>(null)

  const q = search.trim().toLowerCase()
  const visibleNotes = useMemo(() => {
    if (q) {
      return allNotes.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.content ?? '').toLowerCase().includes(q)
      )
    }
    return allNotes.filter((n) => n.subject_id === selectedSubjectId)
  }, [allNotes, q, selectedSubjectId])

  const resetEditor = () => {
    setTitle('')
    setContent('')
    setImages([])
    setSelSubjectId(selectedSubjectId)
    setSelChapterId(null)
    setSelSubId(null)
  }

  const openNew = () => {
    setEditing(null)
    resetEditor()
    setShowNew(true)
  }

  const openEdit = (note: Note) => {
    setEditing(note)
    setTitle(note.title)
    setContent(note.content ?? '')
    setImages(note.images ?? [])
    setSelSubjectId(note.subject_id)
    setSelChapterId(note.chapter_id)
    setSelSubId(note.subsection_id)
    setShowNew(false)
  }

  const uploadImage = async (file: File): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null
    const folder = editing ? `notes/${editing.id}` : 'notes/temp'
    const path = `${user.id}/${folder}/${Date.now()}_${file.name}`
    const { error } = await supabase.storage
      .from('note-images')
      .upload(path, file)
    if (error) {
      alert('图片上传失败：' + error.message)
      return null
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('note-images').getPublicUrl(path)
    return publicUrl
  }

  const onPickImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setUploading(true)
    const urls = await Promise.all(files.map(uploadImage))
    setImages((prev) => [...prev, ...urls.filter(Boolean) as string[]])
    setUploading(false)
    if (imgRef.current) imgRef.current.value = ''
  }

  const save = async () => {
    const t = title.trim()
    if (!t) return
    const payload = {
      title: t,
      content,
      images,
      chapter_id: selChapterId,
      subsection_id: selSubId,
      subject_id: selSubjectId,
    }
    if (editing) {
      const { data, error } = await supabase
        .from('notes')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editing.id)
        .select()
        .single()
      if (!error && data) {
        setAllNotes((p) => p.map((n) => (n.id === editing.id ? data : n)))
      } else if (error) {
        alert('保存失败：' + error.message)
      }
      setEditing(null)
    } else {
      if (!selSubjectId) return
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: (await supabase.auth.getUser()).data.user!.id,
          ...payload,
        })
        .select()
        .single()
      if (!error && data) {
        setAllNotes((p) => [data, ...p])
      } else if (error) {
        alert('保存失败：' + error.message)
      }
      setShowNew(false)
    }
    resetEditor()
  }

  const remove = async () => {
    if (!confirmDelete) return
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', confirmDelete.id)
    if (!error) {
      setAllNotes((p) => p.filter((n) => n.id !== confirmDelete.id))
    } else {
      alert('删除失败：' + error.message)
    }
    setConfirmDelete(null)
  }

  // 关联名称展示
  const assocLabel = (n: Note) => {
    const parts: string[] = []
    if (n.chapter_id && chMap[n.subject_id ?? -1]) {
      const ch = chMap[n.subject_id ?? -1].find((c) => c.id === n.chapter_id)
      if (ch) parts.push(ch.name)
      if (n.subsection_id && ch) {
        const sub = ch.subsections.find((s) => s.id === n.subsection_id)
        if (sub) parts.push(sub.name)
      }
    }
    return parts.length ? `关联：${parts.join(' / ')}` : ''
  }

  const subjectChapters = selSubjectId ? chMap[selSubjectId] ?? [] : []
  const chapterSubs =
    selChapterId && subjectChapters.length
      ? subjectChapters.find((c) => c.id === selChapterId)?.subsections ?? []
      : []

  const NoteImage = ({
    src,
    className,
  }: {
    src: string
    className?: string
  }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      onClick={() => {
        setZoomScale(1)
        setPan({ x: 0, y: 0 })
        setZoom(src)
      }}
      className={`cursor-zoom-in ${className ?? ''}`}
      title="点击放大"
    />
  )

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      {/* 左侧科目列表 */}
      <aside className="rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="px-2 py-1 text-xs font-semibold uppercase text-slate-400">
          科目
        </h2>
        <ul className="space-y-1">
          {subjects.length === 0 && (
            <li className="px-2 py-1 text-sm text-slate-400">暂无科目</li>
          )}
          {subjects.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => {
                  setSelectedSubjectId(s.id)
                  setSearch('')
                }}
                className={
                  selectedSubjectId === s.id && !q
                    ? 'w-full rounded-lg bg-blue-50 px-2 py-1.5 text-left text-sm font-medium text-blue-700'
                    : 'w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100'
                }
              >
                {s.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* 右侧笔记区 */}
      <section className="space-y-4">
        {/* 搜索 + 新建 */}
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索笔记标题或内容…"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={openNew}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            新建笔记
          </button>
        </div>

        {(showNew || editing) && (
          <div className="space-y-3 rounded-xl border border-blue-200 bg-white p-4">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="笔记标题"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="笔记内容…"
              rows={6}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />

            {/* 关联科目 / 章节 / 小节 */}
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <select
                value={selSubjectId ?? ''}
                onChange={(e) => {
                  setSelSubjectId(Number(e.target.value) || null)
                  setSelChapterId(null)
                  setSelSubId(null)
                }}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
              >
                <option value="">选择科目</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={selChapterId ?? ''}
                onChange={(e) => {
                  setSelChapterId(Number(e.target.value) || null)
                  setSelSubId(null)
                }}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
              >
                <option value="">关联章节（可选）</option>
                {subjectChapters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={selSubId ?? ''}
                onChange={(e) => setSelSubId(Number(e.target.value) || null)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
              >
                <option value="">关联小节（可选）</option>
                {chapterSubs.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 图片 */}
            <div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => imgRef.current?.click()}
                  className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
                >
                  {uploading ? '上传中…' : '添加图片'}
                </button>
                <input
                  ref={imgRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={onPickImages}
                />
                <span className="text-xs text-slate-400">
                  图片会存入笔记图片桶
                </span>
              </div>
              {images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {images.map((src, i) => (
                    <div key={i} className="relative">
                      <NoteImage
                        src={src}
                        className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setImages((prev) => prev.filter((_, j) => j !== i))
                        }
                        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowNew(false)
                  setEditing(null)
                  resetEditor()
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={save}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                {editing ? '保存修改' : '保存'}
              </button>
            </div>
          </div>
        )}

        {/* 笔记列表 */}
        <ul className="space-y-2">
          {visibleNotes.length === 0 && (
            <li className="rounded-lg bg-white p-6 text-center text-sm text-slate-400">
              {q ? '没有匹配的笔记' : '该科目下还没有笔记'}
            </li>
          )}
          {visibleNotes.map((n) => (
            <li
              key={n.id}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-slate-800">{n.title}</h3>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDate(n.updated_at)}
                    {q && n.subject_id && subjectMap[n.subject_id]
                      ? ` · ${subjectMap[n.subject_id]}`
                      : ''}
                  </p>
                  {n.content && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                      {n.content}
                    </p>
                  )}
                  {n.images && n.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {n.images.map((src, i) => (
                        <NoteImage
                          key={i}
                          src={src}
                          className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
                        />
                      ))}
                    </div>
                  )}
                  {assocLabel(n) && (
                    <p className="mt-2 text-xs text-blue-600">{assocLabel(n)}</p>
                  )}
                </div>
                <div className="flex shrink-0 gap-3">
                  <button
                    onClick={() => openEdit(n)}
                    className="text-xs text-slate-500 hover:text-blue-600"
                  >
                    编辑
                  </button>
                  <button
                    onClick={() => setConfirmDelete(n)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    删除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ConfirmDialog
        open={confirmDelete !== null}
        message={`确定删除笔记「${confirmDelete?.title}」吗？此操作不可撤销。`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />

      {/* 图片放大查看（工具条/关闭按钮在图外层，图放进可裁剪视口，放大后可拖动） */}
      {zoom !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setZoom(null)}
        >
          <div
            className="relative flex max-h-[92vh] max-w-[92vw] flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 放大 / 缩小 工具条（永远在图片上方，不会被图遮挡） */}
            <div className="mb-2 flex items-center gap-2 rounded-full bg-white/95 px-2 py-1 shadow-lg">
              <button
                onClick={() =>
                  setZoomScale((s) => {
                    const next = Math.max(0.25, +(s - 0.25).toFixed(2))
                    if (next <= 1) setPan({ x: 0, y: 0 }) // 缩回 100% 及以内时回正
                    return next
                  })
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-slate-700 hover:bg-slate-200"
                title="缩小"
              >
                −
              </button>
              <span className="min-w-[3.5rem] text-center text-sm tabular-nums text-slate-700">
                {Math.round(zoomScale * 100)}%
              </span>
              <button
                onClick={() =>
                  setZoomScale((s) => {
                    const next = Math.min(3, +(s + 0.25).toFixed(2))
                    if (next <= 1) setPan({ x: 0, y: 0 }) // 缩回 100% 及以内时回正
                    return next
                  })
                }
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-semibold text-slate-700 hover:bg-slate-200"
                title="放大"
              >
                +
              </button>
            </div>

            {/* 图片视口：固定尺寸 + 溢出裁剪，放大后图片在其中可被拖动 */}
            <div className="relative flex max-h-[75vh] max-w-[88vw] items-center justify-center overflow-hidden rounded-lg">
              {/* 右上角关闭按钮（位于视口右上角，始终可点） */}
              <button
                onClick={() => setZoom(null)}
                aria-label="关闭预览"
                className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-xl leading-none text-slate-700 shadow-lg hover:bg-white"
              >
                ×
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bust(zoom)}
                alt=""
                draggable={false}
                onPointerDown={(e) => {
                  if (zoomScale <= 1) return
                  dragRef.current = {
                    active: true,
                    sx: e.clientX,
                    sy: e.clientY,
                    bx: pan.x,
                    by: pan.y,
                  }
                  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
                }}
                onPointerMove={(e) => {
                  if (!dragRef.current.active) return
                  setPan({
                    x: dragRef.current.bx + (e.clientX - dragRef.current.sx),
                    y: dragRef.current.by + (e.clientY - dragRef.current.sy),
                  })
                }}
                onPointerUp={() => {
                  dragRef.current.active = false
                }}
                onPointerCancel={() => {
                  dragRef.current.active = false
                }}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomScale})`,
                  transition: dragRef.current.active ? 'none' : 'transform 0.15s ease',
                  cursor: zoomScale > 1 ? 'grab' : 'default',
                  touchAction: 'none',
                }}
                className="max-h-[75vh] w-auto select-none rounded-lg object-contain shadow-xl"
              />
            </div>

            <p className="mt-2 text-xs text-white/70">
              {zoomScale > 1 ? '放大后可拖动图片查看细节' : '点击图片放大，点外部或 × 关闭'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
