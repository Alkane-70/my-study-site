import { NextResponse } from 'next/server'

// 纯函数健康检查：不经过 middleware、不连 Supabase。
// 用来判断 Vercel 的 Serverless Function 是否能正常响应。
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    node: process.version,
  })
}
