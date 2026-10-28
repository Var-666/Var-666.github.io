import { useTextProcessing } from './text-tool/useTextProcessing'
import { OverlayMarks, type DiffMark } from './text-tool/DiffOverlay'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { TextSettingsDialog } from './text-tool/TextSettingsDialog'
import { OutputActions } from './components/OutputActions'
import { useTransferReceiver } from './lib/tool-transfer'
import { readTextFile, type TextEncoding, type DecodedText } from './lib/text-encoding'
import { TextEncodingSelect } from './components/TextEncodingSelect'
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import {
  AlignLeft,
  ArrowDownToLine,
  ArrowRight,
  Check,
  CheckCheck,
  CircleHelp,
  Clipboard,
  Copy,
  FileText,
  FileUp,
  Diff,
  ListFilter,
  LoaderCircle,
  Pin,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Type,
  WandSparkles,
  WrapText,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TextBatchOps } from './text-tool/TextBatchOps'
import {
  deleteUserPreset,
  readUserPresets,
  saveUserPreset,
  type StoredUserPreset,
} from './lib/storage'
import {
  presets,
  baseOptions,
  textStats,
  sanitizeOptions,
  KEEP_BREAK_MARK,
  type Options,
  type Preset,
} from '@/lib/text'
import { cn } from '@/lib/utils'
import { clipboardWithTimeout } from '@/lib/clipboard'
import { storageKeys } from '@/lib/storage'
import { DIFF_MAX_CHARS, type DiffHunk } from '@/lib/text-diff'

const icons = {
  clean: WandSparkles,
  pdf: WrapText,
  dedupe: ListFilter,
  chinese: Type,
  markdown: FileText,
}
const presetKeys = Object.keys(presets) as Preset[]
const maxChars = 1_000_000
function initialSettings(): { preset: Preset; options: Options } {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKeys.settings) || 'null')
    const options = { ...baseOptions, ...saved?.options }
    if (
      saved &&
      presetKeys.includes(saved.preset) &&
      saved.options &&
      typeof saved.options === 'object' &&
      !Array.isArray(saved.options) &&
      Object.keys(baseOptions).every(
        (key) => typeof options[key] === typeof baseOptions[key as keyof Options],
      ) &&
      ['keep', 'single', 'remove'].includes(options.blankLines) &&
      ['conservative', 'standard'].includes(options.repairMode)
    )
      return { preset: saved.preset, options }
  } catch {
    /* Storage is optional. */
  }
  return { preset: 'clean', options: presets.clean.options }
}
function IconButton({
  label,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} {...props}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
const previewLimit = 36
const markWhitespace = (text: string) => text.replace(/\n/g, '⏎').replace(/\t/g, '␉')
function recordPreview(source: string, result: string, hunk: DiffHunk) {
  const clip = (text: string) =>
    markWhitespace(text.slice(0, previewLimit)) + (text.length > previewLimit ? '…' : '')
  if (hunk.kind === 'remove')
    return <span className="old">{clip(source.slice(hunk.source.start, hunk.source.end))}</span>
  if (hunk.kind === 'add')
    return <span className="new">{clip(result.slice(hunk.result.start, hunk.result.end))}</span>
  return (
    <>
      <span className="old">{clip(source.slice(hunk.source.start, hunk.source.end))}</span>
      <span className="arrow">→</span>
      <span className="new">{clip(result.slice(hunk.result.start, hunk.result.end))}</span>
    </>
  )
}
export default function TextTool({ active }: { active: boolean }) {
  const [settings, setSettings] = useState(initialSettings)
  const { preset, options } = settings
  const [readEncoding, setReadEncoding] = useState<TextEncoding>('auto')
  const [sourceEncoding, setSourceEncoding] = useState<DecodedText['encoding'] | null>(null)
  const importedFile = useRef<File | null>(null)
  const [source, setSource] = useState('')
  const [composing, setComposing] = useState(false)
  const { result, processing, failed, diff, request } = useTextProcessing(
    source,
    options,
    composing,
  )
  const [mobileTab, setMobileTab] = useState('source')
  const [copied, setCopied] = useState(false)
  const [undo, setUndo] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  const [recordsOpen, setRecordsOpen] = useState(false)
  const [userPresets, setUserPresets] = useState<StoredUserPreset[]>(() =>
    readUserPresets(localStorage, Object.keys(presets), sanitizeOptions),
  )
  const [presetName, setPresetName] = useState('')
  const sourceOverlay = useRef<HTMLDivElement>(null)
  const resultOverlay = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) {
      setAdvancedOpen(false)
      setHelpOpen(false)
    }
  }, [active])
  const fileInput = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const output = useRef<HTMLTextAreaElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRequest = useRef(0)
  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current)
    },
    [],
  )
  useEffect(() => {
    setCopied(false)
  }, [source, options, composing])
  useEffect(() => {
    try {
      localStorage.setItem(storageKeys.settings, JSON.stringify(settings))
    } catch {
      /* optional */
    }
  }, [settings])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (
        active &&
        event.shiftKey &&
        (event.metaKey || event.ctrlKey) &&
        event.key.toLowerCase() === 'k'
      ) {
        event.preventDefault()
        setAdvancedOpen((value) => !value)
      }
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [active])
  const update = <K extends keyof Options>(key: K, value: Options[K]) =>
    setSettings((previous) => ({ ...previous, options: { ...previous.options, [key]: value } }))
  const choosePreset = (key: Preset) =>
    setSettings({ preset: key, options: { ...presets[key].options } })
  const applyUserPreset = (entry: StoredUserPreset) => {
    setSettings({ preset: entry.preset as Preset, options: sanitizeOptions(entry.options) })
    toast.success(`已应用自定义预设「${entry.name}」`)
  }
  const saveCurrentUserPreset = () => {
    const name = presetName.trim() || `我的预设 ${userPresets.length + 1}`
    setUserPresets(
      saveUserPreset(
        localStorage,
        { name, preset, options },
        Object.keys(presets),
        sanitizeOptions,
      ),
    )
    setPresetName('')
    toast.success(`已保存自定义预设「${name}」`)
  }
  const removeUserPreset = (id: string) => {
    setUserPresets(deleteUserPreset(localStorage, id, Object.keys(presets), sanitizeOptions))
  }
  const replaceSource = (text: string) => {
    fileRequest.current++
    setImporting(false)
    if (text.length > maxChars) {
      toast.error('一次最多处理 100 万字符，请拆分后导入。')
      return false
    }
    importedFile.current = null
    setSourceEncoding(null)
    setUndo(source)
    setSource(text)
    setMobileTab('source')
    return true
  }
  const loadSample = () => {
    replaceSource(presets[preset].sample)
    toast.success('已载入当前场景的示例')
  }
  const insertKeepMark = () => {
    const textarea = input.current
    const at = textarea
      ? Math.min(textarea.selectionStart ?? source.length, source.length)
      : source.length
    // 标记必须紧贴行尾才生效，因此插入到光标所在行的末尾（下一个换行符之前）
    const lineBreak = source.indexOf('\n', at)
    const insertAt = lineBreak === -1 ? source.length : lineBreak
    fileRequest.current++
    setImporting(false)
    setSource(`${source.slice(0, insertAt)}${KEEP_BREAK_MARK}${source.slice(insertAt)}`)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(
        insertAt + KEEP_BREAK_MARK.length,
        insertAt + KEEP_BREAK_MARK.length,
      )
    })
    toast.info('已在当前行尾插入保留标记：这一行的换行不会被合并')
  }
  const importFile = async (file?: File, encoding: TextEncoding = readEncoding) => {
    if (!file) return
    if (!/\.(txt|md)$/i.test(file.name)) {
      toast.error('请选择 TXT 或 Markdown 文本文件')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('文件需小于 2 MB')
      return
    }
    const id = ++fileRequest.current
    importedFile.current = file
    setImporting(true)
    try {
      const decoded = await readTextFile(file, encoding)
      if (id !== fileRequest.current) return
      if (replaceSource(decoded.text)) {
        importedFile.current = file
        setSourceEncoding(decoded.encoding)
        toast.success(`已导入 ${file.name} · 已按 ${decoded.encoding} 读取`)
      }
    } catch (error) {
      if (id === fileRequest.current)
        toast.error(error instanceof Error ? error.message : '读取失败，请检查文件编码。')
    } finally {
      if (id === fileRequest.current) setImporting(false)
    }
  }
  useTransferReceiver('text', active && !importing, (request) => {
    if (request.preset) choosePreset(request.preset)
    if (request.text !== undefined) {
      if (replaceSource(request.text)) toast.success('已接收文字，可撤销返回原文')
      return
    }
    const file = request.files?.[0]
    if (!file) return
    if (!/\.pdf$/i.test(file.name)) {
      void importFile(file)
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('PDF 单个不超过 10 MB')
      return
    }
    const id = ++fileRequest.current
    setImporting(true)
    void import('./lib/file-convert')
      .then((module) => module.pdfToText(file, () => {}))
      .then((result) => {
        if (id === fileRequest.current && replaceSource(result.text))
          toast.success('已提取 PDF 文字，可继续修复断行')
      })
      .catch((error) => {
        if (id === fileRequest.current)
          toast.error(error instanceof Error ? error.message : 'PDF 文字提取失败')
      })
      .finally(() => {
        if (id === fileRequest.current) setImporting(false)
      })
  })
  const paste = async () => {
    const id = ++fileRequest.current
    setImporting(false)
    try {
      if (!navigator.clipboard?.readText) throw new Error('clipboard unavailable')
      const text = await clipboardWithTimeout(() => navigator.clipboard.readText())
      if (id !== fileRequest.current) return
      if (!text) {
        toast.info('剪贴板里还没有文字')
        return
      }
      replaceSource(text)
    } catch {
      if (id === fileRequest.current) {
        input.current?.focus()
        toast.info('请在原文框中按 Ctrl / ⌘ + V 粘贴文字')
      }
    }
  }
  const copy = async () => {
    const id = request.current
    try {
      await clipboardWithTimeout(() => navigator.clipboard.writeText(result.text))
      if (id !== request.current) return
      setCopied(true)
      toast.success('整理结果已复制')
      if (copyTimer.current) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2200)
    } catch {
      if (id === request.current) {
        setMobileTab('result')
        requestAnimationFrame(() => {
          output.current?.focus()
          output.current?.select()
        })
        toast.info('已选中结果，请按 Ctrl / ⌘ + C 复制')
      }
    }
  }
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(['\uFEFF', result.text], { type: 'text/plain;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = `理文-${new Date().toISOString().slice(0, 10)}.txt`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    toast.success('已开始下载 TXT 文件')
  }
  const textOutput = useMemo(
    () => ({
      name: `理文-${new Date().toISOString().slice(0, 10)}.txt`,
      blob: new Blob(['\uFEFF', result.text], { type: 'text/plain;charset=utf-8' }),
    }),
    [result.text],
  )
  const sourceStats = useMemo(() => textStats(source), [source])
  const resultStats = useMemo(() => textStats(result.text), [result.text])
  const changeCount = result.changes.reduce((total, change) => total + change.count, 0)
  const ready = !!result.text && !processing && !failed
  const sourceMarks = useMemo<DiffMark[]>(
    () =>
      diff?.flatMap((hunk) =>
        hunk.sourceRuns.map((run) => ({ ...run, hunk: hunk.id, side: 'del' as const })),
      ) ?? [],
    [diff],
  )
  const resultMarks = useMemo<DiffMark[]>(
    () =>
      diff?.flatMap((hunk) =>
        hunk.resultRuns.map((run) => ({ ...run, hunk: hunk.id, side: 'ins' as const })),
      ) ?? [],
    [diff],
  )
  // 差异碎块过多时放弃覆盖层渲染，避免超大 DOM 拖慢输入
  const marksTooMany = sourceMarks.length + resultMarks.length > 4000
  const syncOverlayWidths = () => {
    for (const [textarea, overlay] of [
      [input.current, sourceOverlay.current],
      [output.current, resultOverlay.current],
    ] as const) {
      if (textarea && overlay) overlay.style.width = `${textarea.clientWidth}px`
    }
  }
  useEffect(() => {
    if (marksTooMany) return
    const observer = new ResizeObserver(syncOverlayWidths)
    for (const textarea of [input.current, output.current]) if (textarea) observer.observe(textarea)
    syncOverlayWidths()
    return () => observer.disconnect()
  }, [marksTooMany, diff])
  const locate = (hunk: DiffHunk) => {
    const side: 'source' | 'result' = hunk.kind === 'remove' ? 'source' : 'result'
    if (mobileTab !== side) setMobileTab(side)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const overlay = (side === 'source' ? sourceOverlay : resultOverlay).current
        const textarea = (side === 'source' ? input : output).current
        const span = overlay?.querySelector<HTMLElement>(`[data-hunk="${hunk.id}"]`)
        if (!overlay || !textarea || !span) return
        const top = Math.max(0, span.offsetTop - overlay.clientHeight / 3)
        textarea.scrollTo({ top })
        overlay.scrollTop = top
        span.classList.remove('diff-flash')
        void span.offsetWidth
        span.classList.add('diff-flash')
      })
    })
  }
  return (
    <TooltipProvider delayDuration={200}>
      <main className="main-content">
        <section className="intro">
          <h1>文本整理</h1>
          <div className="tool-title-actions">
            <Button variant="ghost" size="sm" onClick={() => setHelpOpen(true)}>
              <CircleHelp size={15} />
              使用指南
            </Button>
            <Button variant="outline" onClick={loadSample} className="sample-top">
              <Sparkles size={15} />
              试试示例文本
            </Button>
          </div>
        </section>
        <div className="text-import-options">
          <TextEncodingSelect
            value={readEncoding}
            disabled={importing}
            onChange={(value) => {
              setReadEncoding(value)
              if (importedFile.current) void importFile(importedFile.current, value)
            }}
          />
          {sourceEncoding && (
            <span className="encoding-note">
              已按 {sourceEncoding} 读取 · 切换编码可重新读取，支持撤销
            </span>
          )}
        </div>
        <section aria-label="选择整理场景" className="presets">
          <div className="preset-grid">
            {presetKeys.map((key) => {
              const Icon = icons[key]
              return (
                <button
                  key={key}
                  className={cn('preset-card', preset === key && 'selected')}
                  onClick={() => choosePreset(key)}
                  aria-pressed={preset === key}
                >
                  <span className={`preset-icon preset-${key}`}>
                    <Icon size={20} strokeWidth={1.8} />
                  </span>
                  <span className="preset-copy">
                    <strong>{presets[key].title}</strong>
                  </span>
                  <span className="preset-check">
                    {preset === key ? <Check size={12} strokeWidth={3} /> : null}
                  </span>
                </button>
              )
            })}
          </div>
          {!!userPresets.length && (
            <div className="user-presets" aria-label="自定义预设">
              {userPresets.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="user-preset-chip"
                  aria-label={`应用自定义预设 ${entry.name}`}
                  onClick={() => applyUserPreset(entry)}
                >
                  <Star size={12} />
                  {entry.name}
                </button>
              ))}
            </div>
          )}
        </section>
        <section id="workspace" className="workbench" aria-label="文本整理工作台">
          <div className="rules-bar">
            <div className="rule-bar-label">
              <Settings2 size={15} />
              <span>整理规则</span>
            </div>
            <div className="quick-rules">
              {preset === 'markdown' ? (
                <label>
                  <Switch
                    aria-label="移除 Markdown 格式"
                    checked={options.markdownPlain}
                    onCheckedChange={(value) => update('markdownPlain', value)}
                  />
                  <span>移除格式</span>
                </label>
              ) : (
                <label>
                  <Switch
                    aria-label="清理首尾空格"
                    checked={options.trimLines}
                    onCheckedChange={(value) => update('trimLines', value)}
                  />
                  <span>首尾空格</span>
                </label>
              )}
              {preset === 'markdown' ? (
                <label>
                  <Switch
                    aria-label="清理首尾空格"
                    checked={options.trimLines}
                    onCheckedChange={(value) => update('trimLines', value)}
                  />
                  <span>首尾空格</span>
                </label>
              ) : preset === 'pdf' ? (
                <>
                  <label>
                    <Switch
                      aria-label="连接断行"
                      checked={options.repairBreaks}
                      onCheckedChange={(value) => update('repairBreaks', value)}
                    />
                    <span>连接断行</span>
                  </label>
                  <Select
                    value={options.repairMode}
                    onValueChange={(value) => update('repairMode', value as Options['repairMode'])}
                  >
                    <SelectTrigger aria-label="断行修复模式" className="repair-mode-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">保守修复</SelectItem>
                      <SelectItem value="standard">标准修复</SelectItem>
                    </SelectContent>
                  </Select>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="keep-mark-button"
                        onClick={insertKeepMark}
                      >
                        <Pin size={14} />
                        <span>保留换行</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      在光标处插入 ⟦保留换行⟧：标记前的换行不会被合并，结果中自动移除标记
                    </TooltipContent>
                  </Tooltip>
                </>
              ) : preset === 'dedupe' ? (
                <label>
                  <Switch
                    aria-label="忽略大小写"
                    checked={options.ignoreCase}
                    onCheckedChange={(value) => update('ignoreCase', value)}
                  />
                  <span>忽略大小写</span>
                </label>
              ) : preset === 'chinese' ? (
                <label>
                  <Switch
                    aria-label="中英间距"
                    checked={options.cjkSpacing}
                    onCheckedChange={(value) => update('cjkSpacing', value)}
                  />
                  <span>中英间距</span>
                </label>
              ) : (
                <label>
                  <Switch
                    aria-label="合并多余空格"
                    checked={options.collapseSpaces}
                    onCheckedChange={(value) => update('collapseSpaces', value)}
                  />
                  <span>多余空格</span>
                </label>
              )}
              <label>
                <Switch
                  aria-label="清理多余空行"
                  checked={options.blankLines !== 'keep'}
                  onCheckedChange={(value) => update('blankLines', value ? 'single' : 'keep')}
                />
                <span>多余空行</span>
              </label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="advanced-button"
              onClick={() => setAdvancedOpen(true)}
            >
              <Settings2 size={14} />
              <span>全部设置</span>
              <span className="shortcut">⌘ ⇧ K</span>
            </Button>
          </div>
          <Tabs value={mobileTab} onValueChange={setMobileTab} className="mobile-tabs">
            <TabsList className="w-full" aria-label="编辑视图">
              <TabsTrigger
                className="flex-1"
                value="source"
                id="source-tab"
                aria-controls="source-panel"
              >
                原始文本
              </TabsTrigger>
              <TabsTrigger
                className="flex-1"
                value="result"
                id="result-tab"
                aria-controls="result-panel"
              >
                整理结果{source && <span className="tab-dot" />}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="editors">
            <section
              id="source-panel"
              role="tabpanel"
              aria-labelledby="source-tab"
              className={cn('editor-panel source-panel', mobileTab !== 'source' && 'mobile-hidden')}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void importFile(event.dataTransfer.files[0])
              }}
            >
              <div className="editor-header">
                <div>
                  <FileText size={16} />
                  <h2>原始文本</h2>
                  <span className="editor-tag">INPUT</span>
                </div>
                <div className="editor-tools">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInput.current?.click()}
                    disabled={importing}
                  >
                    {importing ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <FileUp size={14} />
                    )}
                    <span>导入</span>
                  </Button>
                  <IconButton
                    label="撤销上次替换或清空"
                    disabled={undo === null}
                    onClick={() => {
                      if (undo !== null) replaceSource(undo)
                    }}
                  >
                    <RotateCcw size={15} />
                  </IconButton>
                  <IconButton label="清空原文" disabled={!source} onClick={() => replaceSource('')}>
                    <Trash2 size={15} />
                  </IconButton>
                </div>
              </div>
              <div className={cn('editor-body', dragging && 'is-dragging')}>
                <div ref={sourceOverlay} className="diff-overlay" aria-hidden="true">
                  <OverlayMarks text={source} marks={marksTooMany ? [] : sourceMarks} />
                </div>
                <Textarea
                  ref={input}
                  aria-label="原始文本"
                  value={source}
                  className="text-editor"
                  spellCheck={false}
                  maxLength={maxChars}
                  onChange={(event) => {
                    fileRequest.current++
                    setImporting(false)
                    importedFile.current = null
                    setSourceEncoding(null)
                    setSource(event.target.value)
                  }}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
                  onScroll={(event) => {
                    const overlay = sourceOverlay.current
                    if (overlay) {
                      overlay.scrollTop = event.currentTarget.scrollTop
                      overlay.scrollLeft = event.currentTarget.scrollLeft
                    }
                  }}
                  placeholder={source ? undefined : '在这里输入或粘贴文字…'}
                />
                {!source && (
                  <div className="input-empty">
                    <div className="empty-icon">
                      <Clipboard size={25} strokeWidth={1.4} />
                    </div>
                    <p>粘贴文字，或拖入 TXT / Markdown 文件</p>
                    <Button variant="outline" onClick={paste}>
                      <Clipboard size={14} />
                      粘贴文本<span className="key-hint">⌘ V</span>
                    </Button>
                    <button className="text-link" onClick={loadSample}>
                      试试示例 <ArrowRight size={12} />
                    </button>
                  </div>
                )}
                {dragging && (
                  <div className="drop-overlay">
                    <FileUp size={30} />
                    <strong>松开鼠标，导入文本</strong>
                    <span>支持 TXT / Markdown · 最大 2 MB</span>
                  </div>
                )}
              </div>
              <div className="editor-footer">
                <span>
                  <b>{sourceStats.chars.toLocaleString()}</b> 字符
                  <span className="stat-divider" /> <b>{sourceStats.lines.toLocaleString()}</b> 行
                </span>
                <span className="encoding-label">纯文本 · {sourceEncoding ?? 'UTF-8'}</span>
              </div>
            </section>
            <span className="transfer-mark" aria-hidden="true">
              <ArrowRight size={16} />
            </span>
            <section
              id="result-panel"
              role="tabpanel"
              aria-labelledby="result-tab"
              className={cn('editor-panel result-panel', mobileTab !== 'result' && 'mobile-hidden')}
            >
              <div className="editor-header">
                <div>
                  <span className="result-dot" />
                  <h2>整理结果</h2>
                  <span className="preview-label">实时预览</span>
                </div>
                <div className="editor-tools">
                  {ready && <OutputActions outputs={[textOutput]} shareOnly />}
                  <IconButton label="下载 TXT 文件" disabled={!ready} onClick={download}>
                    <ArrowDownToLine size={16} />
                  </IconButton>
                  <Button size="sm" className="copy-button" disabled={!ready} onClick={copy}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已复制' : '复制结果'}
                  </Button>
                </div>
              </div>
              <div className="editor-body">
                <div ref={resultOverlay} className="diff-overlay" aria-hidden="true">
                  <OverlayMarks text={result.text} marks={marksTooMany ? [] : resultMarks} />
                </div>
                <Textarea
                  ref={output}
                  aria-label="整理结果"
                  className="text-editor result-editor"
                  value={result.text}
                  readOnly
                  spellCheck={false}
                  onScroll={(event) => {
                    const overlay = resultOverlay.current
                    if (overlay) {
                      overlay.scrollTop = event.currentTarget.scrollTop
                      overlay.scrollLeft = event.currentTarget.scrollLeft
                    }
                  }}
                />
                {!result.text && (
                  <div className="output-empty">
                    <span className="result-empty-icon">
                      <AlignLeft size={26} strokeWidth={1.4} />
                      <span>
                        <Check size={10} strokeWidth={3} />
                      </span>
                    </span>
                    <p>整理结果会显示在这里</p>
                  </div>
                )}
              </div>
              <div className="editor-footer">
                <span>
                  <b>{resultStats.chars.toLocaleString()}</b> 字符
                  <span className="stat-divider" />
                  <b>{resultStats.lines.toLocaleString()}</b> 行
                </span>
                <span className={cn('processing-state', failed && 'error-state')} role="status">
                  {failed ? (
                    <>
                      <X size={12} />
                      处理失败
                    </>
                  ) : processing ? (
                    <>
                      <LoaderCircle className="animate-spin" size={12} />
                      整理中
                    </>
                  ) : (
                    <>
                      <Check size={12} />
                      {source ? '整理完成' : '等待输入'}
                    </>
                  )}
                </span>
              </div>
            </section>
          </div>
          {source && !processing && !failed && (
            <>
              <div className="workbench-bottom">
                <div className="changes-summary" aria-live="polite">
                  <CheckCheck size={15} />
                  <span>
                    {changeCount ? (
                      <>
                        已整理 <strong>{changeCount}</strong> 处细节
                      </>
                    ) : (
                      '无需修改'
                    )}
                  </span>
                  {result.changes.slice(0, 2).map((change) => (
                    <span className="change-chip" key={change.label}>
                      {change.label} {change.count}
                    </span>
                  ))}
                </div>
                <div className="workbench-bottom-right">
                  {diff === null && (
                    <span
                      className="diff-skip-hint"
                      title={`差异高亮最多支持 ${DIFF_MAX_CHARS / 10000} 万字符`}
                    >
                      文本较长，未生成差异高亮
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="records-toggle"
                    aria-expanded={recordsOpen}
                    disabled={!diff?.length}
                    onClick={() => setRecordsOpen((value) => !value)}
                  >
                    <Diff size={14} />
                    修改明细{diff?.length ? `（${diff.length}）` : ''}
                  </Button>
                </div>
              </div>
              {recordsOpen && !!diff?.length && (
                <div className="diff-records" aria-label="修改明细">
                  <div className="diff-records-head">
                    <span>
                      共 {diff.length} 处变化 · 新增 {diff.filter((h) => h.kind === 'add').length} ·
                      删除 {diff.filter((h) => h.kind === 'remove').length} · 替换{' '}
                      {diff.filter((h) => h.kind === 'replace').length}
                    </span>
                    <span className="diff-records-tip">
                      {marksTooMany ? '差异过多，定位已停用' : '点击定位到对应位置'}
                    </span>
                  </div>
                  <ul className="diff-records-list">
                    {diff.slice(0, 200).map((hunk) => (
                      <li key={hunk.id}>
                        <button
                          className="diff-record"
                          disabled={marksTooMany}
                          onClick={() => locate(hunk)}
                        >
                          <span
                            className={`diff-badge ${
                              hunk.kind === 'add'
                                ? 'diff-badge-ins'
                                : hunk.kind === 'remove'
                                  ? 'diff-badge-del'
                                  : 'diff-badge-mod'
                            }`}
                          >
                            {hunk.kind === 'add'
                              ? '新增'
                              : hunk.kind === 'remove'
                                ? '删除'
                                : '替换'}
                          </span>
                          <span className="diff-record-text">
                            {recordPreview(source, result.text, hunk)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {diff.length > 200 && (
                    <div className="diff-records-more">仅显示前 200 处，共 {diff.length} 处</div>
                  )}
                </div>
              )}
            </>
          )}
        </section>
        <TextBatchOps
          active={active}
          source={source}
          onApply={replaceSource}
          processOptions={options}
        />
      </main>
      <input
        type="file"
        accept=".txt,.md,text/plain,text/markdown"
        className="sr-only"
        aria-label="导入文本文件"
        ref={fileInput}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          void importFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />
      <TextSettingsDialog
        advancedOpen={advancedOpen}
        setAdvancedOpen={setAdvancedOpen}
        preset={preset}
        options={options}
        update={update}
        presetName={presetName}
        setPresetName={setPresetName}
        userPresets={userPresets}
        saveCurrentUserPreset={saveCurrentUserPreset}
        applyUserPreset={applyUserPreset}
        removeUserPreset={removeUserPreset}
        choosePreset={choosePreset}
      />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="help-dialog">
          <DialogHeader>
            <DialogTitle>和理文一起，整理好文字</DialogTitle>
            <DialogDescription>三个步骤，让复制来的文字清爽一点。</DialogDescription>
          </DialogHeader>
          <ol className="help-steps">
            <li>
              <span>01</span>
              <div>
                <strong>选择一个场景</strong>
                <p>
                  日常清理、PDF 断行修复、名单去重、中文排版或 MD
                  转纯文本。点击「试试示例文本」即可体验。
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>放入需要整理的文字</strong>
                <p>
                  直接输入、粘贴，或拖入 UTF-8 / GBK 编码的 TXT / Markdown 文件。支持最大 2 MB
                  文件、100 万字符。
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <strong>检查预览，复制带走</strong>
                <p>
                  结果会自动更新，原文始终保留。使用「全部设置」调整规则，完成后复制或下载 TXT。
                </p>
              </div>
            </li>
          </ol>
          <div className="help-note">
            <ShieldCheck size={18} />
            <p>
              文字在浏览器本地处理，不上传、不自动保存正文。关闭或刷新页面会清空文字，整理设置与主题会保存在当前浏览器。
            </p>
          </div>
          <p className="help-caveat">
            PDF
            断行修复使用规则推测，复杂表格、多栏内容和特殊列表可能需要手动调整。去重时如需精确比较空格，请同时关闭「清理行首行尾空格」与「去重时忽略首尾空格」。
          </p>
          <Button onClick={() => setHelpOpen(false)} className="w-full">
            开始整理
            <ArrowRight size={14} />
          </Button>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
