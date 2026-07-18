'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useProfile } from '@/components/ProfileContext'

export type ProfileData = {
  username: string | null
  avatar_url: string | null
}

// 加时间戳，避免浏览器/CDN 缓存导致旧头像一直显示
function bust(url: string) {
  return url + (url.includes('?') ? '&' : '?') + 't=' + Date.now()
}

export default function ProfileClient({
  initialProfile,
}: {
  initialProfile: ProfileData
}) {
  const supabase = createClient()
  const { refresh } = useProfile()
  const [username, setUsername] = useState(initialProfile.username ?? '')
  const [avatarUrl, setAvatarUrl] = useState(
    initialProfile.avatar_url ? bust(initialProfile.avatar_url) : ''
  )
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  const saveUsername = async () => {
    setSaving(true)
    setMsg('')
    const name = username.trim()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setMsg('未登录，无法保存')
      setSaving(false)
      return
    }
    // upsert 按 user_id 冲突合并，即使 profiles 里还没有当前用户这一行也能保存
    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, username: name || null }, {
        onConflict: 'user_id',
      })
    if (!error) {
      setMsg('昵称已保存')
      refresh()
    } else {
      setMsg('保存失败：' + error.message)
    }
    setSaving(false)
  }

  const onAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSaving(true)
    setMsg('')
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setMsg('未登录，无法上传')
      setSaving(false)
      return
    }

    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: upErr } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true })
    if (upErr) {
      setMsg('头像上传失败：' + upErr.message)
      setSaving(false)
      if (avatarRef.current) avatarRef.current.value = ''
      return
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from('avatars').getPublicUrl(path)

    const { error } = await supabase
      .from('profiles')
      .upsert({ user_id: user.id, avatar_url: publicUrl }, {
        onConflict: 'user_id',
      })
    if (!error) {
      setAvatarUrl(bust(publicUrl))
      setMsg('头像已更新')
      refresh()
    } else {
      setMsg('保存失败：' + error.message)
    }
    setSaving(false)
    if (avatarRef.current) avatarRef.current.value = ''
  }

  return (
    <div className="mt-6 space-y-6 rounded-xl border border-slate-200 bg-white p-6">
      {/* 头像 */}
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt="头像"
            className="h-20 w-20 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-200 text-2xl text-slate-500">
            {(username || '学').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div>
          <button
            onClick={() => avatarRef.current?.click()}
            disabled={saving}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200 disabled:opacity-50"
          >
            {saving ? '处理中…' : '上传头像'}
          </button>
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatar}
          />
          <p className="mt-1 text-xs text-slate-400">支持 jpg / png，建议正方形</p>
        </div>
      </div>

      {/* 昵称 */}
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          昵称
        </label>
        <div className="flex gap-2">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="给自己起个名字"
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={saveUsername}
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          >
            保存昵称
          </button>
        </div>
      </div>

      {msg && (
        <p
          className={
            msg.startsWith('保存失败') || msg.startsWith('上传失败') || msg.startsWith('未登录')
              ? 'text-sm text-red-600'
              : 'text-sm text-green-600'
          }
        >
          {msg}
        </p>
      )}
    </div>
  )
}
