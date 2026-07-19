import { NextResponse } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/utils/supabase/config'

// 纯函数健康检查：不经过 middleware、不连 Supabase。
// 用来判断部署平台的 Serverless Function 是否能正常响应，以及 Supabase 配置是否到位。
export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({
    ok: true,
    time: new Date().toISOString(),
    hasUrl: SUPABASE_URL.includes('supabase'),
    hasKey: !!SUPABASE_ANON_KEY,
    node: process.version,
  })
}
