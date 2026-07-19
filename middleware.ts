import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/utils/supabase/config'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  try {
    const supabase = createServerClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            )
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    // 用 getSession 代替 getUser：只读本地 cookie、不发网络请求，
    // 可大幅减少每次导航的鉴权耗时（页面服务端仍用 getUser 做权威校验）。
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const user = session?.user ?? null

    const { pathname } = request.nextUrl

    // 需要登录才能访问的受保护页面（与 Navbar 的链接保持一致）
    const protectedPaths = ['/', '/progress', '/notes', '/materials', '/profile']
    const isProtected = protectedPaths.some(
      (p) => pathname === p || pathname.startsWith(p + '/')
    )

    // 登录 / 注册页：已登录用户无需再访问，直接送回首页
    const authPaths = ['/login', '/signup']
    const isAuthPage = authPaths.includes(pathname)

    if (!user && isProtected) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      return NextResponse.redirect(url)
    }

    if (user && isAuthPage) {
      const url = request.nextUrl.clone()
      url.pathname = '/'
      return NextResponse.redirect(url)
    }
  } catch (e: any) {
    // 即使鉴权中间件出错，也“放行”页面，避免整站打不开（fail-open）
    console.error('[mw] error', e?.message)
  }

  return supabaseResponse
}

export const config = {
  // 排除 /api（健康检查接口不应被 middleware 拦截）、静态资源
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
