import { useUnsavedWork } from '../DraftGuard'
import { ImageEditOptions } from './components/ImageEditOptions'
import { defaultImageEdit } from './image-edit'
import { ConversionOptions } from './components/ConversionOptions'
import { useFileOptions } from './options'
import { OutputActions } from '../components/OutputActions'
import { useToolTransfer, useTransferReceiver, type ToolTransfer } from '../tool-transfer'
import { ConfirmImport } from '../components/ConfirmImport'
import { ContinueWith } from '../components/ContinueWith'
import { readTextFile, encodingNotices, type TextEncoding } from '../lib/text-encoding'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  Check,
  ChevronDown,
  FileUp,
  Image,
  Info,
  LoaderCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { validateQueueFiles } from '../lib/file-queue'
import { convertFileText, markdownTables, type TextConversion } from './file-text'
import {
  convertImage,
  outputName,
  pdfToWord,
  wordToPdf,
  type OutputFile,
  type PdfToWordResult,
  type WordToPdfResult,
} from './file-convert'
import {
  pdfToWordReport,
  previewFailureIssue,
  verifyDocxBlob,
  verifyPdfBlob,
  wordToPdfReport,
  type ConvertReport,
} from './convert-report'
import {
  csvFileToExcel,
  loadWorkbook,
  parseCsvMatrix,
  sheetToCsv,
  sheetToJson,
  sheetToMarkdown,
  type WorkbookData,
} from './file-excel'

import { imagesToPdf, packOutputs, pdfToImages } from './file-media'
import { sampleImageFiles } from './file-samples'
import { compressImageFile } from './image-compress'
import { Textarea } from '@/components/ui/textarea'
import { categories, modeKeys, modes, type Mode } from './modes'
import { sizeLabel, type Row } from './types'

import { FileQueue } from './components/FileQueue'
import { CsvExcelPreview, ExcelPreview } from './components/ExcelPreview'
import { ToolHead } from '../components/ToolHead'
import { TbCard, revealCard } from '../components/tb'
import { tools } from '../tools'

// 首页任务入口通过 #/files?mode=xxx 直达具体转换方式；非法值回退默认图片互转
const modeFromHash = (): Mode | null => {
  const param = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('mode')
  return param && modeKeys.includes(param as Mode) ? (param as Mode) : null
}

// 头部「说明与限制」胶囊使用的上限数据（与 TextTool/TableTool 同源）
const toolLimits = tools.find((tool) => tool.id === 'files')!.limits

export default function FileTool({ active = true }: { active?: boolean }) {
  const transfers = useToolTransfer()
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransfer | null>(null)
  useEffect(() => {
    if (!active) setIncomingTransfer(null)
  }, [active])
  const [mode, setMode] = useState<Mode>(() => modeFromHash() ?? 'image')
  // 头部「说明与限制」折叠开关（纯展示状态，照 TextTool/TableTool 先例）
  const [limitsOpen, setLimitsOpen] = useState(false)
  const automatic = ['markdown', 'csv-json', 'json-csv', 'csv-markdown', 'markdown-csv'].includes(
    mode,
  )
  const isExcelRead = mode === 'excel-csv' || mode === 'excel-json' || mode === 'excel-md'
  const [excel, setExcel] = useState<{ file: File; workbook: WorkbookData } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [csvPreview, setCsvPreview] = useState<{
    file: File
    rows: string[][]
    notices: string[]
  } | null>(null)
  const [fileOptions, setFileOptions] = useFileOptions()
  const [imageEdit, setImageEdit] = useState(defaultImageEdit)
  const {
    format,
    imageSize,
    quality,
    compressTarget,
    compressFormat,
    pdfFormat,
    pdfLayout,
    mergeSize,
    mergeOrientation,
    mergeFit,
    pages,
    detectNumbers,
  } = fileOptions
  const [readEncoding, setReadEncoding] = useState<TextEncoding>('auto')
  const [tablePaste, setTablePaste] = useState('')
  const [merged, setMerged] = useState<(OutputFile & { url: string }) | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  useUnsavedWork(rows.length > 0 || !!tablePaste)
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
      window.history.replaceState(null, '', `#/files?mode=${next}`)
    }
  }
  const clearOutputs = (message = '设置已更改，待重新转换') => {
    setMerged(null)
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current.clear()
    setRows((previous) =>
      previous.map((row) => ({ id: row.id, file: row.file, status: 'waiting', message })),
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
  const toggleDetail = (id: string) =>
    setRows((previous) =>
      previous.map((item) => (item.id === id ? { ...item, showDetail: !item.showDetail } : item)),
    )
  const removeRow = (row: Row) => {
    if (running.current || packing) return
    if (row.output) {
      URL.revokeObjectURL(row.output.url)
      urls.current.delete(row.output.url)
    }
    if (mode === 'image-pdf' || isExcelRead) clearOutputs('队列已更新，待重新转换')
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
    if (mode === 'image-pdf') clearOutputs('队列已更新，待重新合并')
    setRows((previous) => [
      ...previous,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting' as const })),
    ])
  }
  // 空态「载入示例」：点击时才用 Canvas 现生成两张示例 PNG（SSR 不触达），
  // 构造成 File 走既有 addFiles 校验入口，不绕过任何队列逻辑
  const loadSamples = async () => {
    try {
      addFiles(await sampleImageFiles())
    } catch {
      toast.error('示例图片生成失败，请重试。')
    }
  }
  const applyTransfer = (request: ToolTransfer) => {
    const next = request.mode ?? mode,
      files = request.files ?? []
    if (next === mode) {
      addFiles(files)
      return
    }
    try {
      const limit =
        modes[next].category === 'image' ? 20 : modes[next].category === 'office' ? 10 : 2
      validateQueueFiles([], files, modes[next].accept, limit)
      if (next.startsWith('excel-') && files.length > 1) throw new Error('一次转换一个工作簿。')
      reset()
      setMode(next)
      setRows(files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting' })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法导入')
    }
  }
  useTransferReceiver('files', active && !busy && !packing && !incomingTransfer, (request) => {
    if (request.mode && request.mode !== mode && rows.length) setIncomingTransfer(request)
    else applyTransfer(request)
  })
  useEffect(() => {
    const changed = () => {
      if (
        !active ||
        !/^#\/?files(?:\?|$)/.test(window.location.hash) ||
        transfers?.pending?.target === 'files' ||
        incomingTransfer
      )
        return
      const next = modeFromHash()
      if (!next || next === mode) return
      if (running.current || packing) {
        toast.info('正在处理，请完成后再切换转换方式')
        window.history.replaceState(null, '', `#/files?mode=${mode}`)
        return
      }
      const request: ToolTransfer = {
        id: crypto.randomUUID(),
        target: 'files',
        mode: next,
        files: [],
      }
      if (rows.length) setIncomingTransfer(request)
      else applyTransfer(request)
    }
    changed()
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
    // Re-check URL intent on route/readiness changes, not on unrelated queue previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, rows.length, busy, packing, transfers?.pending?.id, incomingTransfer])
  useEffect(() => {
    if (!active || (mode !== 'image' && mode !== 'image-pdf' && mode !== 'image-compress')) return
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
        const decoded = await readTextFile(row.file, readEncoding)
        const parsed = parseCsvMatrix(decoded.text)
        if (!cancelled)
          setCsvPreview({
            file: row.file,
            rows: parsed.rows,
            notices: [...encodingNotices(decoded.encoding), ...parsed.notices],
          })
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
  }, [rows, mode, csvPreview, readEncoding])
  const moveRow = (id: string, to: number) => {
    if (running.current || packing || to < 0 || to >= rows.length) return
    clearOutputs('顺序已更改，待重新合并')
    setRows((previous) => {
      const next = [...previous]
      const from = next.findIndex((row) => row.id === id)
      if (from < 0) return previous
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }
  const run = async (waitingOnly = false) => {
    if (running.current || !rows.length) return
    running.current = true
    setBusy(true)
    let bytes = rows.reduce((sum, row) => sum + (row.output?.blob.size ?? 0), 0)
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
            { size: mergeSize, orientation: mergeOrientation, fit: mergeFit },
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
        if (row.output) continue
        if (waitingOnly && row.status !== 'waiting') continue
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
          let rowNotices: string[] | undefined
          if (mode === 'image')
            output = await convertImage(row.file, format, quality / 100, imageSize, imageEdit)
          else if (mode === 'image-compress') {
            const compressed = await compressImageFile(row.file, {
              targetBytes: Number(compressTarget) * 1024,
              format: compressFormat,
              size: imageSize,
              edit: imageEdit,
            })
            output = compressed
            rowNotices = [
              `${sizeLabel(compressed.originalBytes)} → ${sizeLabel(compressed.blob.size)} · ${compressed.width}×${compressed.height} · 质量 ${Math.round(compressed.quality * 100)}%` +
                (compressed.metTarget
                  ? ''
                  : `；未能压到 ${compressTarget} KB，以上为可达成的最小结果`),
            ]
          } else if (mode === 'pdf-image')
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
          } else if (mode === 'csv-excel') {
            const converted = await csvFileToExcel(row.file, {
              detectNumbers,
              encoding: readEncoding,
            })
            output = converted
            rowNotices = encodingNotices(converted.encoding)
          } else {
            const decoded = await readTextFile(row.file, readEncoding)
            const source = decoded.text
            rowNotices = encodingNotices(decoded.encoding)
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
              const converted = convertFileText(
                source,
                mode as TextConversion,
                row.file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',',
                /\.(jsonl|ndjson)$/i.test(row.file.name),
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
                blob: new Blob(
                  [extension === 'json' || extension === 'md' ? '' : '\uFEFF', converted.text],
                  {
                    type: `${extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv' : extension === 'md' ? 'text/markdown' : 'text/plain'};charset=utf-8`,
                  },
                ),
              }
              rowNotices = [...rowNotices, ...converted.notices]
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
          update({
            status: 'done',
            message: undefined,
            output: { ...output, url },
            report,
            detail,
            notices: rowNotices,
          })
        } catch (error) {
          update({
            status: 'error',
            message:
              error instanceof TypeError
                ? '读取失败，请检查文件是否损坏或切换读取编码。'
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
  const autoRun = useEffectEvent(() => run(true))
  useEffect(() => {
    const requested = modeFromHash()
    if (
      active &&
      automatic &&
      !busy &&
      !packing &&
      !incomingTransfer &&
      transfers?.pending?.target !== 'files' &&
      (!requested || requested === mode) &&
      rows.some((row) => row.status === 'waiting')
    )
      void autoRun()
  }, [
    active,
    automatic,
    busy,
    packing,
    rows,
    mode,
    incomingTransfer,
    transfers?.pending?.id,
    transfers?.pending?.target,
  ])
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
  const excelPending = isExcelRead && !!rows.length && !excel
  // 队列卡标题展示用的上限（与 addFiles 的校验上限一致；工作簿读取模式恒为 1），仅用于展示
  const queueLimit = isExcelRead
    ? 1
    : modes[mode].category === 'image'
      ? 20
      : modes[mode].category === 'office'
        ? 10
        : 2
  // F7：拖放区 hint 与实际校验逻辑（validateQueueFiles）一致：
  // 队列最多 10 个文件、总计 50 MB；单个文件上限按类别 20 / 10 / 2 MB；扩展名来自当前模式 accept
  const queueHint = (() => {
    const formats = modes[mode].accept.replaceAll('.', '').split(',').join(' · ').toUpperCase()
    const perFile =
      modes[mode].category === 'image' ? 20 : modes[mode].category === 'office' ? 10 : 2
    return `${formats}，${modes[mode].category === 'image' ? '单张' : '单个'} ${perFile} MB，最多 10 个`
  })()
  const optionControls = (
    <ConversionOptions
      mode={mode}
      options={fileOptions}
      disabled={busy || packing}
      encoding={readEncoding}
      onEncodingChange={(value) => {
        clearOutputs()
        setCsvPreview(null)
        setReadEncoding(value)
      }}
      onChange={(patch) => {
        clearOutputs()
        setFileOptions((previous) => ({ ...previous, ...patch }))
      }}
    />
  )
  const done = rows.filter((row) => row.status === 'done').length
  const failed = rows.filter((row) => row.status === 'error').length
  return (
    <main className="main-content file-tool">
      <p className="sr-only" role="status" aria-atomic="true">
        {busy
          ? '正在转换文件，请稍候。'
          : rows.length
            ? `文件队列：${rows.length} 个文件，已完成 ${done} 个，失败 ${failed} 个。`
            : ''}
      </p>
      <ConfirmImport
        open={active && !!incomingTransfer}
        description="切换转换方式会替换当前文件队列和未下载结果。"
        onCancel={() => {
          setIncomingTransfer(null)
          window.location.hash = `#/files?mode=${mode}`
        }}
        onAccept={() => {
          if (incomingTransfer) applyTransfer(incomingTransfer)
          setIncomingTransfer(null)
        }}
      />
      <ToolHead
        toolId="files"
        actions={
          <button
            type="button"
            className="tool-limits-toggle"
            aria-expanded={limitsOpen}
            onClick={() => setLimitsOpen((value) => !value)}
          >
            <Info size={15} />
            说明与限制
            <ChevronDown size={15} className={limitsOpen ? 'is-open' : undefined} />
          </button>
        }
      />
      <div className={limitsOpen ? 'tool-limits-reveal' : 'tool-limits-reveal is-closed'}>
        <div className="tool-limits-panel">
          <ul>
            {toolLimits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="tool-body">
        <div className="tool-main">
          <Tabs
            value={modes[mode].category}
            onValueChange={(value) => {
              const first = modeKeys.find((key) => modes[key].category === value)
              if (first) chooseMode(first)
            }}
            className="flex flex-col gap-5"
          >
            <TbCard>
              <TabsList
                aria-label="文件类别"
                className="h-auto w-fit max-w-full flex-wrap justify-start rounded-[14px] bg-tb-chip p-1"
              >
                {categories.map(({ id, title, icon: Icon }) => (
                  <TabsTrigger
                    key={id}
                    value={id}
                    disabled={busy || packing}
                    className="gap-1.5 rounded-[10px] px-3.5 py-1.5 text-[14px] font-medium transition data-[state=active]:bg-tb-card data-[state=active]:text-tb-fg data-[state=active]:shadow-sm data-[state=inactive]:text-[#57575d] data-[state=inactive]:hover:text-tb-fg disabled:opacity-50 dark:data-[state=inactive]:text-tb-mute dark:data-[state=inactive]:hover:text-tb-fg"
                  >
                    <Icon size={15} />
                    {title}
                  </TabsTrigger>
                ))}
              </TabsList>
            </TbCard>
            <TabsContent value={modes[mode].category} className="mt-0 flex flex-col gap-5">
              <TbCard>
                <div className="-mx-1 overflow-x-auto px-1 pb-1">
                  <div
                    className="inline-flex w-max gap-1 rounded-[14px] bg-tb-chip p-1"
                    role="group"
                    aria-label={`${categories.find((category) => category.id === modes[mode].category)?.title}转换方式`}
                  >
                    {modeKeys
                      .filter((key) => modes[key].category === modes[mode].category)
                      .map((key) => (
                        <button
                          key={key}
                          type="button"
                          disabled={busy || packing}
                          aria-pressed={mode === key}
                          onClick={() => chooseMode(key)}
                          className={
                            mode === key
                              ? 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3.5 py-1.5 text-[14px] font-medium shadow-sm transition disabled:opacity-50'
                              : 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[14px] font-medium text-[#57575d] transition hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute'
                          }
                        >
                          {modes[key].title}
                        </button>
                      ))}
                  </div>
                </div>
              </TbCard>
              <TbCard
                aria-label={modes[mode].title}
                title={rows.length ? `待处理 ${rows.length} / ${queueLimit}` : undefined}
                extra={
                  rows.length ? (
                    // F8：设计源卡头清空为 ghost 蓝字（text-tb-link，hover chip 底）
                    <Button
                      variant="ghost"
                      className="text-tb-link! hover:bg-tb-chip! hover:text-tb-link!"
                      disabled={!rows.length || busy || packing}
                      onClick={(event) => {
                        reset()
                        revealCard(event.currentTarget)
                      }}
                    >
                      <Trash2 size={14} />
                      清空
                    </Button>
                  ) : modes[mode].category === 'image' ? (
                    // 空态一致性（同表格页「载入示例」）：仅图片类模式提供示例，其他模式会误导
                    <div className="flex flex-1 items-center justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy || packing}
                        onClick={() => void loadSamples()}
                      >
                        载入示例
                      </Button>
                    </div>
                  ) : undefined
                }
              >
                <button
                  type="button"
                  className={`flex w-full items-center gap-4 rounded-[20px] border-2 border-dashed text-left transition disabled:opacity-60 ${
                    rows.length ? 'px-4 py-3' : 'flex-col justify-center px-6 py-12 text-center'
                  } ${dragging ? 'border-[#0071e3] bg-[#0071e3]/5' : 'border-tb-line hover:border-[#0071e3]/50'}`}
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
                  <span
                    aria-hidden="true"
                    className={`grid shrink-0 place-items-center rounded-full bg-[#0071e3] text-white ${
                      rows.length
                        ? 'size-9'
                        : 'size-14 shadow-[0_10px_24px_-10px_rgba(0,113,227,0.8)]'
                    }`}
                  >
                    {mode === 'image' ? (
                      <Image size={rows.length ? 16 : 24} strokeWidth={1.75} />
                    ) : (
                      <FileUp size={rows.length ? 16 : 24} strokeWidth={1.75} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={`block font-semibold [overflow-wrap:anywhere] ${rows.length ? 'text-[14px]' : 'text-[19px]'}`}
                    >
                      {rows.length ? '继续添加文件，或拖到这里' : '选择文件，或拖到这里'}
                    </span>
                    <span className="mt-1 block text-[13px] text-tb-mute [overflow-wrap:anywhere]">
                      {queueHint}
                    </span>
                  </span>
                </button>
                <input
                  ref={input}
                  type="file"
                  tabIndex={-1}
                  multiple
                  accept={modes[mode].accept}
                  className="sr-only"
                  disabled={busy || packing}
                  aria-label="选择待转换文件"
                  onChange={(event) => {
                    addFiles(Array.from(event.target.files || []))
                    event.target.value = ''
                  }}
                />
                {mode === 'csv-markdown' && (
                  <div className="mt-4 flex flex-col items-end gap-2">
                    <Textarea
                      aria-label="粘贴表格内容"
                      placeholder="在此粘贴从 Excel 复制的表格（首行作为表头）"
                      value={tablePaste}
                      disabled={busy || packing}
                      onChange={(event) => setTablePaste(event.target.value)}
                      className="min-h-[94px]"
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
                {!!rows.length && (
                  <FileQueue
                    rows={rows}
                    mode={mode}
                    busy={busy}
                    packing={packing}
                    onMove={moveRow}
                    onRemove={removeRow}
                    onToggleDetail={toggleDetail}
                    onMarkPreviewError={markPreviewError}
                    // 行内重试与底栏「重试失败项 / 开始转换」同一入口、同一禁用语义
                    onRetry={() => void run()}
                    retryDisabled={busy || packing || excelPending}
                  />
                )}
                {mode === 'csv-excel' && csvPreview && (
                  <CsvExcelPreview
                    file={csvPreview.file}
                    rows={csvPreview.rows}
                    notices={csvPreview.notices}
                    detectNumbers={detectNumbers}
                  />
                )}
                {isExcelRead && excel && (
                  <ExcelPreview
                    excel={excel}
                    sheetName={sheetName}
                    onSheetChange={(value) => {
                      clearOutputs()
                      setSheetName(value)
                    }}
                    mode={mode}
                    disabled={busy || packing}
                  />
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
                    <ContinueWith outputs={[merged]} disabled={busy || packing} />
                    <OutputActions outputs={[merged]} disabled={busy || packing} />
                  </div>
                )}
              </TbCard>
            </TabsContent>
          </Tabs>
        </div>
        <aside className="tool-aside">
          <TbCard title="设置">
            {optionControls}
            {(mode === 'image' || mode === 'image-compress') && (
              <ImageEditOptions
                value={imageEdit}
                disabled={busy || packing}
                onChange={(value) => {
                  clearOutputs()
                  setImageEdit(value)
                }}
              />
            )}
          </TbCard>
        </aside>
      </div>
      <div className="workbench-actions">
        <div className="workbench-status">
          <span>
            文件 <b className="font-semibold text-tb-fg tabular-nums">{rows.length}</b>
          </span>
          {mode !== 'image-pdf' && (
            <span>
              完成{' '}
              <b
                className={`font-semibold tabular-nums ${
                  done ? 'text-[#1a7f37] dark:text-[#30d158]' : 'text-tb-fg'
                }`}
              >
                {done}
              </b>
            </span>
          )}
          {!!failed && (
            <span>
              失败{' '}
              <b className="font-semibold text-[#c4141f] tabular-nums dark:text-[#ff6961]">
                {failed}
              </b>
            </span>
          )}
          {automatic && (
            <span className="conversion-auto" role="status">
              {busy
                ? '正在自动转换'
                : failed > 0
                  ? `已完成 ${done} 个，失败 ${failed} 个`
                  : done === rows.length && done > 0
                    ? `已完成 ${done} 个文件`
                    : '添加文件后自动转换'}
            </span>
          )}
        </div>
        <div className="workbench-bar-actions">
          {done > 1 && mode !== 'image-pdf' && (
            <OutputActions
              outputs={rows.flatMap((row) => (row.output ? [row.output] : []))}
              disabled={busy || packing}
            />
          )}
          {done > 1 && mode !== 'image-pdf' && (
            <ContinueWith
              outputs={rows.flatMap((row) => (row.output ? [row.output] : []))}
              disabled={busy || packing}
            />
          )}
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
          {(!automatic || failed > 0) && (
            <Button
              className="copy-button"
              disabled={
                !rows.length ||
                busy ||
                packing ||
                done === rows.length ||
                excelPending ||
                (automatic && !failed)
              }
              onClick={() => void run()}
            >
              {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}
              {busy
                ? '正在转换'
                : automatic
                  ? '重试失败项'
                  : mode === 'image-pdf'
                    ? '合并 PDF'
                    : '开始转换'}
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
