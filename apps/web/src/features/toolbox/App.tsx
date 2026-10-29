import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowUpRight, LayoutGrid, Moon, Star, Sun } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { readThemePreference } from './lib/theme'
import {
  readFavoriteTools,
  readRecentTools,
  recordRecentTool,
  storageKeys,
  toggleFavoriteTool,
} from './lib/storage'
import { searchHome } from './home-search'
import { ToolLoader } from './ToolLoader'
import { OfflineStatus } from './OfflineStatus'
import { tools } from './tools'
import { SiteUtilities, HomeFileDrop } from './SiteUtilities'

const loadTextTool = () => import(/* webpackChunkName: "TextTool" */ './text/TextTool')
const loadFileTool = () => import(/* webpackChunkName: "FileTool" */ './files/FileTool')
const loadPdfTool = () => import(/* webpackChunkName: "PdfTool" */ './pdf/PdfTool')
const loadRenameTool = () => import(/* webpackChunkName: "RenameTool" */ './rename/RenameTool')
const loadCompareTool = () => import(/* webpackChunkName: "CompareTool" */ './compare/CompareTool')
const loadTableTool = () => import(/* webpackChunkName: "TableTool" */ './table/TableTool')
const toolIds = tools.map((tool) => tool.id)
type Route = 'home' | 'text' | 'files' | 'compare' | 'table' | 'pdf' | 'rename'
const routes = new Set(['text', 'files', 'compare', 'table', 'pdf', 'rename'])
const readRoute = (): Route => {
  const segment = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  if (segment === 'workspace') return 'text' // 兼容旧版理文地址
  return routes.has(segment) ? (segment as Route) : 'home'
}

export default function App() {
  const [route, setRoute] = useState(readRoute)
  const [query, setQuery] = useState('')
  const [showAllTasks, setShowAllTasks] = useState(false)
  const [favorites, setFavorites] = useState<string[]>(() =>
    readFavoriteTools(localStorage, toolIds),
  )
  const [recent, setRecent] = useState<string[]>(() => readRecentTools(localStorage, toolIds))
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
  // 进入某个工具时记录最近使用（只存工具 id 与时间戳，不含任何正文）
  useEffect(() => {
    if (route === 'home') return
    recordRecentTool(localStorage, route, toolIds)
    setRecent(readRecentTools(localStorage, toolIds))
  }, [route])
  const results = useMemo(() => searchHome(query, tools), [query])
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="网站首页">
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
            <OfflineStatus />
            <SiteUtilities route={route} />
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
          <HomeFileDrop />
          <input
            className="home-search"
            type="search"
            aria-label="搜索工具"
            placeholder="搜索工具或任务，如：压缩图片、转 CSV、断行"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {!!results.tasks.length && (
            <section className="home-block" aria-label="常见任务">
              <h2>常见任务</h2>
              <div
                className={`task-chips home-task-chips${showAllTasks || query ? ' is-expanded' : ''}`}
              >
                {results.tasks.map((task) => (
                  <a key={task.id} className="task-chip" href={task.hash}>
                    {task.title}
                  </a>
                ))}
              </div>
              {!query && results.tasks.length > 5 && (
                <button
                  className="more-tasks"
                  aria-expanded={showAllTasks}
                  onClick={() => setShowAllTasks((value) => !value)}
                >
                  {showAllTasks ? '收起任务' : '更多任务'}
                </button>
              )}
            </section>
          )}
          {!query && !!favorites.length && (
            <section className="home-block" aria-label="常用工具">
              <h2>常用工具</h2>
              <div className="task-chips">
                {favorites.map((id) => {
                  const tool = tools.find((item) => item.id === id)
                  if (!tool) return null
                  return (
                    <a key={id} className="task-chip is-favorite" href={`#/${id}`}>
                      <Star size={13} fill="currentColor" />
                      {tool.title}
                    </a>
                  )
                })}
              </div>
            </section>
          )}
          {!query && !!recent.length && (
            <section className="home-block" aria-label="最近使用">
              <h2>最近使用</h2>
              <div className="task-chips">
                {recent.map((id) => {
                  const tool = tools.find((item) => item.id === id)
                  return tool ? (
                    <a key={id} className="task-chip" href={`#/${id}`}>
                      {tool.title}
                    </a>
                  ) : null
                })}
              </div>
            </section>
          )}
          {results.tools.length ? (
            <div className="tool-grid">
              {results.tools.map(({ id, title, description, icon: Icon, tags }) => {
                const favorite = favorites.includes(id)
                return (
                  <div key={id} className="tool-card-wrap">
                    <a className="tool-card" href={`#/${id}`}>
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
                    <button
                      type="button"
                      className={`tool-favorite${favorite ? ' is-favorite' : ''}`}
                      aria-pressed={favorite}
                      aria-label={`${favorite ? '取消收藏' : '收藏'}${title}`}
                      onClick={() => setFavorites(toggleFavoriteTool(localStorage, id, toolIds))}
                    >
                      <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                )
              })}
            </div>
          ) : !results.tasks.length ? (
            <p className="home-empty">没有找到匹配的工具，换个关键词试试。</p>
          ) : null}
        </main>
      )}
      {visited.text && (
        <div hidden={route !== 'text'}>
          <ToolLoader load={loadTextTool} active={route === 'text'} title="文本整理" />
        </div>
      )}
      {visited.files && (
        <div hidden={route !== 'files'}>
          <ToolLoader load={loadFileTool} active={route === 'files'} title="文件格式转换" />
        </div>
      )}
      {visited.pdf && (
        <div hidden={route !== 'pdf'}>
          <ToolLoader load={loadPdfTool} active={route === 'pdf'} title="PDF 页面整理" />
        </div>
      )}
      {visited.rename && (
        <div hidden={route !== 'rename'}>
          <ToolLoader load={loadRenameTool} active={route === 'rename'} title="批量重命名" />
        </div>
      )}
      {visited.compare && (
        <div hidden={route !== 'compare'}>
          <ToolLoader load={loadCompareTool} active={route === 'compare'} title="表格对比" />
        </div>
      )}
      {visited.table && (
        <div hidden={route !== 'table'}>
          <ToolLoader load={loadTableTool} active={route === 'table'} title="表格批量处理" />
        </div>
      )}
      <Toaster position="bottom-center" theme={dark ? 'dark' : 'light'} richColors closeButton />
    </div>
  )
}
