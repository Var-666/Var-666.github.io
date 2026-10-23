import { lazy, Suspense, useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, FileText, Files, LayoutGrid, Moon, Sun } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import TextTool from './TextTool'

const FileTool = lazy(() => import('./FileTool'))
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
]
const readRoute = () =>
  window.location.hash.startsWith('#/files')
    ? 'files'
    : window.location.hash.startsWith('#/text') || window.location.hash === '#workspace'
      ? 'text'
      : 'home'

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [textVisited, setTextVisited] = useState(() => readRoute() === 'text')
  const [filesVisited, setFilesVisited] = useState(() => readRoute() === 'files')
  const [dark, setDark] = useState(() => {
    try {
      return localStorage.getItem('liwen-theme') === 'dark'
    } catch {
      return false
    }
  })
  useEffect(() => {
    const changed = () => {
      const next = readRoute()
      setRoute(next)
      if (next === 'text') setTextVisited(true)
      if (next === 'files') setFilesVisited(true)
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('liwen-theme', dark ? 'dark' : 'light')
    } catch {
      /* optional */
    }
  }, [dark])
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
              onClick={() => setDark(!dark)}
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
      {textVisited && (
        <div hidden={route !== 'text'}>
          <TextTool active={route === 'text'} />
        </div>
      )}
      {filesVisited && (
        <div hidden={route !== 'files'}>
          <Suspense fallback={<main className="main-content">正在加载文件工具…</main>}>
            <FileTool />
          </Suspense>
        </div>
      )}
      <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} richColors closeButton />
    </div>
  )
}
