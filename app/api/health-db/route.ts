import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

// 服务端 Supabase 连接健康检查：分步记录，任一步失败都返回 JSON（不会挂起），
// 便于从浏览器直接看到卡在“建客户端 / getUser / 读表”哪一步。
export const dynamic = 'force-dynamic'

function withTimeout<T>(p: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms)
    ),
  ])
}

export async function GET() {
  const result: Record<string, unknown> = { step: 'start', ok: false }
  try {
    const supabase = await createClient()
    result.step = 'client-created'

    const { data, error } = await withTimeout(supabase.auth.getUser(), 8000)
    result.step = 'getUser-done'
    result.userEmail = data.user?.email ?? null
    result.authError = error?.message ?? null
    if (error) {
      return NextResponse.json(result, { status: 200 })
    }

    const { error: perr } = await withTimeout(
      supabase.from('profiles').select('count').limit(1),
      8000
    )
    result.step = 'profiles-read'
    result.profilesError = perr?.message ?? null
    result.ok = !perr
  } catch (e: any) {
    result.step = `${result.step} (threw)`
    result.error = e?.message ?? String(e)
  }
  return NextResponse.json(result, { status: 200 })
}
