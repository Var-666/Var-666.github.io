import { lazy, Suspense, useEffect, useState } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  FileText,
  Files,
  FileStack,
  PencilLine,
  LayoutGrid,
  Moon,
  Sun,
} from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { readThemePreference } from './lib/theme'
import { storageKeys } from './lib/storage'

const TextTool = lazy(() => import('./TextTool'))
const FileTool = lazy(() => import('./FileTool'))
const PdfTool = lazy(() => import('./PdfTool'))
const RenameTool = lazy(() => import('./RenameTool'))
const tools = [
  {
    id: 'text',
    title: '文本整理',
    description: '清理、去重、PDF 断行修复、中文排版',
    icon: FileText,
    tags: ['文字', 'Markdown'],
  },
  {
    id: 'files',
    title: '文件格式转换',
    description: '图片、文本、表格与办公文档转换',
    icon: Files,
    tags: ['PNG / JPG / WebP', 'CSV / JSON', 'Word / PDF'],
  },
  {
    id: 'pdf',
    title: 'PDF 页面整理',
    description: '合并、提取、删除、旋转与页面排序',
    icon: FileStack,
    tags: ['保留页面图文', '按页整理'],
  },
  {
    id: 'rename',
    title: '批量重命名',
    description: '统一编号、替换文字、添加前后缀',
    icon: PencilLine,
    tags: ['实时预览', 'ZIP 下载'],
  },
]
type Route = 'home' | 'text' | 'files' | 'pdf' | 'rename'
const routes = new Set(['text', 'files', 'pdf', 'rename'])
const readRoute = (): Route => {
  const segment = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  if (segment === 'workspace') return 'text' // 兼容旧版理文地址
  return routes.has(segment) ? (segment as Route) : 'home'
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [visited, setVisited] = useState<Partial<Record<Route, true>>>(() => {
    const initial = readRoute()
    return initial === 'home' ? {} : { [initial]: true }
  })
  const [themePreference, setThemePreference] = useState(() =>
    readThemePreference(() => localStorage.getItem(storageKeys.theme)),
  )
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches,
  )
  const dark = themePreference ?? systemDark
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const changed = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', changed)
    return () => media.removeEventListener('change', changed)
  }, [])
  useEffect(() => {
    const changed = () => {
      const next = readRoute()
      setRoute(next)
      setVisited((previous) =>
        next === 'home' || previous[next] ? previous : { ...previous, [next]: true },
      )
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', dark ? '#131722' : '#f7f8fa')
  }, [dark])
  useEffect(() => {
    if (themePreference === null) return
    try {
      localStorage.setItem(storageKeys.theme, themePreference ? 'dark' : 'light')
    } catch {
      /* optional */
    }
  }, [themePreference])
  useEffect(() => {
    document.title = `${route === 'home' ? '日常工具箱' : tools.find((tool) => tool.id === route)?.title} · VAR`
  }, [route])
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="工具箱首页">
            <span className="brand-icon">
              <LayoutGrid size={20} />
            </span>
            <span>
              VAR<span className="brand-en">工具箱</span>
            </span>
          </a>
          <nav className="desktop-nav" aria-label="主导航">
            <a href="#/" className={route === 'home' ? 'active' : ''}>
              全部工具
            </a>
            {tools.map((tool) => (
              <a key={tool.id} href={`#/${tool.id}`} className={route === tool.id ? 'active' : ''}>
                {tool.title}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <span className="local-indicator">
              <span />
              本地处理
            </span>
            <span className="header-divider" />
            <Button
              variant="ghost"
              size="icon"
              aria-label={dark ? '切换浅色主题' : '切换深色主题'}
              onClick={() => setThemePreference(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </Button>
          </div>
        </div>
      </header>
      {route !== 'home' && (
        <div className="tool-breadcrumb">
          <a href="#/">
            <ArrowLeft size={14} />
            全部工具
          </a>
          <span>/</span>
          <span>{tools.find((tool) => tool.id === route)?.title}</span>
        </div>
      )}
      {route === 'home' && (
        <main className="main-content tool-home">
          <section className="intro">
            <h1>全部工具</h1>
            <span className="tool-count">{tools.length} 个工具</span>
          </section>
          <div className="tool-grid">
            {tools.map(({ id, title, description, icon: Icon, tags }) => (
              <a key={id} className="tool-card" href={`#/${id}`}>
                <span className={`hub-icon hub-${id}`}>
                  <Icon size={22} />
                </span>
                <div>
                  <h2>
                    {title}
                    <ArrowUpRight size={16} />
                  </h2>
                  <p>{description}</p>
                  <div className="tool-tags">
                    {tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </main>
      )}
      {visited.text && (
        <div hidden={route !== 'text'}>
          <Suspense fallback={<main className="main-content">正在加载文本工具…</main>}>
            <TextTool active={route === 'text'} />
          </Suspense>
        </div>
      )}
      {visited.files && (
        <div hidden={route !== 'files'}>
          <Suspense fallback={<main className="main-content">正在加载文件工具…</main>}>
            <FileTool active={route === 'files'} />
          </Suspense>
        </div>
      )}
      {visited.pdf && (
        <div hidden={route !== 'pdf'}>
          <Suspense fallback={<main className="main-content">正在加载 PDF 工具…</main>}>
            <PdfTool active={route === 'pdf'} />
          </Suspense>
        </div>
      )}
      {visited.rename && (
        <div hidden={route !== 'rename'}>
          <Suspense fallback={<main className="main-content">正在加载重命名工具…</main>}>
            <RenameTool active={route === 'rename'} />
          </Suspense>
        </div>
      )}
      <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} richColors closeButton />
    </div>
  )
}
