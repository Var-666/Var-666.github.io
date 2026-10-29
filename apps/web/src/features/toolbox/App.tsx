import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Moon, Star, Sun } from 'lucide-react'
import { Toaster } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/components/ThemeProvider'
import { preferenceStorage } from '@/lib/storage'
import {
  readFavoriteTools,
  readRecentTools,
  recordRecentTool,
  toggleFavoriteTool,
} from './lib/storage'
import { ToolLoader } from './ToolLoader'
import { OfflineStatus } from './OfflineStatus'
import { tools } from './tools'
import { GlobalFileIntake, HomeFileDrop } from './FileIntake'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const loadTextTool = () => import(/* webpackChunkName: "TextTool" */ './text/TextTool')
const loadFileTool = () => import(/* webpackChunkName: "FileTool" */ './files/FileTool')
const loadPdfTool = () => import(/* webpackChunkName: "PdfTool" */ './pdf/PdfTool')
const loadRenameTool = () => import(/* webpackChunkName: "RenameTool" */ './rename/RenameTool')
const loadCompareTool = () => import(/* webpackChunkName: "CompareTool" */ './compare/CompareTool')
const loadTableTool = () => import(/* webpackChunkName: "TableTool" */ './table/TableTool')
const toolLoads: Record<string, () => Promise<unknown>> = {
  text: loadTextTool,
  files: loadFileTool,
  pdf: loadPdfTool,
  rename: loadRenameTool,
  compare: loadCompareTool,
  table: loadTableTool,
}
const preloadTool = (id: string) => {
  // A hover/focus is only a hint; failed preloads must not navigate or poison retry.
  void toolLoads[id]?.().catch(() => {})
}
const toolIds = tools.map((tool) => tool.id)
type Route = 'home' | 'text' | 'files' | 'compare' | 'table' | 'pdf' | 'rename'
const routes = new Set(['text', 'files', 'compare', 'table', 'pdf', 'rename'])
const readRoute = (): Route => {
  const segment = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
  if (segment === 'workspace') return 'text' // 兼容旧版理文地址
  return routes.has(segment) ? (segment as Route) : 'home'
}

export default function App() {
  const root = useRef<HTMLDivElement>(null)
  const navigated = useRef(false)
  const [route, setRoute] = useState(readRoute)
  const [favorites, setFavorites] = useState<string[]>(() =>
    readFavoriteTools(preferenceStorage, toolIds),
  )
  const [recent, setRecent] = useState<string[]>(() => readRecentTools(preferenceStorage, toolIds))
  const [visited, setVisited] = useState<Partial<Record<Route, true>>>(() => {
    const initial = readRoute()
    return initial === 'home' ? {} : { [initial]: true }
  })
  const { dark, setDark } = useTheme()
  const toolId = route === 'compare' ? 'table' : route
  const currentTool = tools.find((tool) => tool.id === toolId)
  useEffect(() => {
    const changed = () => {
      const next = readRoute()
      navigated.current = true
      setRoute(next)
      setVisited((previous) =>
        next === 'home' || previous[next] ? previous : { ...previous, [next]: true },
      )
    }
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
  }, [])
  useEffect(() => {
    if (!navigated.current || !root.current) return
    // 标签切换保留标签焦点，让左右方向键仍可连续操作。
    if (document.activeElement?.closest('[role="tablist"]')) return
    const focusHeading = () => {
      const heading = Array.from(root.current?.querySelectorAll('h1') ?? []).find(
        (element) => element.getClientRects().length > 0,
      )
      if (!heading) return false
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      heading.scrollIntoView({ block: 'start' })
      return true
    }
    if (focusHeading()) return
    const observer = new MutationObserver(() => {
      if (focusHeading()) observer.disconnect()
    })
    observer.observe(root.current, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [route])
  useEffect(() => {
    document.title = `${route === 'home' ? '日常工具箱' : currentTool?.title} · VAR`
  }, [route, currentTool?.title])
  // 表格的两个模式共用一条最近使用记录。
  useEffect(() => {
    if (toolId === 'home') return
    recordRecentTool(preferenceStorage, toolId, toolIds)
    setRecent(readRecentTools(preferenceStorage, toolIds))
  }, [toolId])
  return (
    <div className="app-shell" ref={root}>
      <GlobalFileIntake />
      {route !== 'home' && (
        <div className="tool-breadcrumb">
          <a href="#/">
            <ArrowLeft size={14} />
            全部工具
          </a>
          <span>/</span>
          <span>{currentTool?.title}</span>
        </div>
      )}
      {route === 'home' && (
        <main className="main-content tool-home">
          <section className="intro">
            <h1>全部工具</h1>
            <span className="tool-count">{tools.length} 个工具</span>
          </section>
          <HomeFileDrop />
          {!!favorites.length && (
            <section className="home-block" aria-label="常用工具">
              <h2>常用工具</h2>
              <div className="task-chips">
                {favorites.map((id) => {
                  const tool = tools.find((item) => item.id === id)
                  if (!tool) return null
                  return (
                    <a
                      key={id}
                      className="task-chip is-favorite"
                      href={`#/${id}`}
                      onPointerEnter={() => preloadTool(id)}
                      onFocus={() => preloadTool(id)}
                    >
                      <Star size={13} fill="currentColor" />
                      {tool.title}
                    </a>
                  )
                })}
              </div>
            </section>
          )}
          {!!recent.length && (
            <section className="home-block" aria-label="最近使用">
              <h2>最近使用</h2>
              <div className="task-chips">
                {recent.map((id) => {
                  const tool = tools.find((item) => item.id === id)
                  return tool ? (
                    <a
                      key={id}
                      className="task-chip"
                      href={`#/${id}`}
                      onPointerEnter={() => preloadTool(id)}
                      onFocus={() => preloadTool(id)}
                    >
                      {tool.title}
                    </a>
                  ) : null
                })}
              </div>
            </section>
          )}
          <div className="tool-grid">
            {tools.map(({ id, title, description, icon: Icon, tags }) => {
              const favorite = favorites.includes(id)
              return (
                <div key={id} className="tool-card-wrap">
                  <a
                    className="tool-card"
                    href={`#/${id}`}
                    onPointerEnter={() => preloadTool(id)}
                    onFocus={() => preloadTool(id)}
                  >
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
                    onClick={() => setFavorites(toggleFavoriteTool(preferenceStorage, id, toolIds))}
                  >
                    <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>
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
      {(visited.table || visited.compare) && (
        <div hidden={route !== 'table' && route !== 'compare'}>
          <Tabs
            value={route === 'compare' ? 'compare' : 'table'}
            onValueChange={(value) => {
              window.location.hash = `#/${value}`
            }}
          >
            <div className="main-content table-mode-switch">
              <TabsList aria-label="表格工具功能">
                <TabsTrigger
                  value="table"
                  onPointerEnter={() => preloadTool('table')}
                  onFocus={() => preloadTool('table')}
                >
                  批量处理
                </TabsTrigger>
                <TabsTrigger
                  value="compare"
                  onPointerEnter={() => preloadTool('compare')}
                  onFocus={() => preloadTool('compare')}
                >
                  表格对比
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="table" forceMount hidden={route !== 'table'}>
              {visited.table && (
                <ToolLoader load={loadTableTool} active={route === 'table'} title="表格批量处理" />
              )}
            </TabsContent>
            <TabsContent value="compare" forceMount hidden={route !== 'compare'}>
              {visited.compare && (
                <ToolLoader load={loadCompareTool} active={route === 'compare'} title="表格对比" />
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}
      <footer className="toolbox-footer">
        <OfflineStatus />
        <Button
          variant="ghost"
          size="icon"
          aria-label={dark ? '切换浅色主题' : '切换深色主题'}
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={18} /> : <Moon size={18} />}
        </Button>
      </footer>
      <Toaster
        position="bottom-center"
        theme={dark ? 'dark' : 'light'}
        closeButton
        containerAriaLabel="操作通知"
        toastOptions={{ closeButtonAriaLabel: '关闭通知' }}
      />
    </div>
  )
}
