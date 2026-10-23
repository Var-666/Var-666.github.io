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
  ListFilter,
  LoaderCircle,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  processText,
  presets,
  baseOptions,
  textStats,
  type Options,
  type Preset,
  type ProcessResult,
} from '@/lib/text'
import { cn } from '@/lib/utils'
import { clipboardWithTimeout } from '@/lib/clipboard'

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
    const saved = JSON.parse(localStorage.getItem('liwen-settings') || 'null')
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
      ['keep', 'single', 'remove'].includes(options.blankLines)
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
function Rule({
  title,
  description,
  checked,
  onChange,
  id,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  id: string
}) {
  return (
    <div className="rule">
      <label htmlFor={id}>
        <span>{title}</span>
        {description && <small>{description}</small>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
export default function TextTool({ active }: { active: boolean }) {
  const [settings, setSettings] = useState(initialSettings)
  const { preset, options } = settings
  const [source, setSource] = useState('')
  const [result, setResult] = useState<ProcessResult>({ text: '', changes: [] })
  const [processing, setProcessing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [composing, setComposing] = useState(false)
  const [mobileTab, setMobileTab] = useState('source')
  const [copied, setCopied] = useState(false)
  const [undo, setUndo] = useState<string | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [importing, setImporting] = useState(false)
  useEffect(() => {
    if (!active) {
      setAdvancedOpen(false)
      setHelpOpen(false)
    }
  }, [active])
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  const fileInput = useRef<HTMLInputElement>(null)
  const input = useRef<HTMLTextAreaElement>(null)
  const output = useRef<HTMLTextAreaElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fileRequest = useRef(0)
  useEffect(() => {
    let instance: Worker | null = null
    try {
      instance = new Worker(new URL('./lib/text.worker.ts', import.meta.url), { type: 'module' })
      worker.current = instance
      instance.onmessage = ({ data }) => {
        if (data.id !== request.current) return
        setProcessing(false)
        if (data.error) {
          setFailed(true)
          toast.error(data.error)
        } else {
          setResult(data.result)
          setFailed(false)
        }
      }
      instance.onerror = () => {
        instance?.terminate()
        worker.current = null
        setFailed(true)
        setProcessing(false)
        toast.error('处理线程暂时不可用，请修改文字重试，或刷新页面。')
      }
    } catch {
      worker.current = null
    }
    return () => {
      instance?.terminate()
      worker.current = null
      if (copyTimer.current) clearTimeout(copyTimer.current)
    }
  }, [])
  useEffect(() => {
    const id = ++request.current
    setCopied(false)
    setFailed(false)
    if (composing) {
      setProcessing(true)
      return
    }
    if (!source) {
      setResult({ text: '', changes: [] })
      setProcessing(false)
      return
    }
    setProcessing(true)
    const timer = setTimeout(() => {
      if (worker.current) worker.current.postMessage({ id, text: source, options })
      else {
        setResult(processText(source, options))
        setProcessing(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [source, options, composing])
  useEffect(() => {
    try {
      localStorage.setItem('liwen-settings', JSON.stringify(settings))
    } catch {
      /* optional */
    }
  }, [settings])
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if (active && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
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
  const replaceSource = (text: string) => {
    fileRequest.current++
    setImporting(false)
    if (text.length > maxChars) {
      toast.error('一次最多处理 100 万字符，请拆分后导入。')
      return false
    }
    setUndo(source)
    setSource(text)
    setMobileTab('source')
    return true
  }
  const loadSample = () => {
    replaceSource(presets[preset].sample)
    toast.success('已载入当前场景的示例')
  }
  const importFile = async (file?: File) => {
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
    setImporting(true)
    try {
      const bytes = await file.arrayBuffer()
      const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
      if (id !== fileRequest.current) return
      if (replaceSource(text)) toast.success(`已导入 ${file.name}`)
    } catch {
      if (id === fileRequest.current) toast.error('读取失败，请使用 UTF-8 编码的文本文件。')
    } finally {
      if (id === fileRequest.current) setImporting(false)
    }
  }
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
  const sourceStats = useMemo(() => textStats(source), [source])
  const resultStats = useMemo(() => textStats(result.text), [result.text])
  const changeCount = result.changes.reduce((total, change) => total + change.count, 0)
  const ready = !!result.text && !processing && !failed
  const rule = (key: keyof Options, title: string, description?: string) => (
    <Rule
      key={key}
      id={`option-${key}`}
      title={title}
      description={description}
      checked={!!options[key]}
      onChange={(value) => update(key, value as never)}
    />
  )
  const blankSelect = (
    <div className="rule">
      <label htmlFor="blank-lines">
        空白行处理<small>按需要保留段落之间的留白</small>
      </label>
      <Select
        value={options.blankLines}
        onValueChange={(value) => update('blankLines', value as Options['blankLines'])}
      >
        <SelectTrigger id="blank-lines" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="keep">全部保留</SelectItem>
          <SelectItem value="single">最多留一行</SelectItem>
          <SelectItem value="remove">全部删除</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
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
                <label>
                  <Switch
                    aria-label="连接断行"
                    checked={options.repairBreaks}
                    onCheckedChange={(value) => update('repairBreaks', value)}
                  />
                  <span>连接断行</span>
                </label>
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
              <span className="shortcut">⌘ K</span>
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
                    setSource(event.target.value)
                  }}
                  onCompositionStart={() => setComposing(true)}
                  onCompositionEnd={() => setComposing(false)}
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
                <span className="encoding-label">纯文本 · UTF-8</span>
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
                <Textarea
                  ref={output}
                  aria-label="整理结果"
                  className="text-editor result-editor"
                  value={result.text}
                  readOnly
                  spellCheck={false}
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
            </div>
          )}
        </section>
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
      <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <DialogContent className="settings-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 size={18} />
              整理设置
            </DialogTitle>
            <DialogDescription>
              当前场景：{presets[preset].title}。所有规则都从原文重新处理。
            </DialogDescription>
          </DialogHeader>
          <div className="settings-scroll">
            <div className="settings-section">
              <span className="settings-label">空格与空行</span>
              {rule('trimLines', '清理行首行尾空格', '移除每行两端的空格和制表符')}
              {rule('collapseSpaces', '合并连续空格', '将多个空格或制表符合并成一个空格')}
              {blankSelect}
            </div>
            <Accordion type="multiple" defaultValue={['scene']}>
              <AccordionItem value="scene">
                <AccordionTrigger>场景规则</AccordionTrigger>
                <AccordionContent>
                  {rule(
                    'markdownPlain',
                    'Markdown 转纯文本',
                    '保留正文、代码和链接；表格转成制表符分隔的文本',
                  )}
                  {rule(
                    'repairBreaks',
                    '修复 PDF 断行',
                    '规则推测连接断句；尽量保留段落、列表与链接',
                  )}
                  {rule('dedupe', '删除重复行', '保留第一次出现的行与原有顺序')}
                  {rule('ignoreWhitespace', '去重时忽略首尾空格')}
                  {rule('ignoreCase', '去重时忽略英文大小写')}
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="typography">
                <AccordionTrigger>中文排版</AccordionTrigger>
                <AccordionContent>
                  {rule('fullwidth', '全角字符转半角', '转换全角英文字母、数字、符号与空格')}
                  {rule('cjkSpacing', '调整中英文间距', '在汉字与英文字母、数字之间补一个空格')}
                  {rule(
                    'chinesePunctuation',
                    '转换中文标点',
                    '含中文的片段中转换逗号、冒号等，保护链接与小数',
                  )}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
          <div className="dialog-footer">
            <Button
              variant="outline"
              onClick={() => {
                choosePreset(preset)
                toast.success('已恢复当前场景的默认规则')
              }}
            >
              <RotateCcw size={14} />
              恢复默认
            </Button>
            <Button onClick={() => setAdvancedOpen(false)}>
              完成
              <Check size={14} />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
                  直接输入、粘贴，或拖入 UTF-8 编码的 TXT / Markdown 文件。支持最大 2 MB 文件、100
                  万字符。
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
