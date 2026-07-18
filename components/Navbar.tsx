'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from './LogoutButton'
import { useProfile } from './ProfileContext'

const links = [
  { href: '/progress', label: '学习进度' },
  { href: '/notes', label: '科目笔记' },
  { href: '/materials', label: '资料库' },
]

function Avatar() {
  const { username, avatarUrl } = useProfile()
  const initial = (username || '学').trim().charAt(0).toUpperCase()

  return (
    <Link
      href="/profile"
      title="我的主页"
      aria-label="我的主页"
      className="group relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-600 transition hover:ring-2 hover:ring-blue-400"
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl}
          alt="头像"
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{initial}</span>
      )}
    </Link>
  )
}

export default function Navbar() {
  const pathname = usePathname()
  const { username } = useProfile()

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
      <nav className="flex w-full items-center gap-4 px-4 py-3">
        <Link href="/" className="text-lg font-bold text-slate-800">
          Study site
        </Link>
        <span className="hidden text-sm text-slate-500 sm:block">
          你好，{username || '同学'}
        </span>
        <ul className="flex flex-1 items-center justify-between text-sm text-slate-600">
          {links.map((l) => {
            const active = pathname === l.href || pathname.startsWith(l.href + '/')
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={
                    active
                      ? 'block rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-600'
                      : 'block rounded-lg px-3 py-1.5 transition hover:bg-slate-100 hover:text-blue-600'
                  }
                >
                  {l.label}
                </Link>
              </li>
            )
          })}
        </ul>
        <Avatar />
        <LogoutButton />
      </nav>
    </header>
  )
}
