import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LegacyToolRedirect } from '@/features/toolbox/legacy-redirect'

export default function HomePage() {
  return (
    <main id="main-content" tabIndex={-1} className="site-home">
      <LegacyToolRedirect />
      <section className="home-intro">
        <h1>欢迎来到 VAR。</h1>
        <p>一个简单的个人空间，也放着一些顺手的小工具。</p>
        <Button asChild size="lg">
          <Link href="/tools/">
            浏览工具箱
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
      <section className="home-explore" aria-labelledby="home-explore-title">
        <h2 id="home-explore-title">探索本站</h2>
        <Link className="home-module" href="/tools/">
          <span className="home-module-icon">
            <Wrench size={26} aria-hidden="true" />
          </span>
          <div>
            <h3>工具箱</h3>
            <p>文本、图片、表格与 PDF，日常文件处理集中在这里。</p>
            <span>浏览器本地处理 · 打开即用</span>
          </div>
          <ArrowRight className="home-module-arrow" size={20} aria-hidden="true" />
        </Link>
      </section>
    </main>
  )
}
