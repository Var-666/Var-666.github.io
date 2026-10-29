import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.hi-var.top'),
  title: 'VAR',
  description: 'VAR 的个人网站。',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
}
export const viewport: Viewport = { themeColor: '#f7f8fa' }

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
