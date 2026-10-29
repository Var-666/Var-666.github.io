import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/features/toolbox/styles.css'

const title = 'VAR · 日常工具箱'
const description =
  '文本整理、表格处理、PDF 页面整理、批量重命名与文件格式转换，全部在浏览器本地处理，可离线使用。'

export const metadata: Metadata = {
  metadataBase: new URL('https://www.hi-var.top'),
  title,
  description,
  alternates: { canonical: '/tools/' },
  manifest: '/manifest.webmanifest',
  icons: { icon: '/favicon.svg', apple: '/apple-touch-icon.png' },
  openGraph: {
    title,
    description,
    type: 'website',
    siteName: title,
    locale: 'zh_CN',
    url: '/tools/',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'VAR · TOOLBOX' }],
  },
  twitter: { card: 'summary_large_image', title, description, images: ['/og-image.png'] },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <noscript>本站需要启用 JavaScript。所有工具均在浏览器本地处理，不上传文件。</noscript>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'WebApplication',
            name: title,
            url: 'https://www.hi-var.top/tools/',
            description,
            applicationCategory: 'UtilitiesApplication',
            operatingSystem: 'Any',
            inLanguage: 'zh-CN',
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'CNY' },
          }),
        }}
      />
    </>
  )
}
