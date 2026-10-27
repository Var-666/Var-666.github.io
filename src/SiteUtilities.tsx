import { OfflineStatus } from './OfflineStatus'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FileUp, Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToolTransfer } from './lib/tool-transfer'
import { searchHome } from './lib/home-search'
import { tools } from './lib/tools'

export function SiteUtilities({ route }: { route: string }) {
  const transfer = useToolTransfer()
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const picker = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    const found = searchHome(query, tools)
    return [
      ...found.tasks.map((task) => ({
        id: 'task-' + task.id,
        title: task.title,
        hash: task.hash,
        kind: '任务',
      })),
      ...found.tools.map((tool) => ({
        id: 'tool-' + tool.id,
        title: tool.title,
        hash: '#/' + tool.id,
        kind: '工具',
      })),
    ]
  }, [query])
  useEffect(() => {
    const keyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (document.querySelector('[role="dialog"][data-state="open"]') && !searchOpen) return
        setSearchOpen((value) => !value)
      }
    }
    const dragover = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    const dropped = (event: DragEvent) => {
      if (event.defaultPrevented || !event.dataTransfer?.files.length) return
      event.preventDefault()
      transfer?.openIntake({ files: Array.from(event.dataTransfer.files) })
    }
    const pasted = (event: ClipboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,[contenteditable="true"]') &&
        event.clipboardData?.getData('text/plain')
      )
        return
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length)
        queueMicrotask(() => {
          if (!event.defaultPrevented) transfer?.openIntake({ files })
        })
    }
    window.addEventListener('keydown', keyboard, true)
    window.addEventListener('dragover', dragover)
    window.addEventListener('drop', dropped)
    window.addEventListener('paste', pasted)
    return () => {
      window.removeEventListener('keydown', keyboard, true)
      window.removeEventListener('dragover', dragover)
      window.removeEventListener('drop', dropped)
      window.removeEventListener('paste', pasted)
    }
  }, [transfer, searchOpen])
  useEffect(() => {
    if (searchOpen)
      document.getElementById(`command-option-${selected}`)?.scrollIntoView({ block: 'nearest' })
  }, [searchOpen, selected])
  const choose = (hash: string) => {
    setSearchOpen(false)
    setMenuOpen(false)
    window.location.hash = hash
  }
  return (
    <>
      <input
        ref={picker}
        type="file"
        multiple
        className="sr-only"
        aria-label="选择文件并推荐任务"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) transfer?.openIntake({ files })
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        aria-label="选择文件并推荐工具"
        onClick={() => picker.current?.click()}
      >
        <FileUp size={17} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        aria-label="搜索工具与任务"
        title="搜索工具与任务（Ctrl / ⌘ K）"
        onClick={() => setSearchOpen(true)}
      >
        <Search size={17} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="mobile-tool-menu"
        aria-label="切换工具"
        onClick={() => setMenuOpen(true)}
      >
        <Menu size={17} />
      </Button>
      <Dialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open)
          if (open) {
            setQuery('')
            setSelected(0)
          }
        }}
      >
        <DialogContent className="utility-dialog">
          <DialogHeader>
            <DialogTitle>搜索工具与任务</DialogTitle>
            <DialogDescription>↑ ↓ 选择，Enter 打开</DialogDescription>
          </DialogHeader>
          <input
            className="tool-input"
            role="combobox"
            aria-label="搜索工具与任务"
            aria-controls="command-results"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-activedescendant={results[selected] ? `command-option-${selected}` : undefined}
            value={query}
            placeholder="例如：压缩图片、转 CSV、修复断行"
            onChange={(event) => {
              setQuery(event.target.value)
              setSelected(0)
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                if (results.length)
                  setSelected(
                    (value) =>
                      (value + (event.key === 'ArrowDown' ? 1 : -1) + results.length) %
                      results.length,
                  )
              }
              if (event.key === 'Enter' && results[selected]) {
                event.preventDefault()
                choose(results[selected].hash)
              }
            }}
          />
          <div
            id="command-results"
            className="command-results"
            role="listbox"
            aria-label="搜索结果"
          >
            {results.map((result, index) => (
              <a
                key={result.id}
                id={`command-option-${index}`}
                href={result.hash}
                role="option"
                aria-selected={selected === index}
                onMouseEnter={() => setSelected(index)}
                onClick={(event) => {
                  event.preventDefault()
                  choose(result.hash)
                }}
              >
                {result.title}
                <small>{result.kind}</small>
              </a>
            ))}
            {!results.length && <p>没有找到匹配的工具或任务。</p>}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
        <DialogContent className="utility-dialog">
          <DialogHeader>
            <DialogTitle>切换工具</DialogTitle>
            <DialogDescription>当前文件与结果会保留在本页</DialogDescription>
          </DialogHeader>
          <nav className="utility-links" aria-label="移动工具导航">
            <a
              href="#/"
              aria-current={route === 'home' ? 'page' : undefined}
              onClick={() => setMenuOpen(false)}
            >
              全部工具
            </a>
            {tools.map((tool) => (
              <a
                key={tool.id}
                href={`#/${tool.id}`}
                aria-current={route === tool.id ? 'page' : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {tool.title}
              </a>
            ))}
          </nav>
          <OfflineStatus />
        </DialogContent>
      </Dialog>
    </>
  )
}

export function HomeFileDrop() {
  const transfer = useToolTransfer()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        className="home-file-drop"
        onClick={() => input.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          transfer?.openIntake({ files: Array.from(event.dataTransfer.files) })
        }}
      >
        <FileUp size={20} />
        <strong>选择文件，或拖到这里</strong>
        <span>PDF · 图片 · Word · 表格 · 文本</span>
      </button>
      <input
        ref={input}
        type="file"
        multiple
        className="sr-only"
        aria-label="首页选择文件"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) transfer?.openIntake({ files })
        }}
      />
    </>
  )
}
