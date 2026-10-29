'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function SiteHeader() {
  const pathname = usePathname()
  return (
    <>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          const main = document.getElementById('main-content')
          if (!main) return
          event.preventDefault()
          main.focus()
          main.scrollIntoView({ block: 'start' })
        }}
      >
        跳到主要内容
      </a>
      <header className="website-header">
        <div className="website-header-inner">
          <Link className="website-brand" href="/" aria-label="VAR 网站首页">
            <span className="website-brand-mark" aria-hidden="true">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path
                  d="M5 4l6 14 6-14"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            VAR
          </Link>
          <nav className="website-nav" aria-label="网站导航">
            <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>
              首页
            </Link>
            <Link
              href="/tools/"
              aria-current={pathname.startsWith('/tools') ? 'page' : undefined}
              onNavigate={(event) => {
                if (pathname.startsWith('/tools')) {
                  event.preventDefault()
                  window.location.hash = '#/'
                }
              }}
            >
              工具箱
            </Link>
          </nav>
        </div>
      </header>
    </>
  )
}
