import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import ProfileClient, { type ProfileData } from './ProfileClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // 查 profiles，没有就自动建一行
  let { data: profile } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile) {
    await supabase
      .from('profiles')
      .upsert({ user_id: user.id, username: null, avatar_url: null })
    const { data: created } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
    profile = created
  }

  const initialProfile: ProfileData = {
    username: profile?.username ?? null,
    avatar_url: profile?.avatar_url ?? null,
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-bold text-slate-900">我的主页</h1>
        <p className="mt-1 text-sm text-slate-500">
          管理你的头像与昵称，修改后会同步到顶部导航。
        </p>
        <ProfileClient initialProfile={initialProfile} />
      </div>
    </main>
  )
}
