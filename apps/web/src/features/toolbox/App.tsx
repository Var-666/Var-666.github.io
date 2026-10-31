import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  GitCompare,
  Moon,
  Star,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react'
import { Toaster } from 'sonner'
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
import { PROMISES, tools } from './tools'
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

function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/* ---------- 首页：图标架 / 工具一览 / 功能详解 / 承诺 ---------- */

const SHELF_SPANS = ['span-3', 'span-3', 'span-2', 'span-2', 'span-2']

function ThemeToggle({
  dark,
  onToggle,
  round = false,
}: {
  dark: boolean
  onToggle: () => void
  round?: boolean
}) {
  return (
    <button
      type="button"
      className={`theme-toggle${round ? ' is-round' : ''}`}
      aria-label={dark ? '切换浅色主题' : '切换深色主题'}
      onClick={onToggle}
    >
      {dark ? <Sun size={round ? 15 : 12} /> : <Moon size={round ? 15 : 12} />}
      {!round && (dark ? '浅色' : '深色')}
    </button>
  )
}

function Intro({
  online,
  dark,
  onToggleTheme,
}: {
  online: boolean
  dark: boolean
  onToggleTheme: () => void
}) {
  return (
    <section className="intro">
      <div className="intro-copy">
        <h1 className="tb-blur-in">
          全部工具<span aria-hidden="true">。</span>
        </h1>
        <p className="intro-sub tb-blur-in" style={{ animationDelay: '0.15s' }}>
          顺手的工具，就在浏览器里。
          <span className="tool-count">{tools.length} 个工具</span>
        </p>
      </div>
      <aside className="intro-aside tb-blur-in" style={{ animationDelay: '0.25s' }}>
        <div className="intro-privacy">
          <span className="intro-privacy-mark" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 22 22" fill="none">
              <path
                d="M5 4l6 14 6-14"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p>
            <strong>文件不上传。</strong>所有处理都在你的浏览器里完成。
            <a className="intro-privacy-link" href="#promises">
              了解隐私
              <ChevronRight size={14} aria-hidden="true" />
            </a>
          </p>
        </div>
        <div className="intro-status">
          <span className={`status-pill${online ? ' is-online' : ' is-offline'}`}>
            {online ? (
              <Wifi size={12} aria-hidden="true" />
            ) : (
              <WifiOff size={12} aria-hidden="true" />
            )}
            {online ? '在线 · 本地处理' : '离线中'}
          </span>
          <ThemeToggle dark={dark} onToggle={onToggleTheme} />
        </div>
      </aside>
    </section>
  )
}

function IconShelf() {
  return (
    <section className="tool-shelf-block" aria-label="工具快捷入口">
      <ul
        className="tool-shelf tb-blur-in"
        style={{ animationDelay: '0.2s' }}
        tabIndex={0}
        aria-label="工具快捷入口，横向滚动"
      >
        {tools.map((tool) => (
          <li key={tool.id}>
            <a
              className="shelf-item"
              href={`#/${tool.id}`}
              onPointerEnter={() => preloadTool(tool.id)}
              onFocus={() => preloadTool(tool.id)}
            >
              <span className="shelf-icon" style={{ background: tool.gradient }} aria-hidden="true">
                <tool.icon size={30} />
              </span>
              <span className="shelf-label">{tool.title}</span>
            </a>
          </li>
        ))}
        <li>
          <a
            className="shelf-item"
            href="#/compare"
            onPointerEnter={() => preloadTool('compare')}
            onFocus={() => preloadTool('compare')}
          >
            <span className="shelf-icon is-dashed" aria-hidden="true">
              <span className="shelf-ab">A↔B</span>
            </span>
            <span className="shelf-label">表格对比</span>
          </a>
        </li>
      </ul>
    </section>
  )
}

function ToolCard({ tool, big }: { tool: (typeof tools)[number]; big: boolean }) {
  const primary = tool.modes?.[0]
  return (
    <a
      className={`tool-card tb-reveal-y${big ? ' is-big' : ''}`}
      href={`#/${primary?.route ?? tool.id}`}
      style={{ '--tool-glow': `${tool.color}33` } as CSSProperties}
      onPointerEnter={() => preloadTool(primary?.route ?? tool.id)}
      onFocus={() => preloadTool(primary?.route ?? tool.id)}
    >
      <span className="hub-icon" style={{ background: tool.gradient }}>
        <tool.icon size={big ? 28 : 24} />
      </span>
      <div className="tool-card-body">
        <p className="tool-tags">{tool.tags.join(' · ')}</p>
        <h2>
          {tool.title}
          <ArrowUpRight size={16} />
        </h2>
        <p className="tool-card-tagline">{tool.tagline}</p>
        <p>{tool.description}</p>
        {big && (
          <ul className="tool-features">
            {tool.features.slice(0, 4).map((feature) => (
              <li key={feature.title}>
                <feature.icon size={15} style={{ color: tool.color }} aria-hidden="true" />
                {feature.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </a>
  )
}

function AllTools({
  favorites,
  onToggleFavorite,
}: {
  favorites: string[]
  onToggleFavorite: (id: string) => void
}) {
  return (
    <section className="all-tools">
      <h2 className="section-title">
        工具一览。
        <span className="section-sub">五个入口，覆盖日常文件杂事。</span>
      </h2>
      <div className="tool-grid">
        {tools.map((tool, index) => {
          const big = index < 2
          const favorite = favorites.includes(tool.id)
          return (
            <div key={tool.id} className={`tool-card-wrap tb-reveal ${SHELF_SPANS[index]}`}>
              <ToolCard tool={tool} big={big} />
              <div className="tool-card-foot">
                {tool.modes && (
                  <>
                    <a className="tool-btn" href={`#/${tool.modes[0].route}`}>
                      {tool.modes[0].label}
                    </a>
                    <a className="tool-alt" href={`#/${tool.modes[1].route}`}>
                      {tool.modes[1].label}
                      <ChevronRight size={15} />
                    </a>
                  </>
                )}
                {!tool.modes && (
                  <a className="tool-btn" href={`#/${tool.id}`}>
                    打开
                  </a>
                )}
                <a className="tool-more" href={`#cap-${tool.id}`}>
                  功能详解
                  <ChevronRight size={15} />
                </a>
              </div>
              <button
                type="button"
                className={`tool-favorite${favorite ? ' is-favorite' : ''}`}
                aria-pressed={favorite}
                aria-label={`${favorite ? '取消收藏' : '收藏'}${tool.title}`}
                onClick={() => onToggleFavorite(tool.id)}
              >
                <Star size={15} fill={favorite ? 'currentColor' : 'none'} />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function Capabilities() {
  const [active, setActive] = useState(tools[0].id)
  useEffect(() => {
    const sync = () => {
      const match = window.location.hash.match(/^#cap-(\w+)/)
      if (match && tools.some((tool) => tool.id === match[1])) {
        setActive(match[1])
        document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })
      }
    }
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const tool = tools.find((item) => item.id === active) ?? tools[0]
  return (
    <section id="capabilities" className="capabilities">
      <h2 className="section-title">
        功能详解。
        <span className="section-sub">每个工具都能做什么。</span>
      </h2>
      <div role="tablist" aria-label="选择工具" className="cap-tabs">
        {tools.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={item.id === active}
            aria-controls="cap-panel"
            className={`cap-tab${item.id === active ? ' is-active' : ''}`}
            onClick={() => setActive(item.id)}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div
        id="cap-panel"
        className="cap-panel tb-blur-in"
        role="tabpanel"
        aria-label={`${tool.title}功能详解`}
        key={tool.id}
      >
        <div className="cap-side">
          <span className="hub-icon cap-icon" style={{ background: tool.gradient }}>
            <tool.icon size={36} />
          </span>
          <p className="cap-title">{tool.title}</p>
          <p className="cap-tagline">{tool.tagline}</p>
          <p className="cap-label">使用限制</p>
          <ul className="cap-limits">
            {tool.limits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
          <div className="cap-actions">
            {(tool.modes ?? [{ route: tool.id, label: `打开${tool.title}` }]).map((mode, index) => (
              <a
                key={mode.route}
                className={index === 0 ? 'tool-btn' : 'tool-alt'}
                href={`#/${mode.route}`}
              >
                {mode.label}
                {index === 0 ? (
                  <ArrowUpRight size={15} aria-hidden="true" />
                ) : (
                  <ChevronRight size={15} aria-hidden="true" />
                )}
              </a>
            ))}
          </div>
        </div>
        <ul className="cap-grid">
          {tool.features.map((feature) => (
            <li key={feature.title}>
              <span
                className="cap-feature-icon"
                style={{ background: `${tool.color}1f`, color: tool.color }}
                aria-hidden="true"
              >
                <feature.icon size={20} />
              </span>
              <p className="cap-feature-title">{feature.title}</p>
              <p className="cap-feature-body">{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function Promises() {
  const shelf = useRef<HTMLDivElement>(null)
  const scroll = (direction: number) =>
    shelf.current?.scrollBy({ left: direction * 340, behavior: 'smooth' })
  return (
    <section id="promises" className="promises">
      <div className="promises-head">
        <h2 className="section-title">
          为什么放心。
          <span className="section-sub">简单、诚实、只在本地。</span>
        </h2>
        <div className="promises-arrows">
          <button type="button" aria-label="向左滚动" onClick={() => scroll(-1)}>
            <ChevronLeft size={18} />
          </button>
          <button type="button" aria-label="向右滚动" onClick={() => scroll(1)}>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="promises-shelf" ref={shelf} tabIndex={0} aria-label="本站承诺，横向滚动浏览">
        {PROMISES.map((promise) => (
          <div key={promise.title} className="promise-card tb-reveal">
            <promise.icon
              size={34}
              strokeWidth={1.6}
              style={{ color: promise.color }}
              aria-hidden="true"
            />
            <div>
              <p className="promise-title">{promise.title}</p>
              <p className="promise-body">{promise.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
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
  const online = useOnline()
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
          <a href="#/">工具箱</a>
          <ChevronRight size={13} aria-hidden="true" />
          <span className="tool-breadcrumb-current">{currentTool?.title}</span>
          <nav className="tool-switcher" aria-label="切换工具">
            {tools.map((tool) => (
              <a
                key={tool.id}
                href={`#/${tool.id}`}
                title={tool.title}
                aria-label={tool.title}
                aria-current={tool.id === toolId ? 'page' : undefined}
                onPointerEnter={() => preloadTool(tool.id)}
                onFocus={() => preloadTool(tool.id)}
              >
                <span
                  className="switcher-icon"
                  style={{ background: tool.gradient }}
                  aria-hidden="true"
                >
                  <tool.icon size={14} />
                </span>
              </a>
            ))}
            <a
              href="#/compare"
              title="表格对比"
              aria-label="表格对比"
              aria-current={route === 'compare' ? 'page' : undefined}
              onPointerEnter={() => preloadTool('compare')}
              onFocus={() => preloadTool('compare')}
            >
              <span className="switcher-icon is-dashed" aria-hidden="true">
                <GitCompare size={13} />
              </span>
            </a>
          </nav>
          <span className="tool-bar-divider" aria-hidden="true" />
          <ThemeToggle dark={dark} onToggle={() => setDark(!dark)} round />
        </div>
      )}
      {route === 'home' && (
        <main className="main-content tool-home">
          <Intro online={online} dark={dark} onToggleTheme={() => setDark(!dark)} />
          <IconShelf />
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
                      <span
                        className="chip-icon"
                        aria-hidden="true"
                        style={{ background: tool.gradient }}
                      >
                        <tool.icon size={13} />
                      </span>
                      {tool.title}
                      <Star size={13} fill="currentColor" aria-hidden="true" />
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
                      <span
                        className="chip-icon"
                        aria-hidden="true"
                        style={{ background: tool.gradient }}
                      >
                        <tool.icon size={13} />
                      </span>
                      {tool.title}
                    </a>
                  ) : null
                })}
              </div>
            </section>
          )}
          <AllTools
            favorites={favorites}
            onToggleFavorite={(id) =>
              setFavorites(toggleFavoriteTool(preferenceStorage, id, toolIds))
            }
          />
          <Capabilities />
          <Promises />
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
        <p className="toolbox-footer-note">
          文件和交接内容只留在当前标签页内存，不写入本地存储、不上传；刷新或关闭标签页即清空。本地仅保存主题、预设与收藏等偏好设置。
        </p>
        <div className="toolbox-footer-row">
          <OfflineStatus />
          <span>Copyright © {new Date().getFullYear()} VAR · hi-var.top</span>
          <a href="/">返回首页</a>
        </div>
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
