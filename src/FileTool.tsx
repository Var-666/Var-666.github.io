import { useEffect, useMemo, useRef, useState } from 'react'
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
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { validateQueueFiles } from './lib/file-queue'
import { convertFileText, markdownTables, type TextConversion } from './lib/file-text'
import {
  convertImage,
  openPdf,
  outputName,
  pdfToWord,
  wordToPdf,
  type OutputFile,
  type PdfToWordResult,
  type WordToPdfResult,
} from './lib/file-convert'
import {
  pdfToWordReport,
  previewFailureIssue,
  verifyDocxBlob,
  verifyPdfBlob,
  wordToPdfReport,
  type ConvertReport,
} from './lib/convert-report'
import { previewLayout } from './lib/pdf-preview'
import {
  csvFileToExcel,
  jsonHeaderNotices,
  loadWorkbook,
  parseCsvMatrix,
  sheetNotices,
  sheetToCsv,
  sheetToJson,
  sheetToMarkdown,
  isSafeNumberText,
  type WorkbookData,
} from './lib/file-excel'
import { cn } from '@/lib/utils'

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
  'excel-csv': {
    category: 'table',
    title: 'Excel → CSV',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '按单元格显示值导出：保留文本单元格原值、数字格式渲染的前导零与日期显示形式；公式取缓存结果。CSV 含 BOM 并对疑似公式加保护。',
  },
  'excel-json': {
    category: 'table',
    title: 'Excel → JSON',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '第一行作为字段名，单元格保留显示文本；空表头按「列N」、重复表头加序号后缀，预览中会提示。不保留样式、公式与合并单元格。',
  },
  'excel-md': {
    category: 'table',
    title: 'Excel → Markdown',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '首行作为表头；竖线、换行等特殊字符安全转义，与表格 → Markdown 使用同一套规则。',
  },
  'csv-excel': {
    category: 'table',
    title: 'CSV → Excel',
    accept: '.csv',
    hint: '逗号分隔 CSV · 单个 2 MB · UTF-8 编码',
    note: '默认全部按文本写入 .xlsx，保留前导零与长编号；可开启「尝试识别数字」，只转换无前导零、非科学计数的明确数字。',
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
    note: '在浏览器中渲染 Word 页面并生成图片型 A4 PDF：适合浏览与视觉交付，文字无法选择、复制或搜索；字体、分页与复杂排版可能变化，建议核对预览；不支持旧版 .doc。',
  },
  'pdf-word': {
    category: 'office',
    title: 'PDF → Word',
    accept: '.pdf',
    hint: '文字型 PDF · 单个 10 MB · 最多 50 页',
    note: '提取 PDF 中的文字生成可编辑 DOCX：不保留图片、表格、页眉页脚与原排版；扫描件无法提取文字（需要 OCR），加密与含无文字页的文件会被拒绝，避免遗漏内容。',
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
  report?: ConvertReport
  detail?: { kind: 'pdf'; file: File } | { kind: 'text'; text: string }
  showDetail?: boolean
}
const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`

export default function FileTool({ active = true }: { active?: boolean }) {
  const [mode, setMode] = useState<Mode>('image')
  const isExcelRead = mode === 'excel-csv' || mode === 'excel-json' || mode === 'excel-md'
  const [excel, setExcel] = useState<{ file: File; workbook: WorkbookData } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [detectNumbers, setDetectNumbers] = useState(false)
  const [csvPreview, setCsvPreview] = useState<{
    file: File
    rows: string[][]
    notices: string[]
  } | null>(null)
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
    setExcel(null)
    setSheetName('')
    setCsvPreview(null)
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
  const markPreviewError = (id: string) => {
    setRows((previous) =>
      previous.map((row) =>
        row.id === id && row.report && row.report.status !== 'preview-error'
          ? {
              ...row,
              report: {
                status: 'preview-error',
                issues: [...row.report.issues, previewFailureIssue],
                metrics: row.report.metrics,
              },
            }
          : row,
      ),
    )
  }
  const removeRow = (row: Row) => {
    if (running.current || packing) return
    if (row.output) {
      URL.revokeObjectURL(row.output.url)
      urls.current.delete(row.output.url)
    }
    if (mode === 'image-pdf' || isExcelRead) clearOutputs()
    setRows((previous) => previous.filter((item) => item.id !== row.id))
  }
  const addFiles = (files: File[]) => {
    if (running.current || packing || !files.length) return
    if (isExcelRead && rows.length + files.length > 1) {
      toast.error('一次转换一个工作簿，请先移除当前文件')
      return
    }
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
  // Excel 读取模式：工作簿只解析一次，结果缓存；失败时保留文件并显示原因
  useEffect(() => {
    if (!isExcelRead) return
    const row = rows[0]
    if (rows.length !== 1 || !row || row.status === 'error') {
      setExcel(null)
      setSheetName('')
      return
    }
    if (excel?.file === row.file) return
    let cancelled = false
    setExcel(null)
    setSheetName('')
    loadWorkbook(row.file)
      .then((workbook) => {
        if (cancelled) return
        setExcel({ file: row.file, workbook })
        setSheetName(workbook.sheets[0]?.name ?? '')
      })
      .catch((error) => {
        if (cancelled) return
        setRows((previous) =>
          previous.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: 'error',
                  message: error instanceof Error ? error.message : '无法读取工作簿',
                }
              : item,
          ),
        )
      })
    return () => {
      cancelled = true
    }
  }, [rows, mode, excel, isExcelRead])
  // CSV → Excel：解析第一个文件用于预览（数字识别在渲染时应用）
  useEffect(() => {
    if (mode !== 'csv-excel') return
    const row = rows[0]
    if (!row || row.status === 'error') {
      setCsvPreview(null)
      return
    }
    if (csvPreview?.file === row.file) return
    let cancelled = false
    ;(async () => {
      try {
        const text = new TextDecoder('utf-8', { fatal: true }).decode(await row.file.arrayBuffer())
        const parsed = parseCsvMatrix(text)
        if (!cancelled)
          setCsvPreview({ file: row.file, rows: parsed.rows, notices: parsed.notices })
      } catch (error) {
        if (cancelled) return
        setCsvPreview(null)
        setRows((previous) =>
          previous.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: 'error',
                  message: error instanceof Error ? error.message : '读取失败，请检查文件与编码。',
                }
              : item,
          ),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rows, mode, csvPreview])
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
          else if (isExcelRead) {
            if (!excel) throw new Error('工作簿尚未读取完成，请稍候再试。')
            const sheet = excel.workbook.sheet(sheetName)
            const base = `${excel.file.name.replace(/\.[^.]+$/, '')}-${sheet.name.replace(/[/\\?%*:|"<>]/g, ' ')}`
            if (mode === 'excel-csv')
              output = {
                blob: new Blob(['\uFEFF', sheetToCsv(sheet)], { type: 'text/csv;charset=utf-8' }),
                name: outputName(base, 'csv'),
              }
            else if (mode === 'excel-json')
              output = {
                blob: new Blob([sheetToJson(sheet).text], {
                  type: 'application/json;charset=utf-8',
                }),
                name: outputName(base, 'json'),
              }
            else
              output = {
                blob: new Blob([sheetToMarkdown(sheet)], { type: 'text/markdown;charset=utf-8' }),
                name: outputName(base, 'md'),
              }
          } else if (mode === 'csv-excel')
            output = await csvFileToExcel(row.file, { detectNumbers })
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
          let report: ConvertReport | undefined
          let detail: Row['detail']
          if (mode === 'word-pdf' && 'pages' in output) {
            progress('正在校验输出')
            const result = output as WordToPdfResult
            report = wordToPdfReport({
              pages: result.pages,
              sections: result.sections,
              failedSections: result.failedSections,
              bytes: result.blob.size,
              verify: await verifyPdfBlob(result.blob),
            })
            detail = {
              kind: 'pdf',
              file: new File([result.blob], result.name, { type: 'application/pdf' }),
            }
          } else if (mode === 'pdf-word' && 'chars' in output) {
            progress('正在校验输出')
            const result = output as PdfToWordResult
            report = pdfToWordReport({
              pages: result.pages,
              chars: result.chars,
              paragraphs: result.paragraphs,
              bytes: result.blob.size,
              docxValid: await verifyDocxBlob(result.blob),
            })
            detail = { kind: 'text', text: result.text }
          }
          const url = URL.createObjectURL(output.blob)
          urls.current.add(url)
          update({ status: 'done', message: undefined, output: { ...output, url }, report, detail })
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
  // 选中的工作表在渲染时物化（内部有缓存，同一工作表只解析一次）
  const excelPreview = useMemo(() => {
    if (!isExcelRead || !excel || !sheetName) return null
    try {
      const data = excel.workbook.sheet(sheetName)
      const notices = [...sheetNotices(data)]
      if (mode === 'excel-json') notices.push(...jsonHeaderNotices(data.rows[0] ?? []))
      return { data, notices }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '无法读取工作表', notices: [] }
    }
  }, [excel, sheetName, mode, isExcelRead])
  const excelPending = isExcelRead && !!rows.length && !excel
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
            {mode === 'csv-excel' && (
              <div className="image-options excel-options">
                <label className="number-toggle">
                  <Switch
                    aria-label="尝试识别数字"
                    checked={detectNumbers}
                    disabled={busy || packing}
                    onCheckedChange={(value) => {
                      clearOutputs()
                      setDetectNumbers(value)
                    }}
                  />
                  <span>
                    尝试识别数字
                    <small>仅转换无前导零、非科学计数的普通数字；编号与长整数保持文本</small>
                  </span>
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
                  <div key={row.id} className="file-row-group">
                    <div
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
                              ? `${row.output.name} · ${sizeLabel(row.output.blob.size)}${
                                  row.report?.status === 'notes'
                                    ? ' · 有注意事项'
                                    : row.report?.status === 'preview-error'
                                      ? ' · 预览失败'
                                      : ''
                                }`
                              : sizeLabel(row.file.size))}
                        </span>
                      </div>
                      {row.output && row.report && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="detail-toggle"
                          disabled={busy || packing}
                          onClick={() =>
                            setRows((previous) =>
                              previous.map((item) =>
                                item.id === row.id
                                  ? { ...item, showDetail: !item.showDetail }
                                  : item,
                              ),
                            )
                          }
                        >
                          {row.showDetail ? '收起详情' : '结果详情'}
                        </Button>
                      )}
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
                    {row.showDetail && row.report && (
                      <div className="convert-detail">
                        <div className="convert-detail-metrics">
                          {row.report.metrics.map((metric) => (
                            <span key={metric.label}>
                              {metric.label} <b>{metric.value}</b>
                            </span>
                          ))}
                        </div>
                        {row.report.issues.map((issue) => (
                          <p
                            key={issue.text}
                            className={
                              issue.level === 'warning' ? 'convert-issue warning' : 'convert-issue'
                            }
                          >
                            {issue.text}
                          </p>
                        ))}
                        {row.detail?.kind === 'pdf' && (
                          <PdfResultPreview
                            file={row.detail.file}
                            onError={() => markPreviewError(row.id)}
                          />
                        )}
                        {row.detail?.kind === 'text' && (
                          <TextResultPreview text={row.detail.text} />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {mode === 'csv-excel' && csvPreview && (
              <div className="excel-panel">
                <div className="excel-panel-head">
                  <strong>预览：{csvPreview.file.name}</strong>
                  <span>
                    {detectNumbers ? '识别出的数字将按数值写入，其余为文本' : '全部按文本写入'}
                  </span>
                </div>
                <MatrixPreview
                  rows={csvPreview.rows}
                  notices={csvPreview.notices}
                  markNumbers={detectNumbers}
                />
              </div>
            )}
            {isExcelRead && excel && (
              <div className="excel-panel">
                <div className="excel-panel-head">
                  <label className="excel-sheet-select">
                    工作表
                    <Select
                      value={sheetName}
                      disabled={busy || packing}
                      onValueChange={(value) => {
                        clearOutputs()
                        setSheetName(value)
                      }}
                    >
                      <SelectTrigger aria-label="选择工作表">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {excel.workbook.sheets.map((sheet) => (
                          <SelectItem key={sheet.name} value={sheet.name}>
                            {sheet.name}（{sheet.rows} 行 × {sheet.cols} 列）
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                  <span className="excel-sheet-info">
                    {excel.file.name} · {sizeLabel(excel.file.size)} →{' '}
                    {mode === 'excel-csv'
                      ? 'CSV'
                      : mode === 'excel-json'
                        ? 'JSON'
                        : 'Markdown 表格'}
                  </span>
                </div>
                {excelPreview?.error ? (
                  <p className="excel-error" role="alert">
                    {excelPreview.error}
                  </p>
                ) : excelPreview?.data ? (
                  <MatrixPreview rows={excelPreview.data.rows} notices={excelPreview.notices} />
                ) : null}
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
                  disabled={!rows.length || busy || packing || done === rows.length || excelPending}
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
// 数据预览：仅渲染有限行与列，避免大表生成海量 DOM
function MatrixPreview({
  rows,
  notices,
  markNumbers = false,
}: {
  rows: string[][]
  notices: string[]
  markNumbers?: boolean
}) {
  if (!rows.length) return <p className="excel-error">没有可读取的数据。</p>
  const shown = rows.slice(0, 21)
  const totalCols = rows[0]?.length ?? 0
  return (
    <div className="excel-preview">
      <div className="matrix-scroll">
        <div className="matrix-table" role="table" aria-label="数据预览（前 20 行）">
          {shown.map((row, index) => (
            <div className={cn('matrix-row', index === 0 && 'matrix-head')} role="row" key={index}>
              {row.slice(0, 50).map((cell, col) => (
                <span
                  className={cn(
                    'matrix-cell',
                    markNumbers && index > 0 && isSafeNumberText(cell) && 'is-number',
                  )}
                  role="cell"
                  key={col}
                  title={cell || undefined}
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="matrix-meta">
        共 {rows.length.toLocaleString()} 行 × {totalCols} 列
        {rows.length > 20 ? ' · 预览前 20 行' : ''}
        {totalCols > 50 ? ' · 仅显示前 50 列' : ''} · 首行样式仅便于阅读
      </div>
      {notices.map((notice) => (
        <p className="matrix-notice" key={notice}>
          {notice}
        </p>
      ))}
    </div>
  )
}

const textPreviewLimit = 80_000
// PDF → Word：预览即实际写入 DOCX 的文本，超长截断显示
function TextResultPreview({ text }: { text: string }) {
  const clipped = text.length > textPreviewLimit
  return (
    <div className="text-result-preview">
      <pre>{clipped ? text.slice(0, textPreviewLimit) : text}</pre>
      <span className="text-result-note">
        以上为写入 Word 的实际文字
        {clipped ? `，内容较长仅显示前 ${textPreviewLimit / 10000} 万字符，完整内容请下载查看` : ''}
      </span>
    </div>
  )
}

// Word → PDF：逐页懒渲染结果预览，与下载文件同源；失败只提示预览问题，不影响下载
function PdfResultPreview({ file, onError }: { file: File; onError: () => void }) {
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [failed, setFailed] = useState('')
  const [loading, setLoading] = useState(true)
  const canvas = useRef<HTMLCanvasElement>(null)
  const holder = useRef<HTMLDivElement>(null)
  const session = useRef<{ loader?: PDFDocumentLoadingTask; task?: RenderTask }>({})
  const errorRef = useRef(onError)
  useEffect(() => {
    errorRef.current = onError
  })
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    openPdf(file)
      .then(async (task) => {
        const pdf = await task.promise
        if (cancelled) {
          await task.destroy()
          return
        }
        session.current.loader = task
        setTotal(pdf.numPages)
      })
      .catch(() => {
        if (!cancelled) {
          setFailed('预览生成失败，转换文件本身已生成，可下载后查看。')
          errorRef.current()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      session.current.task?.cancel()
      void session.current.loader?.destroy().catch(() => undefined)
      session.current = {}
    }
  }, [file])
  useEffect(() => {
    let cancelled = false
    const loader = session.current.loader
    const target = canvas.current
    if (!loader || !target || !page || failed) return
    setLoading(true)
    void (async () => {
      try {
        const pdf = await loader?.promise
        if (!pdf) throw new Error('preview closed')
        const pdfPage = await pdf.getPage(page)
        if (cancelled) return
        const base = pdfPage.getViewport({ scale: 1 })
        const available = Math.max(280, (holder.current?.clientWidth || 560) - 16)
        const layout = previewLayout(
          base.width,
          base.height,
          available,
          760,
          null,
          window.devicePixelRatio || 1,
        )
        const context = target.getContext('2d')
        if (!context) throw new Error('canvas')
        target.width = layout.width
        target.height = layout.height
        target.style.width = `${layout.cssWidth}px`
        target.style.height = `${layout.cssHeight}px`
        const viewport = pdfPage.getViewport({ scale: layout.renderScale })
        session.current.task?.cancel()
        const task = pdfPage.render({ canvas: target, canvasContext: context, viewport })
        session.current.task = task
        await task.promise
        pdfPage.cleanup()
      } catch (error) {
        if (cancelled) return
        if (!(error instanceof Error && error.name === 'RenderingCancelledException')) {
          setFailed('页面渲染失败，转换文件本身已生成，可下载后查看。')
          errorRef.current()
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [page, total, failed])
  if (failed) return <p className="convert-issue warning">{failed}</p>
  return (
    <div className="pdf-result-preview" ref={holder}>
      <div className="pdf-preview-canvas">
        {loading && <span className="pdf-preview-loading">正在渲染预览…</span>}
        <canvas ref={canvas} aria-label={`转换结果预览 第 ${page} 页`} />
      </div>
      <div className="pdf-preview-nav">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((value) => value - 1)}
        >
          上一页
        </Button>
        <span>{total ? `第 ${page} / ${total} 页` : '读取中…'}</span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= total || loading}
          onClick={() => setPage((value) => value + 1)}
        >
          下一页
        </Button>
      </div>
    </div>
  )
}
