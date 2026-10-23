import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Check,
  FileText,
  FileType2,
  FileUp,
  Image,
  LoaderCircle,
  Table2,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { validateQueueFiles } from './lib/file-queue'
import { convertFileText, markdownTables, type TextConversion } from './lib/file-text'
import { convertImage, outputName, pdfToWord, wordToPdf, type OutputFile } from './lib/file-convert'

import { imagesToPdf, packOutputs, pdfToImages } from './lib/file-media'
import type { ImageSize } from './lib/media-options'
import { Textarea } from '@/components/ui/textarea'

const modes = {
  image: {
    category: 'image',
    title: '图片互转',
    accept: '.png,.jpg,.jpeg,.webp',
    hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素',
    note: 'JPG 透明区域填充白色；动画只转换第一帧，导出不保留原始元数据。',
  },
  'image-pdf': {
    category: 'image',
    title: '图片 → PDF',
    accept: '.png,.jpg,.jpeg,.webp',
    hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素',
    note: '按队列顺序，每张图片一页 A4，四周留白、透明背景填白；按 144 DPI 上限缩放，使用 JPG 编码。可拖动或用箭头排序。',
  },
  markdown: {
    category: 'text',
    title: 'Markdown → TXT',
    accept: '.md,.markdown',
    hint: 'Markdown 文件 · 单个 2 MB · UTF-8 编码',
    note: '去除格式标记，保留正文、代码和链接。',
  },
  'csv-json': {
    category: 'table',
    title: 'CSV → JSON',
    accept: '.csv',
    hint: '逗号分隔 CSV · 单个 2 MB · UTF-8 编码',
    note: '第一行作为列名，单元格保留为字符串，避免丢失编号中的前导零。',
  },
  'json-csv': {
    category: 'table',
    title: 'JSON → CSV',
    accept: '.json',
    hint: 'JSON 文件 · 单个 2 MB · UTF-8 编码',
    note: '支持对象数组，不含嵌套字段。疑似表格公式的文本会添加单引号保护。',
  },
  'csv-markdown': {
    category: 'table',
    title: '表格 → Markdown',
    accept: '.csv,.tsv',
    hint: 'CSV / TSV · 单个 2 MB · UTF-8 编码',
    note: '首行作为表头；也可以粘贴从 Excel 复制的表格内容。',
  },
  'markdown-csv': {
    category: 'table',
    title: 'Markdown → CSV',
    accept: '.md,.markdown',
    hint: 'Markdown 文件 · 单个 2 MB · UTF-8 编码',
    note: '提取文档中的 Markdown 表格，多张表格打包为 ZIP；疑似公式添加单引号保护。',
  },
  'pdf-image': {
    category: 'office',
    title: 'PDF → 图片',
    accept: '.pdf',
    hint: 'PDF · 单个 10 MB · 最多 50 页 · 144 DPI',
    note: '支持扫描件。多页图片打包为 ZIP；长图最多 2400 万像素、高度 16384 px，不支持加密 PDF。',
  },
  'word-pdf': {
    category: 'office',
    title: 'Word → PDF',
    accept: '.docx',
    hint: 'DOCX 文档 · 单个 10 MB · 最多输出 50 页',
    note: '导出图片版 A4 PDF，文字无法选中。复杂分页、字体和表格可能变化，建议核对结果；不支持旧版 .doc。',
  },
  'pdf-word': {
    category: 'office',
    title: 'PDF → Word',
    accept: '.pdf',
    hint: '文字型 PDF · 单个 10 MB · 最多 50 页',
    note: '提取文字生成可编辑 DOCX，不保留图片、表格和原排版。不支持扫描件或加密 PDF。',
  },
} as const
const categories = [
  { id: 'image', title: '图片', icon: Image },
  { id: 'text', title: '文本', icon: FileText },
  { id: 'table', title: '表格', icon: Table2 },
  { id: 'office', title: '办公文档', icon: FileType2 },
] as const
type Mode = keyof typeof modes
const modeKeys = Object.keys(modes) as Mode[]
type Row = {
  id: string
  file: File
  status: 'waiting' | 'working' | 'done' | 'error'
  message?: string
  output?: OutputFile & { url: string }
}
const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`

export default function FileTool({ active = true }: { active?: boolean }) {
  const [mode, setMode] = useState<Mode>('image')
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png')
  const [imageSize, setImageSize] = useState<ImageSize>('original')
  const [pdfFormat, setPdfFormat] = useState<'png' | 'jpeg'>('png')
  const [pdfLayout, setPdfLayout] = useState<'pages' | 'long'>('pages')
  const [pages, setPages] = useState('')
  const [tablePaste, setTablePaste] = useState('')
  const [merged, setMerged] = useState<(OutputFile & { url: string }) | null>(null)
  const moving = useRef<string | null>(null)
  const [quality, setQuality] = useState(90)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [packing, setPacking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const current = urls.current
    return () => {
      mounted.current = false
      for (const url of current) URL.revokeObjectURL(url)
      current.clear()
    }
  }, [])
  const reset = () => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current.clear()
    setRows([])
    setMerged(null)
    setTablePaste('')
  }
  const chooseMode = (next: Mode) => {
    if (next !== mode && !running.current && !packing) {
      reset()
      setMode(next)
    }
  }
  const clearOutputs = () => {
    setMerged(null)
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current.clear()
    setRows((previous) =>
      previous.map((row) => ({ id: row.id, file: row.file, status: 'waiting' })),
    )
  }
  const removeRow = (row: Row) => {
    if (running.current || packing) return
    if (row.output) {
      URL.revokeObjectURL(row.output.url)
      urls.current.delete(row.output.url)
    }
    if (mode === 'image-pdf') clearOutputs()
    setRows((previous) => previous.filter((item) => item.id !== row.id))
  }
  const addFiles = (files: File[]) => {
    if (running.current || packing || !files.length) return
    const limit = modes[mode].category === 'image' ? 20 : modes[mode].category === 'office' ? 10 : 2
    try {
      validateQueueFiles(
        rows.map((row) => row.file),
        files,
        modes[mode].accept,
        limit,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    if (mode === 'image-pdf') clearOutputs()
    setRows((previous) => [
      ...previous,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting' as const })),
    ])
  }
  useEffect(() => {
    if (!active || (mode !== 'image' && mode !== 'image-pdf')) return
    const pasted = (event: ClipboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input,textarea'))
      )
        return
      const images = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file)
      if (!images.length) return
      event.preventDefault()
      addFiles(
        images.map(
          (file, index) =>
            new File(
              [file],
              `截图-${Date.now()}-${index + 1}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`,
              { type: file.type },
            ),
        ),
      )
    }
    window.addEventListener('paste', pasted)
    return () => window.removeEventListener('paste', pasted)
  })
  const moveRow = (id: string, to: number) => {
    if (running.current || packing || to < 0 || to >= rows.length) return
    clearOutputs()
    setRows((previous) => {
      const next = [...previous]
      const from = next.findIndex((row) => row.id === id)
      if (from < 0) return previous
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }
  const run = async () => {
    if (running.current || !rows.length) return
    running.current = true
    setBusy(true)
    let bytes = 0
    try {
      if (mode === 'image-pdf') {
        setRows((previous) =>
          previous.map((row) => ({ ...row, status: 'working', message: '正在合并' })),
        )
        try {
          const output = await imagesToPdf(
            rows.map((row) => row.file),
            (message) => {
              if (mounted.current)
                setRows((previous) => previous.map((row) => ({ ...row, message })))
            },
          )
          if (output.blob.size > 100 * 1024 * 1024)
            throw new Error('输出超过 100 MB，请减少图片数量。')
          if (!mounted.current) return
          const url = URL.createObjectURL(output.blob)
          urls.current.add(url)
          setMerged({ ...output, url })
          setRows((previous) =>
            previous.map((row) => ({ ...row, status: 'done', message: '已合并' })),
          )
        } catch (error) {
          if (mounted.current)
            setRows((previous) =>
              previous.map((row) => ({
                ...row,
                status: 'error',
                message: error instanceof Error ? error.message : '合并失败，请检查图片。',
              })),
            )
        }
        return
      }
      for (const row of rows) {
        if (!mounted.current) break
        if (row.output) {
          bytes += row.output.blob.size
          continue
        }
        const update = (patch: Partial<Row>) => {
          if (mounted.current)
            setRows((previous) =>
              previous.map((item) => (item.id === row.id ? { ...item, ...patch } : item)),
            )
        }
        update({ status: 'working', message: '正在转换' })
        try {
          const progress = (message: string) => update({ message })
          let output: OutputFile
          if (mode === 'image')
            output = await convertImage(row.file, format, quality / 100, imageSize)
          else if (mode === 'pdf-image')
            output = await pdfToImages(
              row.file,
              { pages, format: pdfFormat, layout: pdfLayout },
              progress,
            )
          else if (mode === 'pdf-word') output = await pdfToWord(row.file, progress)
          else if (mode === 'word-pdf') output = await wordToPdf(row.file, progress)
          else {
            const source = new TextDecoder('utf-8', { fatal: true }).decode(
              await row.file.arrayBuffer(),
            )
            if (mode === 'markdown-csv') {
              const outputs = markdownTables(source).map((text, index) => ({
                name: outputName(row.file.name, `table-${index + 1}.csv`),
                blob: new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }),
              }))
              output =
                outputs.length === 1
                  ? outputs[0]
                  : await packOutputs(outputs, outputName(row.file.name, 'tables.zip'))
            } else {
              const text = convertFileText(
                source,
                mode as TextConversion,
                row.file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',',
              )
              const extension =
                mode === 'markdown'
                  ? 'txt'
                  : mode === 'csv-json'
                    ? 'json'
                    : mode === 'csv-markdown'
                      ? 'md'
                      : 'csv'
              output = {
                name: outputName(row.file.name, extension),
                blob: new Blob([extension === 'json' || extension === 'md' ? '' : '\uFEFF', text], {
                  type: `${extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv' : extension === 'md' ? 'text/markdown' : 'text/plain'};charset=utf-8`,
                }),
              }
            }
          }
          if (bytes + output.blob.size > 100 * 1024 * 1024)
            throw new Error('输出总大小超过 100 MB，请减少文件数量。')
          bytes += output.blob.size
          if (!mounted.current) break
          const url = URL.createObjectURL(output.blob)
          urls.current.add(url)
          update({ status: 'done', message: undefined, output: { ...output, url } })
        } catch (error) {
          update({
            status: 'error',
            message:
              error instanceof TypeError
                ? '读取失败，请检查文件是否损坏；文本请使用 UTF-8 编码。'
                : error instanceof Error
                  ? error.message
                  : '转换失败，请检查文件格式。',
          })
        }
      }
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const zip = async () => {
    setPacking(true)
    try {
      const output = await packOutputs(
        rows.flatMap((row, i) =>
          row.output ? [{ ...row.output, name: `${i + 1}-${row.output.name}` }] : [],
        ),
        '转换结果.zip',
      )
      const url = URL.createObjectURL(output.blob)
      urls.current.add(url)
      const link = document.createElement('a')
      link.href = url
      link.download = '转换结果.zip'
      link.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        urls.current.delete(url)
      }, 1000)
    } catch {
      toast.error('打包失败，请逐个下载文件。')
    } finally {
      setPacking(false)
    }
  }
  const done = rows.filter((row) => row.status === 'done').length
  return (
    <main className="main-content file-tool">
      <section className="intro">
        <h1>文件格式转换</h1>
      </section>
      <Tabs
        value={modes[mode].category}
        onValueChange={(value) => {
          const first = modeKeys.find((key) => modes[key].category === value)
          if (first) chooseMode(first)
        }}
        className="conversion-groups"
      >
        <TabsList className="conversion-categories" aria-label="文件类别">
          {categories.map(({ id, title, icon: Icon }) => (
            <TabsTrigger key={id} value={id} disabled={busy || packing}>
              <Icon size={15} />
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={modes[mode].category} className="conversion-content">
          <div
            className="conversion-modes"
            role="group"
            aria-label={`${categories.find((category) => category.id === modes[mode].category)?.title}转换方式`}
          >
            {modeKeys
              .filter((key) => modes[key].category === modes[mode].category)
              .map((key) => (
                <button
                  key={key}
                  disabled={busy || packing}
                  aria-pressed={mode === key}
                  onClick={() => chooseMode(key)}
                >
                  {modes[key].title}
                </button>
              ))}
          </div>
          <section className="conversion-panel" aria-label={modes[mode].title}>
            <div className="conversion-toolbar">
              <div>
                <strong>{modes[mode].title}</strong>
                <span>
                  {mode === 'image-pdf'
                    ? '按队列顺序合并'
                    : modes[mode].category === 'image'
                      ? '支持直接粘贴截图'
                      : '支持多文件依次转换'}
                </span>
              </div>
              {mode === 'image' && (
                <div className="image-options">
                  <label>
                    输出格式
                    <Select
                      disabled={busy || packing}
                      value={format}
                      onValueChange={(value) => {
                        clearOutputs()
                        setFormat(value as typeof format)
                      }}
                    >
                      <SelectTrigger aria-label="输出格式">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="png">PNG</SelectItem>
                        <SelectItem value="jpeg">JPG</SelectItem>
                        <SelectItem value="webp">WebP</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  <label>
                    尺寸
                    <Select
                      disabled={busy || packing}
                      value={imageSize}
                      onValueChange={(value) => {
                        clearOutputs()
                        setImageSize(value as ImageSize)
                      }}
                    >
                      <SelectTrigger aria-label="图片尺寸">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="original">原尺寸</SelectItem>
                        <SelectItem value="1920">宽度 ≤ 1920</SelectItem>
                        <SelectItem value="1280">宽度 ≤ 1280</SelectItem>
                        <SelectItem value="half">缩放 50%</SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                  {format !== 'png' && (
                    <label>
                      质量 {quality}%
                      <input
                        type="range"
                        aria-label="图片质量"
                        min="10"
                        max="100"
                        disabled={busy || packing}
                        value={quality}
                        onChange={(event) => {
                          clearOutputs()
                          setQuality(Number(event.target.value))
                        }}
                      />
                    </label>
                  )}
                </div>
              )}
            </div>
            {mode === 'pdf-image' && (
              <div className="image-options pdf-options">
                <label>
                  输出格式
                  <Select
                    disabled={busy || packing}
                    value={pdfFormat}
                    onValueChange={(value) => {
                      clearOutputs()
                      setPdfFormat(value as typeof pdfFormat)
                    }}
                  >
                    <SelectTrigger aria-label="PDF 图片格式">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="png">PNG</SelectItem>
                      <SelectItem value="jpeg">JPG</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  导出方式
                  <Select
                    disabled={busy || packing}
                    value={pdfLayout}
                    onValueChange={(value) => {
                      clearOutputs()
                      setPdfLayout(value as typeof pdfLayout)
                    }}
                  >
                    <SelectTrigger aria-label="PDF 导出方式">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pages">逐页图片</SelectItem>
                      <SelectItem value="long">拼成长图</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  页码
                  <input
                    className="page-range"
                    aria-label="PDF 页码"
                    disabled={busy || packing}
                    placeholder="全部页，如 1,3-5"
                    value={pages}
                    onChange={(event) => {
                      clearOutputs()
                      setPages(event.target.value)
                    }}
                  />
                </label>
              </div>
            )}
            <button
              type="button"
              className={`file-drop ${dragging ? 'is-dragging' : ''}`}
              disabled={busy || packing}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                if (!packing) addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <span className="file-drop-icon">
                {mode === 'image' ? <Image size={25} /> : <FileUp size={25} />}
              </span>
              <strong>
                {rows.length ? '继续添加文件，或拖到这里' : '点击选择文件，或拖到这里'}
              </strong>
              <span>{modes[mode].hint}</span>
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={modes[mode].accept}
              className="sr-only"
              aria-label="选择待转换文件"
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
            {mode === 'csv-markdown' && (
              <div className="table-paste">
                <Textarea
                  aria-label="粘贴表格内容"
                  placeholder="在此粘贴从 Excel 复制的表格（首行作为表头）"
                  value={tablePaste}
                  disabled={busy || packing}
                  onChange={(event) => setTablePaste(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!tablePaste.trim() || busy || packing}
                  onClick={() => {
                    addFiles([
                      new File([tablePaste], `粘贴表格-${Date.now()}.tsv`, {
                        type: 'text/tab-separated-values',
                      }),
                    ])
                  }}
                >
                  加入队列
                </Button>
              </div>
            )}
            <p className="conversion-note">{modes[mode].note}</p>
            {!!rows.length && (
              <div className="file-queue">
                {rows.map((row, index) => (
                  <div
                    key={row.id}
                    className="file-row"
                    onDragOver={(event) => {
                      if (mode === 'image-pdf' && moving.current) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (!moving.current) return
                      event.preventDefault()
                      moveRow(moving.current, index)
                      moving.current = null
                    }}
                  >
                    {mode === 'image-pdf' && (
                      <div className="file-order">
                        <span
                          draggable={!busy && !packing}
                          aria-label={`拖动排序 ${row.file.name}`}
                          title="拖动排序，或使用下方箭头"
                          onDragStart={(event) => {
                            moving.current = row.id
                            event.dataTransfer.setData('text/plain', row.id)
                            event.dataTransfer.effectAllowed = 'move'
                          }}
                          onDragEnd={() => {
                            moving.current = null
                          }}
                        >
                          <GripVertical size={14} />
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`上移 ${row.file.name}`}
                          disabled={busy || packing || index === 0}
                          onClick={() => moveRow(row.id, index - 1)}
                        >
                          <ArrowUp size={13} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`下移 ${row.file.name}`}
                          disabled={busy || packing || index === rows.length - 1}
                          onClick={() => moveRow(row.id, index + 1)}
                        >
                          <ArrowDown size={13} />
                        </Button>
                      </div>
                    )}
                    <div className={`file-state state-${row.status}`}>
                      {row.status === 'working' ? (
                        <LoaderCircle className="animate-spin" size={18} />
                      ) : row.status === 'done' ? (
                        <Check size={18} />
                      ) : row.status === 'error' ? (
                        <X size={18} />
                      ) : (
                        <FileUp size={18} />
                      )}
                    </div>
                    <div className="file-details">
                      <strong>{row.file.name}</strong>
                      <span
                        className={row.status === 'error' ? 'file-error' : ''}
                        role={row.status === 'error' ? 'alert' : 'status'}
                      >
                        {row.message ||
                          (row.output
                            ? `${row.output.name} · ${sizeLabel(row.output.blob.size)}`
                            : sizeLabel(row.file.size))}
                      </span>
                    </div>
                    {row.output && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={row.output.url} download={row.output.name}>
                          <ArrowDownToLine size={14} />
                          下载
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="remove-file"
                      aria-label={`移除 ${row.file.name}`}
                      disabled={busy || packing}
                      onClick={() => removeRow(row)}
                    >
                      <X size={15} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            {merged && (
              <div className="merged-result">
                <span>
                  <Check size={16} />
                  {merged.name} · {sizeLabel(merged.blob.size)}
                </span>
                <Button size="sm" variant="outline" asChild>
                  <a href={merged.url} download={merged.name}>
                    <ArrowDownToLine size={14} />
                    下载 PDF
                  </a>
                </Button>
              </div>
            )}
            <div className="conversion-actions">
              <Button variant="ghost" disabled={!rows.length || busy || packing} onClick={reset}>
                <Trash2 size={14} />
                清空
              </Button>
              <div>
                {done > 1 && mode !== 'image-pdf' && (
                  <Button variant="outline" disabled={busy || packing} onClick={zip}>
                    {packing ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <ArrowDownToLine size={14} />
                    )}
                    打包下载 ({done})
                  </Button>
                )}
                <Button
                  disabled={!rows.length || busy || packing || done === rows.length}
                  onClick={run}
                >
                  {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}
                  {busy ? '正在转换' : mode === 'image-pdf' ? '合并 PDF' : '开始转换'}
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  )
}
