import { useUnsavedWork } from '../DraftGuard'
import { PdfPageGrid } from './components/PdfPageGrid'
import { PdfOutputSettings, type PdfSettings } from './components/PdfOutputSettings'
import { createPdfWatermark } from './pdf-decorations'
import { processPdfLocal } from './pdf-qpdf'
import { openPdf, outputName, type OutputFile } from '../files/file-convert'
import { OutputActions } from '../components/OutputActions'
import { useTransferReceiver } from '../tool-transfer'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocument } from 'pdf-lib'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import {
  ArrowDownToLine,
  ChevronDown,
  FileUp,
  Info,
  LoaderCircle,
  RotateCw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { validateQueueFiles } from '../lib/file-queue'
import { pdfPageNumbers } from '../files/media-options'
import { sizeLabel } from '../files/types'
import {
  loadOrganizablePdf,
  EncryptedPdfError,
  organizePdf,
  organizePdfSegments,
  splitSegments,
  type PdfPageEntry,
  type SplitMode,
} from './pdf-organize'
import { samplePdfFile } from './pdf-samples'
import { verifyPdfBlob } from '../files/convert-report'
import { imagesToPdf, packOutputs } from '../files/file-media'
import PdfPreview from './components/PdfPreview'
import { ToolHead } from '../components/ToolHead'
import { TbCard } from '../components/tb'
import { tools } from '../tools'

type Source = {
  id: string
  file: File
  pdfFile: File
  blank?: boolean
  document: PDFDocument
  preview: PDFDocumentProxy
  task: PDFDocumentLoadingTask
}

/* 底栏 Stat 上限与来源文件色点（仅展示，与 validateQueueFiles / checkPages 的实际限额一致） */
const MAX_SOURCES = 10
const MAX_PAGES = 100
const SOURCE_COLORS = [
  '#0a84ff',
  '#ff375f',
  '#30d158',
  '#ff9f0a',
  '#bf5af2',
  '#64d2ff',
  '#ffd60a',
  '#ac8e68',
  '#5e5ce6',
  '#ff6482',
]
const toolLimits = tools.find((tool) => tool.id === 'pdf')!.limits

/* 设计源 DropZone 字段样式：保留 file-drop 类作为拖放入队钩子，盒模型全部用工具类覆盖 */
const dropBase =
  'file-drop flex w-full items-center rounded-[20px]! border-2! border-dashed! bg-transparent! transition disabled:opacity-60'

export default function PdfTool({ active = true }: { active?: boolean }) {
  const [sources, setSources] = useState<Source[]>([])
  const [pages, setPages] = useState<PdfPageEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [range, setRange] = useState('')
  const [settings, setSettings] = useState<PdfSettings>({
    numbering: false,
    start: '1',
    watermark: '',
    opacity: 20,
  })
  const [lockedFiles, setLockedFiles] = useState<File[]>([])
  const [password, setPassword] = useState('')
  const [unlockError, setUnlockError] = useState('')
  const [unlockResult, setUnlockResult] = useState<(OutputFile & { url: string }) | null>(null)
  const [exportPreview, setExportPreview] = useState<{
    document: PDFDocumentProxy
    task: PDFDocumentLoadingTask
    name: string
    position: number
  } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [result, setResult] = useState<
    (OutputFile & { url: string; compressed?: boolean; info?: string }) | null
  >(null)
  useUnsavedWork(pages.length > 0 || lockedFiles.length > 0 || busy)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [splitMode, setSplitMode] = useState<'each' | 'every' | 'ranges'>('each')
  const [splitSize, setSplitSize] = useState('5')
  const [splitRanges, setSplitRanges] = useState('')
  const [splitOutput, setSplitOutput] = useState<{
    url: string
    name: string
    parts: number
    output: OutputFile
  } | null>(null)
  useEffect(() => {
    if (!active) {
      setPreviewId(null)
      if (exportPreview) {
        tasks.current.delete(exportPreview.task)
        void exportPreview.task.destroy().catch(() => {})
        setExportPreview(null)
      }
    }
  }, [active, exportPreview])
  const input = useRef<HTMLInputElement>(null)
  const tasks = useRef(new Set<PDFDocumentLoadingTask>())
  const resultUrl = useRef('')
  const urls = useRef(new Set<string>())
  const running = useRef(false)
  const mounted = useRef(true)
  const previewTrigger = useRef<HTMLButtonElement | null>(null)
  useEffect(() => {
    mounted.current = true
    const current = tasks.current
    const currentUrls = urls.current
    return () => {
      mounted.current = false
      URL.revokeObjectURL(resultUrl.current)
      for (const url of currentUrls) URL.revokeObjectURL(url)
      currentUrls.clear()
      for (const task of current) void task.destroy().catch(() => {})
      current.clear()
    }
  }, [])
  const closeExportPreview = () => {
    if (exportPreview) {
      tasks.current.delete(exportPreview.task)
      void exportPreview.task.destroy().catch(() => {})
      setExportPreview(null)
    }
  }
  const clearSplitOutput = () => {
    setSplitOutput((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.url)
        urls.current.delete(previous.url)
      }
      return null
    })
  }
  const invalidate = () => {
    closeExportPreview()
    URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = ''
    setResult(null)
    clearSplitOutput()
  }
  const commit = (next: PdfPageEntry[]) => {
    if (running.current) return
    invalidate()
    setPages(next)
    const retained = new Set(next.map((page) => page.sourceId))
    for (const source of sources)
      if (!retained.has(source.id)) {
        tasks.current.delete(source.task)
        void source.task.destroy().catch(() => {})
      }
    setSources(sources.filter((source) => retained.has(source.id)))
  }
  const appendSources = (added: Source[]) => {
    invalidate()
    setSources((previous) => [...previous, ...added])
    setPages((previous) => [
      ...previous,
      ...added.flatMap((source) =>
        source.document.getPages().map((_, index) => ({
          id: `${source.id}-${index}`,
          sourceId: source.id,
          index,
          rotation: 0,
          selected: true,
        })),
      ),
    ])
  }
  const loadSource = async (file: File, pdfFile?: File): Promise<Source> => {
    if (!pdfFile) {
      if (/\.pdf$/i.test(file.name)) pdfFile = file
      else {
        const output = await imagesToPdf([file], setMessage)
        pdfFile = new File([output.blob], outputName(file.name, 'pdf'), { type: 'application/pdf' })
      }
    }
    const document = await loadOrganizablePdf(new Uint8Array(await pdfFile.arrayBuffer()))
    if (!mounted.current) throw new Error('工具已关闭。')
    const task = await openPdf(pdfFile)
    if (!mounted.current) {
      await task.destroy().catch(() => {})
      throw new Error('工具已关闭。')
    }
    tasks.current.add(task)
    try {
      const preview = await task.promise
      if (!mounted.current) throw new Error('工具已关闭。')
      return { id: crypto.randomUUID(), file, pdfFile, document, preview, task }
    } catch (error) {
      tasks.current.delete(task)
      await task.destroy().catch(() => {})
      throw error
    }
  }
  const checkPages = (count: number, added: Source[] = []) => {
    const original = [...sources, ...added]
      .filter((source) => !source.blank)
      .reduce((sum, source) => sum + source.document.getPageCount(), 0)
    const displayed =
      pages.length + added.reduce((sum, source) => sum + source.document.getPageCount(), 0)
    if (original + count > 100 || displayed + count > 100)
      throw new Error('所有文件和当前列表合计最多 100 页，请减少页面数量。')
  }
  const addFiles = async (files: File[]) => {
    if (running.current || !files.length) return
    try {
      validateQueueFiles(
        [...sources.filter((source) => !source.blank).map((source) => source.file), ...lockedFiles],
        files,
        '.pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.avif',
        20,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    running.current = true
    setBusy(true)
    const added: Source[] = [],
      locked: File[] = []
    try {
      for (const file of files) {
        if (!mounted.current) break
        setMessage(`正在读取 ${file.name}`)
        let source: Source | undefined
        try {
          source = await loadSource(file)
          checkPages(source.document.getPageCount(), added)
          added.push(source)
        } catch (error) {
          if (source) {
            tasks.current.delete(source.task)
            await source.task.destroy().catch(() => {})
          }
          if (mounted.current) {
            if (error instanceof EncryptedPdfError) locked.push(file)
            else toast.error(`${file.name}：${error instanceof Error ? error.message : '读取失败'}`)
          }
        }
      }
      if (mounted.current) {
        if (added.length) appendSources(added)
        if (locked.length) setLockedFiles((previous) => [...previous, ...locked])
      }
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setMessage('')
      }
    }
  }
  const unlock = async () => {
    const file = lockedFiles[0]
    if (running.current || !file) return
    running.current = true
    setBusy(true)
    setMessage('正在本地解密 PDF')
    const secret = password
    setPassword('')
    setUnlockError('')
    let source: Source | undefined
    try {
      const blob = await processPdfLocal(file, 'decrypt', secret)
      source = await loadSource(file, new File([blob], file.name, { type: 'application/pdf' }))
      checkPages(source.document.getPageCount())
      if (!mounted.current) return
      appendSources([source])
      setLockedFiles((previous) => previous.slice(1))
      if (unlockResult) {
        URL.revokeObjectURL(unlockResult.url)
        urls.current.delete(unlockResult.url)
      }
      const url = URL.createObjectURL(blob)
      urls.current.add(url)
      setUnlockResult({ blob, name: outputName(file.name, '已解密.pdf'), url })
    } catch (error) {
      if (source) {
        tasks.current.delete(source.task)
        await source.task.destroy().catch(() => {})
      }
      if (mounted.current)
        setUnlockError(error instanceof Error ? error.message : '解密失败，原文件保留。')
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setMessage('')
      }
    }
  }
  const addBlank = async () => {
    if (running.current || pages.length >= 100) return
    running.current = true
    setBusy(true)
    try {
      let source = sources.find((source) => source.blank)
      if (!source) {
        const { PDFDocument } = await import('pdf-lib')
        const document = await PDFDocument.create()
        document.addPage([595.28, 841.89])
        const file = new File(
          [(await document.save()) as Uint8Array<ArrayBuffer>],
          'A4 空白页.pdf',
          { type: 'application/pdf' },
        )
        source = { ...(await loadSource(file)), blank: true }
        if (!mounted.current) return
        setSources((previous) => [...previous, source!])
      }
      invalidate()
      const entry = {
        id: crypto.randomUUID(),
        sourceId: source.id,
        index: 0,
        rotation: 0,
        selected: true,
      }
      setPages((previous) => [...previous, entry])
    } catch (error) {
      if (mounted.current) toast.error(error instanceof Error ? error.message : '无法添加空白页。')
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  useTransferReceiver('pdf', active && !busy, (request) => {
    void addFiles(request.files ?? [])
  })
  // 「载入示例」：设计源在 dropzone 下有灰色入口；运行时生成 3 页小 PDF，
  // 走既有 addFiles 校验入队，不绕过任何现有逻辑。
  const loadSamples = async () => {
    try {
      await addFiles([await samplePdfFile()])
    } catch (error) {
      if (mounted.current)
        toast.error(error instanceof Error ? error.message : '无法生成示例文档。')
    }
  }
  const move = (id: string, to: number) => {
    if (running.current || to < 0 || to >= pages.length) return
    const next = [...pages]
    const from = next.findIndex((page) => page.id === id)
    if (from < 0 || from === to) return
    next.splice(to, 0, next.splice(from, 1)[0])
    commit(next)
    setMessage(`已将第 ${from + 1} 页移到第 ${to + 1} 位。`)
  }
  const outputOptions = async () => ({
    numbering: settings.numbering ? { start: Number(settings.start) } : undefined,
    watermark: settings.watermark.trim()
      ? { bytes: (await createPdfWatermark(settings.watermark))!, opacity: settings.opacity / 100 }
      : undefined,
  })
  const exportPdf = async (compress = false) => {
    if (running.current || !pages.some((page) => page.selected)) return
    running.current = true
    setBusy(true)
    setMessage(compress ? '正在压缩 PDF' : '正在导出 PDF')
    invalidate()
    try {
      const selectedPages = pages.filter((page) => page.selected)
      const unchanged =
        sources.length === 1 &&
        !settings.numbering &&
        !settings.watermark.trim() &&
        selectedPages.length === sources[0].document.getPageCount() &&
        selectedPages.every(
          (page, index) =>
            page.sourceId === sources[0].id && page.index === index && page.rotation === 0,
        )
      let blob: Blob =
        compress && unchanged
          ? sources[0].pdfFile
          : await organizePdf(
              new Map(sources.map((source) => [source.id, source.document])),
              pages,
              await outputOptions(),
            )
      let info: string | undefined
      if (compress) {
        const before = blob.size
        const smaller = await processPdfLocal(blob, 'compress')
        if (smaller.size < before) blob = smaller
        info =
          `${(before / 1024).toFixed(1)} KB → ${(blob.size / 1024).toFixed(1)} KB` +
          (blob.size < before
            ? ` · 减少 ${Math.round((1 - blob.size / before) * 100)}%`
            : ' · 未进一步减小，保留输入内容')
      }
      if (!mounted.current) return
      resultUrl.current = URL.createObjectURL(blob)
      setResult({
        blob,
        name: compress ? '压缩后的文档.pdf' : '整理后的文档.pdf',
        url: resultUrl.current,
        compressed: compress,
        info,
      })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败，请减少页面后重试。')
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setMessage('')
      }
    }
  }
  const splitExport = async () => {
    if (running.current) return
    const selectedPages = pages.filter((page) => page.selected)
    if (!selectedPages.length) return
    running.current = true
    setBusy(true)
    setMessage('正在拆分')
    invalidate()
    try {
      const split: SplitMode =
        splitMode === 'every'
          ? { mode: 'every', size: Number(splitSize) }
          : splitMode === 'ranges'
            ? { mode: 'ranges', ranges: splitRanges }
            : { mode: 'each' }
      const segments = splitSegments(split, selectedPages.length)
      const outputs = await organizePdfSegments(
        new Map(sources.map((source) => [source.id, source.document])),
        selectedPages,
        segments,
        await outputOptions(),
      )
      // 每份输出用 pdf-lib 重新打开验证，失败仅提示、不阻止下载
      for (const output of outputs) {
        const verify = await verifyPdfBlob(output.blob)
        if (!verify.ok) toast.error(`${output.name}：重新打开验证失败，请下载后核对。`)
      }
      if (!mounted.current) return
      const packed =
        outputs.length === 1
          ? outputs[0]
          : await packOutputs(
              outputs.map((output) => ({ name: output.name, blob: output.blob })),
              '拆分结果.zip',
            )
      const url = URL.createObjectURL(packed.blob)
      urls.current.add(url)
      setSplitOutput({ url, name: packed.name, parts: outputs.length, output: packed })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '拆分失败，请检查页码段后重试。')
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setMessage('')
      }
    }
  }
  const previewOutput = async () => {
    if (!result || running.current) return
    running.current = true
    setBusy(true)
    let task: PDFDocumentLoadingTask | undefined
    try {
      task = await openPdf(new File([result.blob], result.name, { type: 'application/pdf' }))
      tasks.current.add(task)
      const document = await task.promise
      if (!mounted.current) {
        tasks.current.delete(task)
        await task.destroy().catch(() => {})
        return
      }
      setExportPreview({ task, document, name: result.name, position: 0 })
    } catch {
      if (task) {
        tasks.current.delete(task)
        void task.destroy().catch(() => {})
      }
      if (mounted.current) toast.error('无法预览导出文件，仍可下载核对。')
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const selected = pages.filter((page) => page.selected).length
  const nonBlankSources = sources.filter((source) => !source.blank)
  const previewPosition = pages.findIndex((page) => page.id === previewId)
  const previewPage = pages[previewPosition]
  const previewSource = sources.find((source) => source.id === previewPage?.sourceId)
  return (
    <main className="main-content pdf-tool">
      <p className="sr-only" role="status" aria-atomic="true">
        {busy
          ? '正在处理 PDF，请稍候。'
          : result || splitOutput || unlockResult
            ? 'PDF 处理结果已生成，可以下载。'
            : message || (pages.length ? `PDF 队列：共 ${pages.length} 页。` : '')}
      </p>
      <ToolHead
        toolId="pdf"
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
          <p>
            最多 10 个输入文件，单个 20 MB，总计 50 MB / 原文与当前列表各不超过 100 页，导出不超过
            100
            MB。空白页不占文件名额。整理保留页面图文和尺寸，书签不保留；已知密码可先解密，原样解密副本单独下载。表单与数字签名文件仍不支持。
            图片按 A4 完整显示、144 DPI 上限和 JPG 编码插入，透明区填白；HEIC 只取主图，HDR /
            元数据不保留。
          </p>
          <ul>
            {toolLimits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="tool-body">
        <div className="tool-main">
          <TbCard>
            <button
              type="button"
              className={`${dropBase} ${
                pages.length
                  ? 'flex-row! items-center! gap-3! px-4! py-3!'
                  : 'gap-4! px-6! py-12! text-center'
              } ${
                dragging
                  ? 'border-[#0071e3]! bg-[#0071e3]/5!'
                  : 'border-tb-line! hover:border-[#0071e3]/50!'
              }`}
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                void addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <span
                aria-hidden="true"
                className={`grid shrink-0 place-items-center rounded-full bg-[#0071e3] text-white ${
                  pages.length ? 'size-9' : 'size-14 shadow-[0_10px_24px_-10px_rgba(0,113,227,0.8)]'
                }`}
              >
                {busy ? (
                  <LoaderCircle
                    className="animate-spin"
                    size={pages.length ? 16 : 24}
                    strokeWidth={1.75}
                  />
                ) : (
                  <FileUp size={pages.length ? 16 : 24} strokeWidth={1.75} />
                )}
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-semibold leading-tight [overflow-wrap:anywhere] ${pages.length ? 'text-[14px]' : 'text-[19px]'}`}
                >
                  {pages.length ? '继续添加 PDF，或拖到这里' : '选择 PDF，或拖到这里'}
                </span>
                <span className="mt-1 block text-[13px] leading-[1.5] text-tb-mute [overflow-wrap:anywhere]">
                  可同时拖入多个 PDF 合并：图片会转成一页 A4 · PDF / PNG / JPG / WebP / HEIC / AVIF
                </span>
              </span>
            </button>
            <input
              type="file"
              tabIndex={-1}
              ref={input}
              accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.avif"
              multiple
              disabled={busy}
              className="sr-only"
              aria-label="选择 PDF 或图片"
              onChange={(event) => {
                void addFiles(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
            {!pages.length && (
              <p className="mt-3 text-center text-[13px] text-tb-mute">
                手边没有 PDF？
                <button
                  type="button"
                  className="text-tb-link hover:underline disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void loadSamples()}
                >
                  载入示例
                </button>
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || pages.length >= 100}
                onClick={addBlank}
              >
                添加 A4 空白页
              </Button>
            </div>
            {message && <p className="mt-3 text-[12px] text-tb-mute">{message}</p>}
          </TbCard>
          {!!pages.length && (
            <TbCard aria-label="页面列表">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    commit(pages.map((page) => ({ ...page, selected: selected !== pages.length })))
                  }
                >
                  {selected === pages.length ? '取消全选' : '全选'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !selected}
                  onClick={() =>
                    commit(
                      pages.map((page) =>
                        page.selected ? { ...page, rotation: (page.rotation + 90) % 360 } : page,
                      ),
                    )
                  }
                >
                  <RotateCw size={14} />
                  旋转所选
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy || !selected}
                  onClick={() => commit(pages.filter((page) => !page.selected))}
                >
                  <Trash2 size={14} />
                  删除所选
                </Button>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="pdf-organize-range"
                    className="whitespace-nowrap text-[12px] text-tb-mute"
                  >
                    按当前顺序选页
                  </label>
                  <input
                    id="pdf-organize-range"
                    className="h-9 w-44 rounded-[10px] bg-tb-raise px-3 text-[13px] ring-1 ring-tb-line outline-none transition focus:ring-2 focus:ring-[#0071e3] dark:bg-tb-chip"
                    disabled={busy}
                    value={range}
                    onChange={(event) => setRange(event.target.value)}
                    placeholder="全部页，如 1,3-5"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => {
                      try {
                        const selectedPages = new Set(pdfPageNumbers(range, pages.length))
                        commit(
                          pages.map((page, index) => ({
                            ...page,
                            selected: selectedPages.has(index + 1),
                          })),
                        )
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : '页码无效')
                      }
                    }}
                  >
                    应用
                  </Button>
                </div>
              </div>
              <PdfPageGrid
                sources={sources}
                pages={pages}
                busy={busy}
                onMove={move}
                onChange={commit}
                onOpen={(id, button) => {
                  previewTrigger.current = button
                  setPreviewId(id)
                }}
              />
            </TbCard>
          )}
        </div>
        <aside className="tool-aside">
          <TbCard title="导出">
            <PdfOutputSettings
              settings={settings}
              disabled={busy}
              selected={selected}
              pageCount={pages.length}
              onSettingsChange={(value) => {
                invalidate()
                setSettings(value)
              }}
              split={{ mode: splitMode, size: splitSize, ranges: splitRanges }}
              onSplitChange={(patch) => {
                if (patch.mode !== undefined) setSplitMode(patch.mode)
                if (patch.size !== undefined) setSplitSize(patch.size)
                if (patch.ranges !== undefined) setSplitRanges(patch.ranges)
                clearSplitOutput()
              }}
              onSplitExport={splitExport}
              splitOutput={splitOutput}
              compressDisabled={busy || !selected || !!result?.compressed}
              onCompress={() => void exportPdf(true)}
            />
          </TbCard>
          <TbCard title="来源文件">
            {nonBlankSources.length ? (
              <ul className="flex flex-col gap-2">
                {nonBlankSources.map((source, index) => (
                  <li key={source.id} className="flex items-center gap-2.5 text-[13px]">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: SOURCE_COLORS[index % SOURCE_COLORS.length] }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate" title={source.file.name}>
                      {source.file.name}
                    </span>
                    <span className="shrink-0 text-tb-mute tabular-nums">
                      {source.document.getPageCount()} 页
                    </span>
                    <button
                      type="button"
                      className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute enabled:hover:bg-tb-chip enabled:hover:text-tb-fg disabled:opacity-50"
                      aria-label={`移除 ${source.file.name}`}
                      disabled={busy}
                      onClick={() => commit(pages.filter((page) => page.sourceId !== source.id))}
                    >
                      <X size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-tb-mute">还没有导入 PDF。</p>
            )}
            {!!lockedFiles.length && (
              <section
                className="mt-4 flex flex-col gap-3 rounded-[18px] bg-tb-raise p-4 text-[13px] [overflow-wrap:anywhere] dark:bg-tb-chip"
                aria-label="待解密 PDF"
              >
                <strong className="font-semibold">待解密 {lockedFiles.length} 个文件</strong>
                <p>{lockedFiles[0].name}</p>
                <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                  文件打开密码
                  <input
                    className="h-9 w-full rounded-[10px] bg-tb-card px-3 text-[14px] font-normal ring-1 ring-tb-line outline-none transition focus:ring-2 focus:ring-[#0071e3]"
                    type="password"
                    aria-label="PDF 打开密码"
                    aria-invalid={!!unlockError}
                    aria-describedby={unlockError ? 'pdf-unlock-error' : undefined}
                    autoComplete="off"
                    value={password}
                    maxLength={1024}
                    disabled={busy}
                    onChange={(event) => {
                      setPassword(event.target.value)
                      setUnlockError('')
                    }}
                  />
                </label>
                <p className="text-[12px] leading-[1.6] text-tb-mute">
                  仅使用你已知的密码，本地解密；密码不会保存。待解密文件还未加入页面列表。
                </p>
                {unlockError && (
                  <p
                    role="alert"
                    className="text-[13px] text-[#c4141f] dark:text-[#ff6961]"
                    id="pdf-unlock-error"
                  >
                    {unlockError}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Button disabled={busy} onClick={unlock}>
                    解密并导入
                  </Button>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      setLockedFiles((previous) => previous.slice(1))
                      setPassword('')
                      setUnlockError('')
                    }}
                  >
                    移除此文件
                  </Button>
                </div>
              </section>
            )}
            {unlockResult && (
              <div
                className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] bg-tb-raise px-3.5 py-2.5 text-[13px] dark:bg-tb-chip"
                aria-label="解密结果"
              >
                <span className="min-w-0 flex-1 truncate">{unlockResult.name}</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={unlockResult.url} download={unlockResult.name}>
                    下载解密 PDF
                  </a>
                </Button>
                <OutputActions outputs={[unlockResult]} disabled={busy} />
              </div>
            )}
          </TbCard>
        </aside>
      </div>
      <div className="workbench-actions">
        <div className="workbench-status">
          <span>
            文件{' '}
            <b className="font-semibold text-tb-fg tabular-nums">
              {nonBlankSources.length} / {MAX_SOURCES}
            </b>
          </span>
          <span>
            页面{' '}
            <b className="font-semibold text-tb-fg tabular-nums">
              {pages.length} / {MAX_PAGES}
            </b>
          </span>
          {!!selected && (
            <span>
              已选{' '}
              <b className="font-semibold text-[#0071e3] tabular-nums dark:text-[#64b5ff]">
                {selected}
              </b>
            </span>
          )}
          {result?.info ? (
            <span role="status">{result.info}</span>
          ) : result ? (
            <span>
              已生成 {result.name} · {sizeLabel(result.blob.size)}
            </span>
          ) : null}
          {splitOutput && (
            <span>
              拆分 {splitOutput.parts} 份 · {splitOutput.name}
            </span>
          )}
        </div>
        <div className="workbench-bar-actions">
          <Button
            variant="ghost"
            disabled={busy || (!pages.length && !lockedFiles.length && !unlockResult)}
            onClick={() => {
              commit([])
              setRange('')
              setLockedFiles([])
              setPassword('')
              setUnlockError('')
              if (unlockResult) {
                URL.revokeObjectURL(unlockResult.url)
                urls.current.delete(unlockResult.url)
                setUnlockResult(null)
              }
            }}
          >
            <Trash2 size={14} />
            清空
          </Button>
          {result && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={(event) => {
                previewTrigger.current = event.currentTarget
                void previewOutput()
              }}
            >
              预览导出 PDF
            </Button>
          )}
          {result && <OutputActions outputs={[result]} disabled={busy} />}
          {result && (
            <Button variant="outline" asChild>
              <a href={result.url} download={result.name}>
                <ArrowDownToLine size={14} />
                下载 PDF
              </a>
            </Button>
          )}
          <Button
            disabled={busy || !selected || (!!result && !result.compressed)}
            onClick={() => void exportPdf()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            {busy ? '正在处理' : `导出所选${selected ? ` (${selected} 页)` : ''}`}
          </Button>
        </div>
      </div>
      {active && exportPreview && (
        <PdfPreview
          document={exportPreview.document}
          pageIndex={exportPreview.position}
          rotation={0}
          name={exportPreview.name}
          position={exportPreview.position}
          total={exportPreview.document.numPages}
          onNavigate={(offset) =>
            setExportPreview((previous) =>
              previous
                ? {
                    ...previous,
                    position: Math.max(
                      0,
                      Math.min(previous.document.numPages - 1, previous.position + offset),
                    ),
                  }
                : null,
            )
          }
          onClose={closeExportPreview}
          // eslint-disable-next-line react-hooks/refs -- 由预览按钮打开后才渲染，返回按钮引用。
          returnFocus={previewTrigger.current}
        />
      )}
      {active && previewPage && previewSource && (
        <PdfPreview
          document={previewSource.preview}
          pageIndex={previewPage.index}
          rotation={previewPage.rotation}
          name={previewSource.file.name}
          position={previewPosition}
          total={pages.length}
          onNavigate={(offset) => {
            const next = pages[previewPosition + offset]
            if (next) setPreviewId(next.id)
          }}
          onClose={() => setPreviewId(null)}
          // eslint-disable-next-line react-hooks/refs -- 弹窗只由用户点击缩略图后渲染，读取打开者引用是安全的
          returnFocus={previewTrigger.current}
        />
      )}
    </main>
  )
}
