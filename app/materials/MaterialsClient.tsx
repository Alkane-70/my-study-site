'use client'

import { useMemo, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import ConfirmDialog from '@/components/ConfirmDialog'
import Modal from '@/components/Modal'

export type Material = {
  id: number
  subject_id: number | null
  folder_path: string
  file_name: string
  file_url: string
  file_size: number | null
  created_at: string
}

type FolderNode = {
  path: string
  name: string
  children: FolderNode[]
}

// 规范化路径：合并连续斜杠、去掉末尾斜杠，但【保留一个首斜杠】，
// 根目录统一为 '/'。否则 DB 里存的 folder_path 会丢失首斜杠，
// 与左侧树节点路径（带首斜杠）对不上，导致文件“上传了却找不到”、文件夹“删不掉”。
function norm(p: string) {
  const s = ('/' + p).replace(/\/+/g, '/').replace(/\/+$/, '')
  return s === '' ? '/' : s
}

function buildTree(paths: string[]): FolderNode {
  const root: FolderNode = { path: '/', name: '全部文件', children: [] }
  for (const raw of paths) {
    const p = raw || '/'
    if (p === '/') continue
    const parts = p.split('/').filter(Boolean)
    let node = root
    let cur = '/'
    for (const seg of parts) {
      const childPath = (cur === '/' ? '' : cur) + '/' + seg
      let child = node.children.find((c) => c.path === childPath)
      if (!child) {
        child = { path: childPath, name: seg, children: [] }
        node.children.push(child)
      }
      node = child
      cur = childPath
    }
  }
  return root
}

function formatSize(bytes: number | null) {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function parentOf(p: string) {
  if (p === '/') return '/'
  const idx = p.lastIndexOf('/')
  return idx <= 0 ? '/' : p.slice(0, idx)
}

export default function MaterialsClient({
  userId,
  initialMaterials,
}: {
  userId: string
  initialMaterials: Material[]
}) {
  const supabase = createClient()
  const [materials, setMaterials] = useState<Material[]>(initialMaterials)
  const [selectedFolder, setSelectedFolder] = useState('/')
  const [search, setSearch] = useState('')
  const [extraFolders, setExtraFolders] = useState<string[]>([])
  const [confirmDelete, setConfirmDelete] = useState<Material | null>(null)
  const [confirmFolder, setConfirmFolder] = useState<string | null>(null)
  // 删除文件夹时：是否将文件夹内的文件移动到上一级（默认 false = 连同文件一起删除）
  const [moveToParent, setMoveToParent] = useState(false)

  // 新建文件夹弹窗
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')

  // 上传
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pending, setPending] = useState<{ file: File; relPath: string }[]>([])
  const [uploadTarget, setUploadTarget] = useState('/')
  const [uploading, setUploading] = useState(false)
  const [failed, setFailed] = useState<{ name: string; error: string }[]>([])

  // 移动 / 复制
  const [moveFile, setMoveFile] = useState<Material | null>(null)
  const [copyMode, setCopyMode] = useState(false)
  const [moveTarget, setMoveTarget] = useState('/')

  // 文件夹树折叠状态（path -> 是否展开）
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ '/': true })

  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const allFolderPaths = useMemo(() => {
    const set = new Set<string>(materials.map((m) => m.folder_path || '/'))
    extraFolders.forEach((f) => set.add(f))
    return Array.from(set)
  }, [materials, extraFolders])

  const tree = useMemo(() => buildTree(allFolderPaths), [allFolderPaths])

  const q = search.trim().toLowerCase()
  // 比较时忽略首斜杠差异：兼容“修复首斜杠前”存进库的旧数据（folder_path 无首斜杠）
  const selNorm = selectedFolder.replace(/^\/+/, '')
  const visibleFiles = useMemo(() => {
    return materials.filter(
      (m) =>
        (m.folder_path || '').replace(/^\/+/, '') === selNorm &&
        (!q || m.file_name.toLowerCase().includes(q))
    )
  }, [materials, selectedFolder, q])

  // ---- 新建文件夹（弹窗） ----
  const openNewFolder = () => {
    setNewFolderName('')
    setNewFolderOpen(true)
  }
  const confirmNewFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    const base = selectedFolder === '/' ? '' : selectedFolder
    const path = norm(`${base}/${name}`)
    setExtraFolders((p) => (p.includes(path) ? p : [...p, path]))
    setExpanded((e) => ({ ...e, [selectedFolder]: true, [path]: true }))
    setNewFolderOpen(false)
  }

  // ---- 上传 ----
  const pickFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []).map((f) => ({
      file: f,
      relPath: f.name,
    }))
    setPending((p) => [...p, ...arr])
    if (fileRef.current) fileRef.current.value = ''
  }
  const pickFolder = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = Array.from(e.target.files ?? []).map((f) => ({
      file: f,
      relPath: (f as any).webkitRelativePath || f.name,
    }))
    setPending((p) => [...p, ...arr])
    if (folderRef.current) folderRef.current.value = ''
  }

  // 生成安全的存储文件名：只保留 ASCII（字母/数字/点/下划线/连字符），
  // 把中文与所有特殊字符都替换成 _。Storage key 必须是 ASCII，否则报 Invalid key。
  // 原始中文名仍存在数据库 file_name 字段，展示与下载时不受影响。
  function safeName(name: string) {
    const m = name.match(/\.[^.]+$/)
    const ext = m ? m[0] : ''
    const base = m ? name.slice(0, -ext.length) : name
    const clean = base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 40)
    return (clean || 'file') + ext
  }

  // 生成 ASCII 唯一串，作为 Storage key 前缀（避免中文/特殊字符触发 Invalid key）
  function uid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return (
      Math.random().toString(36).slice(2) + Date.now().toString(36)
    )
  }

  const confirmUpload = async () => {
    setUploading(true)
    const errs: { name: string; error: string }[] = []
    const touchedFolders = new Set<string>()
    // 从上传目标到每个文件所在目录的【每一层】路径，保证嵌套文件夹逐级登记+展开，
    // 不依赖 insert 是否取回数据（RLS 可能取不回），也不漏中间层。
    const plannedFolders = new Set<string>()
    for (const item of pending) {
      // 拆出“相对目录”与“文件名”（文件夹上传会带层级）
      const relPath = item.relPath
      let relDir = ''
      let fileName = relPath
      if (relPath.includes('/')) {
        const parts = relPath.split('/').filter(Boolean)
        fileName = parts[parts.length - 1]
        relDir = parts.slice(0, -1).join('/')
      }
      const seg = uploadTarget === '/' ? '' : uploadTarget
      const folderPath = norm(`${seg}/${relDir}`) // 存进 DB 的 folder_path（可含中文，仅用于归类/展示）
      // 登记从根到该目录的每一层（如 /我的资料、/我的资料/外层、/我的资料/外层/内层）
      {
        const levels = folderPath.split('/').filter(Boolean)
        let acc = ''
        for (const p of levels) {
          acc += '/' + p
          plannedFolders.add(acc)
        }
      }
      // ⚠️ 关键修复：Storage 的 key 必须是 ASCII，否则报 “Invalid key”。
      // 因此存储路径用 UUID 生成，与文件夹名完全解耦；文件夹名只存数据库。
      // 这样无论文件夹/文件名是中文还是带特殊字符，都不会再触发 Invalid key。
      const uniqueKey = `${userId}/${uid()}__${safeName(fileName)}`
      try {
        const { error: upErr } = await supabase.storage
          .from('materials')
          .upload(uniqueKey, item.file, { upsert: true })
        if (upErr) {
          errs.push({ name: item.file.name, error: upErr.message })
          continue
        }
        const {
          data: { publicUrl },
        } = supabase.storage.from('materials').getPublicUrl(uniqueKey)
        const { data, error } = await supabase
          .from('materials')
          .insert({
            user_id: userId,
            folder_path: folderPath,
            file_name: item.file.name, // 原始文件名（用于展示）
            file_url: publicUrl,
            file_size: item.file.size,
          })
          .select()
          .single()
        if (error) {
          errs.push({ name: item.file.name, error: error.message })
        } else if (data) {
          setMaterials((p) => [data, ...p])
          if (folderPath && folderPath !== '/') touchedFolders.add(folderPath)
        } else {
          // 插入成功但未能取回行（通常是 RLS 的 select 被限制）：文件其实已入库，
          // 必须提示用户刷新，否则会出现“没报错也看不到”的假象。
          errs.push({
            name: item.file.name,
            error: '已写入数据库，但本页未能即时显示，请刷新页面查看。',
          })
        }
      } catch (e: any) {
        errs.push({
          name: item.file.name,
          error: e?.message || '未知错误',
        })
      }
    }
    // 把新出现的文件夹（所有层级）登记进树，并逐级展开，否则上传
    // “外层/内层”这类嵌套文件夹时，中间层默认折叠，深层子文件夹会显示不出来。
    // 用 plannedFolders（从 pending 直接推导的每一层）为准，touchedFolders 只作补充。
    const allFolders = new Set<string>([...plannedFolders, ...touchedFolders])
    if (allFolders.size) {
      setExtraFolders((p) => {
        const next = [...p]
        allFolders.forEach((f) => {
          if (f && f !== '/' && !next.includes(f)) next.push(f)
        })
        return next
      })
      setExpanded((e) => {
        const next = { ...e, '/': true, [selectedFolder]: true, [uploadTarget]: true }
        allFolders.forEach((f) => {
          const parts = f.split('/').filter(Boolean)
          let acc = ''
          for (const seg of parts) {
            acc += '/' + seg
            next[acc] = true
          }
        })
        return next
      })
    }
    setPending([])
    setUploading(false)
    setUploadOpen(false)
    if (errs.length) setFailed(errs)
  }

  // ---- 删除文件 ----
  const remove = async () => {
    if (!confirmDelete) return
    const storagePath = confirmDelete.file_url
      .split('/public/materials/')[1]
      ?.replace(/^\//, '') // 去掉可能带上的首斜杠，否则 Storage 删不掉
    if (storagePath) {
      await supabase.storage.from('materials').remove([storagePath])
    }
    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', confirmDelete.id)
    if (!error) {
      setMaterials((p) => p.filter((m) => m.id !== confirmDelete.id))
    } else {
      alert('删除失败：' + error.message)
    }
    setConfirmDelete(null)
  }

  // ---- 删除文件夹 ----
  // moveToParent=true：仅删除文件夹，其下文件整体上移到父级；
  // moveToParent=false（默认）：连同文件夹内的所有文件（含 Storage 对象）一起删除。
  const deleteFolder = async () => {
    if (!confirmFolder || confirmFolder === '/') return
    // 比较时忽略首斜杠差异：兼容“修复首斜杠前”存进库的旧文件夹（folder_path 无首斜杠）
    const cf = confirmFolder.replace(/^\/+/, '')
    const matchPath = (fp: string) => {
      const n = (fp || '').replace(/^\/+/, '')
      return n === cf || n.startsWith(cf + '/')
    }
    const targets = materials.filter((m) => matchPath(m.folder_path))
    // 不论哪种模式，文件夹树节点（含被删除文件夹及其所有子层级）都要从 extraFolders 移除
    const pruneFolderNodes = () =>
      setExtraFolders((p) =>
        p.filter((f) => {
          const n = f.replace(/^\/+/, '')
          return n !== cf && !n.startsWith(cf + '/')
        })
      )

    if (targets.length === 0) {
      // 空文件夹（仅 UI 创建、库里没有文件）：直接移除本地记录即可
      pruneFolderNodes()
      setConfirmFolder(null)
      setMoveToParent(false)
      return
    }

    const ids = targets.map((t) => t.id)
    if (moveToParent) {
      // 模式一：文件上移到父级（所有嵌套文件都移到被删文件夹的直属上级）
      const parent = parentOf(confirmFolder)
      const { error } = await supabase
        .from('materials')
        .update({ folder_path: parent })
        .in('id', ids)
      if (!error) {
        setMaterials((p) =>
          p.map((m) =>
            ids.includes(m.id) ? { ...m, folder_path: parent } : m
          )
        )
      } else {
        alert('删除文件夹失败：' + error.message)
        return
      }
    } else {
      // 模式二（默认）：连同文件夹内文件一起删除 → 先删 Storage 对象，再删库记录
      const storagePaths = targets
        .map((t) => t.file_url.split('/public/materials/')[1]?.replace(/^\//, ''))
        .filter(Boolean) as string[]
      if (storagePaths.length) {
        await supabase.storage.from('materials').remove(storagePaths)
      }
      const { error } = await supabase
        .from('materials')
        .delete()
        .in('id', ids)
      if (!error) {
        setMaterials((p) => p.filter((m) => !ids.includes(m.id)))
      } else {
        alert('删除文件夹失败：' + error.message)
        return
      }
    }
    pruneFolderNodes()
    setConfirmFolder(null)
    setMoveToParent(false)
  }

  // ---- 移动 / 复制 ----
  const doMoveCopy = async () => {
    if (!moveFile) return
    if (copyMode) {
      const { data, error } = await supabase
        .from('materials')
        .insert({
          user_id: userId,
          folder_path: moveTarget,
          file_name: moveFile.file_name,
          file_url: moveFile.file_url,
          file_size: moveFile.file_size,
        })
        .select()
        .single()
      if (!error && data) setMaterials((p) => [data, ...p])
      else if (error) alert('复制失败：' + error.message)
    } else {
      const { error } = await supabase
        .from('materials')
        .update({ folder_path: moveTarget })
        .eq('id', moveFile.id)
      if (!error) {
        setMaterials((p) =>
          p.map((m) =>
            m.id === moveFile.id ? { ...m, folder_path: moveTarget } : m
          )
        )
      } else {
        alert('移动失败：' + error.message)
      }
    }
    setMoveFile(null)
  }

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
      {/* 左侧文件夹树 */}
      <aside className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between px-2 py-1">
          <h2 className="text-xs font-semibold uppercase text-slate-400">文件夹</h2>
          <button
            onClick={openNewFolder}
            className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200"
          >
            + 新建
          </button>
        </div>
        <FolderTree
          node={tree}
          selected={selectedFolder}
          onSelect={setSelectedFolder}
          onDelete={(p) => setConfirmFolder(p)}
          expanded={expanded}
          onToggle={(path) =>
            setExpanded((e) => ({ ...e, [path]: !e[path] }))
          }
        />
      </aside>

      {/* 右侧文件区 */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-500">
            当前路径：
            <span className="font-medium text-slate-700">{selectedFolder}</span>
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="按文件名搜索…"
            className="ml-auto flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none md:max-w-xs"
          />
          <button
            onClick={() => {
              setUploadTarget(selectedFolder)
              setPending([])
              setUploadOpen(true)
            }}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            上传
          </button>
        </div>

        <ul className="space-y-2">
          {visibleFiles.length === 0 && (
            <li className="rounded-lg bg-white p-6 text-center text-sm text-slate-400">
              该文件夹下还没有文件
            </li>
          )}
          {visibleFiles.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="min-w-0 flex-1">
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={m.file_name}
                  title={m.file_name}
                  className="block max-w-[260px] truncate font-medium text-slate-800 hover:text-blue-600"
                >
                  {m.file_name}
                </a>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatSize(m.file_size)}
                </p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  onClick={() => {
                    setMoveTarget(selectedFolder)
                    setCopyMode(false)
                    setMoveFile(m)
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600"
                >
                  移动
                </button>
                <button
                  onClick={() => {
                    setMoveTarget(selectedFolder)
                    setCopyMode(true)
                    setMoveFile(m)
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600"
                >
                  复制
                </button>
                <button
                  onClick={() => setConfirmDelete(m)}
                  className="text-xs text-red-500 hover:underline"
                >
                  删除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 新建文件夹弹窗 */}
      <Modal
        open={newFolderOpen}
        title="新建文件夹"
        onClose={() => setNewFolderOpen(false)}
      >
        <p className="mb-2 text-sm text-slate-500">
          将创建在：
          <span className="font-medium text-slate-700">
            {selectedFolder === '/' ? '全部文件（根目录）' : selectedFolder}
          </span>
        </p>
        <input
          autoFocus
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && confirmNewFolder()}
          placeholder="输入文件夹名称"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={() => setNewFolderOpen(false)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            取消
          </button>
          <button
            onClick={confirmNewFolder}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            确认创建
          </button>
        </div>
      </Modal>

      {/* 上传弹窗 */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">上传文件</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
              >
                选择文件
              </button>
              <button
                onClick={() => folderRef.current?.click()}
                className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-200"
              >
                选择文件夹
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                className="hidden"
                onChange={pickFiles}
              />
              <input
                ref={folderRef}
                type="file"
                // @ts-expect-error webkitdirectory 非标准属性
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={pickFolder}
              />
            </div>
            {pending.length > 0 && (
              <ul className="mt-3 max-h-32 space-y-1 overflow-auto text-sm text-slate-600">
                {pending.map((p, i) => (
                  <li key={i} className="truncate">
                    {p.relPath}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3">
              <p className="mb-1 text-xs text-slate-500">放到哪个文件夹：</p>
              <div className="max-h-40 space-y-1 overflow-auto">
                <FolderPicker
                  node={tree}
                  selected={uploadTarget}
                  onSelect={setUploadTarget}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => {
                  setUploadOpen(false)
                  setPending([])
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={confirmUpload}
                disabled={pending.length === 0 || uploading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:bg-slate-300"
              >
                {uploading ? '上传中…' : `上传（${pending.length}）`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 上传失败弹窗 */}
      <Modal
        open={failed.length > 0}
        title="以下文件上传失败"
        onClose={() => setFailed([])}
      >
        <ul className="max-h-60 space-y-2 overflow-auto text-sm">
          {failed.map((f, i) => (
            <li key={i} className="rounded-lg bg-red-50 p-2">
              <p className="font-medium text-red-700">{f.name}</p>
              <p className="text-xs text-red-600">{f.error}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-400">
          已自动过滤文件名中的特殊字符；若仍失败，多为单个文件过大或网络中断，可重试较小的文件。
        </p>
        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setFailed([])}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
          >
            我知道了
          </button>
        </div>
      </Modal>

      {/* 移动 / 复制弹窗 */}
      {moveFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">
              {copyMode ? '复制到…' : '移动到…'}
            </h3>
            <p className="mt-1 truncate text-sm text-slate-500">
              {moveFile.file_name}
            </p>
            <div className="mt-3 max-h-60 space-y-1 overflow-auto">
              <FolderPicker
                node={tree}
                selected={moveTarget}
                onSelect={setMoveTarget}
              />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setMoveFile(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={doMoveCopy}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                确认{copyMode ? '复制' : '移动'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        message={`确定删除文件「${confirmDelete?.file_name}」吗？文件将从存储中一并移除。`}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(null)}
      />
      {/* 删除文件夹弹窗：可选是否把文件移动到上一级，默认连同文件一起删除 */}
      {confirmFolder !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
            <h3 className="text-base font-semibold text-slate-800">删除文件夹</h3>
            <p className="mt-2 text-sm text-slate-600">
              即将删除文件夹「
              <span className="font-medium text-slate-800">{confirmFolder}</span>
              」。
            </p>
            <label className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={moveToParent}
                onChange={(e) => setMoveToParent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                保留文件，将其<span className="font-medium">移动到上一级文件夹</span>
                <br />
                <span className="text-xs text-slate-400">
                  （不勾选则默认连同文件夹内的文件一起删除）
                </span>
              </span>
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setConfirmFolder(null)
                  setMoveToParent(false)
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
              <button
                onClick={deleteFolder}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
              >
                {moveToParent ? '移动并删除文件夹' : '删除文件夹（含文件）'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function FolderTree({
  node,
  selected,
  onSelect,
  onDelete,
  expanded,
  onToggle,
}: {
  node: FolderNode
  selected: string
  onSelect: (path: string) => void
  onDelete: (path: string) => void
  expanded: Record<string, boolean>
  onToggle: (path: string) => void
}) {
  const isOpen = expanded[node.path] ?? node.path === '/'
  return (
    <div>
      <div
        className={
          selected === node.path
            ? 'flex items-center rounded-lg bg-blue-50'
            : 'flex items-center rounded-lg hover:bg-slate-100'
        }
      >
        {node.children.length > 0 ? (
          <button
            onClick={() => onToggle(node.path)}
            className="px-1.5 py-1.5 text-xs text-slate-400"
            title={isOpen ? '折叠' : '展开'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span className="px-1.5 py-1.5 text-xs text-transparent">▾</span>
        )}
        <button
          onClick={() => onSelect(node.path)}
          className="flex-1 px-1 py-1.5 text-left text-sm font-medium text-blue-700"
        >
          {node.name}
        </button>
        {node.path !== '/' && (
          <button
            onClick={() => onDelete(node.path)}
            className="px-2 text-sm text-slate-400 hover:text-red-500"
            title="删除文件夹"
          >
            ×
          </button>
        )}
      </div>
      {node.children.length > 0 && isOpen && (
        <div className="ml-3 border-l border-slate-100 pl-1">
          {node.children.map((child) => (
            <FolderTree
              key={child.path}
              node={child}
              selected={selected}
              onSelect={onSelect}
              onDelete={onDelete}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderPicker({
  node,
  selected,
  onSelect,
}: {
  node: FolderNode
  selected: string
  onSelect: (path: string) => void
}) {
  return (
    <div>
      <label className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-slate-100">
        <input
          type="radio"
          name="folder-picker"
          checked={selected === node.path}
          onChange={() => onSelect(node.path)}
        />
        <span className={selected === node.path ? 'font-medium text-blue-700' : ''}>
          {node.name}
          {node.path === '/' ? '（不放在文件夹）' : ''}
        </span>
      </label>
      {node.children.length > 0 && (
        <div className="ml-4 border-l border-slate-100 pl-1">
          {node.children.map((child) => (
            <FolderPicker
              key={child.path}
              node={child}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}
