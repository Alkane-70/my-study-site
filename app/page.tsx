import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  // 你的 server.ts 里 createClient 是 async 函数，这里必须 await
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 未登录 -> 跳转到登录页（middleware 也会兜底保护）
  if (!user) {
    redirect('/login')
  }

  // 优先用自定义昵称；未设置则回退到邮箱
  let displayName = user.email ?? ''
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('user_id', user.id)
      .single()
    if (profile?.username && profile.username.trim()) {
      displayName = profile.username.trim()
    }
  } catch {
    // 取不到昵称就沿用邮箱，不阻断页面
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* 欢迎语区域 */}
      <section className="mx-auto max-w-5xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-slate-900 sm:text-4xl">
          欢迎回来，{displayName}
        </h1>
        <p className="mt-4 text-slate-600">
          在这里记录你的学习轨迹、整理科目笔记，并随时回顾你的资料库。
        </p>
        <div className="mt-8 flex justify-center">
          <a
            href="/progress"
            className="rounded-lg bg-blue-600 px-6 py-3 text-white transition hover:bg-blue-700"
          >
            开始今天的学习
          </a>
        </div>
      </section>
    </main>
  )
}
