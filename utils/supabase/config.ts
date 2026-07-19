// Supabase 连接配置（统一出口）
//
// 优先使用构建/运行环境变量：
//   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
// 若部署平台（如 Cloudflare Workers Builds）未配置这些变量，则回退到下方硬编码值。
//
// 说明：anon key 本就会被打进浏览器（NEXT_PUBLIC_ 前缀即是此意），由 Supabase 的
// RLS 行级权限保障数据安全。因此对“学习记录”这类项目，硬编码在此处是安全的，
// 可省去在每个部署平台上逐个配置环境变量的麻烦。

const FALLBACK_URL = 'https://augyotzvcmxjpkruqqgk.supabase.co'
const FALLBACK_ANON_KEY = 'sb_publishable_jJaev7lk1j14LnLZl1D5Rw_Dg6KFZbV'

export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL

export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_ANON_KEY
