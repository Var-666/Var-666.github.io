import Link from 'next/link'
import { LegacyToolRedirect } from '@/features/toolbox/legacy-redirect'

export default function HomePage() {
  return (
    <main className="site-home">
      <LegacyToolRedirect />
      <h1>VAR</h1>
      <Link href="/tools/">打开工具箱 →</Link>
    </main>
  )
}
