import { OutputActions } from './components/OutputActions'
import type { OutputFile } from './lib/file-convert'
import { useTransferReceiver } from './lib/tool-transfer'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocument } from 'pdf-lib'
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  FileUp,
  GripVertical,
  LoaderCircle,
  RotateCw,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { openPdf } from './lib/file-convert'
import { validateQueueFiles } from './lib/file-queue'
import { pdfPageNumbers } from './lib/media-options'
import {
  loadOrganizablePdf,
  organizePdf,
  organizePdfSegments,
  splitSegments,
  type PdfPageEntry,
  type SplitMode,
} from './lib/pdf-organize'
import { verifyPdfBlob } from './lib/convert-report'
import { packOutputs } from './lib/file-media'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PdfPreview from './PdfPreview'

type Source = {
  id: string
  file: File
  document: PDFDocument
  preview: PDFDocumentProxy
  task: PDFDocumentLoadingTask
}

function Thumbnail({
  source,
  page,
  onOpen,
  position,
}: {
  source: Source
  page: PdfPageEntry
  onOpen: (button: HTMLButtonElement) => void
  position: number
}) {
  const container = useRef<HTMLButtonElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (!container.current) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '200px' },
    )
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const element = canvas.current
    if (!visible || !element) return
    let cancelled = false
    let render: RenderTask | undefined
    setFailed(false)
    void (async () => {
      try {
        const pdfPage = await source.preview.getPage(page.index + 1)
        if (cancelled) return
        const rotation = (pdfPage.rotate + page.rotation) % 360
        const base = pdfPage.getViewport({ scale: 1, rotation })
        const viewport = pdfPage.getViewport({
          scale: Math.min(180 / base.width, 200 / base.height),
          rotation,
        })
        element.width = Math.max(1, Math.ceil(viewport.width))
        element.height = Math.max(1, Math.ceil(viewport.height))
        const context = element.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        render = pdfPage.render({
          canvas: element,
          canvasContext: context,
          viewport,
          background: '#ffffff',
        })
        await render.promise
      } catch {
        if (!cancelled) setFailed(true)
      }
    })()
    return () => {
      cancelled = true
      render?.cancel()
    }
  }, [source, page.index, page.rotation, visible])
  return (
    <button
      type="button"
      className="pdf-thumbnail pdf-preview-trigger"
      ref={container}
      onClick={(event) => onOpen(event.currentTarget)}
      aria-label={`放大页面 ${position + 1}`}
      title="点击放大预览"
    >
      {failed && <span>预览不可用</span>}
      <canvas
        hidden={failed}
        key={page.rotation}
        ref={canvas}
        aria-label={`${source.file.name} 第 ${page.index + 1} 页预览`}
      />
      <span className="pdf-zoom-hint" aria-hidden="true">
        <ZoomIn size={14} />
      </span>
    </button>
  )
}

export default function PdfTool({ active = true }: { active?: boolean }) {
  const [sources, setSources] = useState<Source[]>([])
  const [pages, setPages] = useState<PdfPageEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [range, setRange] = useState('')
  const [dragging, setDragging] = useState(false)
  const [result, setResult] = useState<(OutputFile & { url: string }) | null>(null)
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
    if (!active) setPreviewId(null)
  }, [active])
  const input = useRef<HTMLInputElement>(null)
  const tasks = useRef(new Set<PDFDocumentLoadingTask>())
  const resultUrl = useRef('')
  const urls = useRef(new Set<string>())
  const running = useRef(false)
  const mounted = useRef(true)
  const moving = useRef<string | null>(null)
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
  const invalidate = () => {
    URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = ''
    setResult(null)
    setSplitOutput((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.url)
        urls.current.delete(previous.url)
      }
      return null
    })
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
  const addFiles = async (files: File[]) => {
    if (running.current || !files.length) return
    try {
      validateQueueFiles(
        sources.map((source) => source.file),
        files,
        '.pdf',
        20,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    running.current = true
    setBusy(true)
    const added: Source[] = []
    let total = sources.reduce((sum, source) => sum + source.document.getPageCount(), 0)
    try {
      for (const file of files) {
        if (!mounted.current) break
        setMessage(`正在读取 ${file.name}`)
        let task: PDFDocumentLoadingTask | undefined
        try {
          const document = await loadOrganizablePdf(new Uint8Array(await file.arrayBuffer()))
          if (total + document.getPageCount() > 100)
            throw new Error('所有文件合计最多 100 页，请减少文件数量。')
          if (!mounted.current) break
          task = await openPdf(file)
          tasks.current.add(task)
          const preview = await task.promise
          if (!mounted.current) break
          added.push({ id: crypto.randomUUID(), file, document, preview, task })
          total += document.getPageCount()
        } catch (error) {
          if (task) {
            tasks.current.delete(task)
            await task.destroy().catch(() => {})
          }
          if (mounted.current)
            toast.error(`${file.name}：${error instanceof Error ? error.message : '读取失败'}`)
        }
      }
      if (mounted.current && added.length) {
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
    } finally {
      running.current = false
      if (mounted.current) {
        setBusy(false)
        setMessage('')
      }
    }
  }
  useTransferReceiver('pdf', active && !busy, (request) => {
    void addFiles(request.files ?? [])
  })
  const move = (id: string, to: number) => {
    if (running.current || to < 0 || to >= pages.length) return
    const next = [...pages]
    const from = next.findIndex((page) => page.id === id)
    if (from < 0 || from === to) return
    next.splice(to, 0, next.splice(from, 1)[0])
    commit(next)
  }
  const exportPdf = async () => {
    if (running.current || !pages.some((page) => page.selected)) return
    running.current = true
    setBusy(true)
    setMessage('正在导出 PDF')
    invalidate()
    try {
      const blob = await organizePdf(
        new Map(sources.map((source) => [source.id, source.document])),
        pages,
      )
      if (!mounted.current) return
      resultUrl.current = URL.createObjectURL(blob)
      setResult({ blob, name: '整理后的文档.pdf', url: resultUrl.current })
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
  const selected = pages.filter((page) => page.selected).length
  const previewPosition = pages.findIndex((page) => page.id === previewId)
  const previewPage = pages[previewPosition]
  const previewSource = sources.find((source) => source.id === previewPage?.sourceId)
  return (
    <main className="main-content pdf-tool">
      <section className="intro">
        <h1>PDF 页面整理</h1>
      </section>
      <section className="conversion-panel" aria-label="整理 PDF 页面">
        <button
          className={`file-drop ${pages.length ? 'has-files' : ''} ${dragging ? 'is-dragging' : ''}`}
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
          <span className="file-drop-icon">
            {busy ? <LoaderCircle className="animate-spin" size={25} /> : <FileUp size={25} />}
          </span>
          <strong>{pages.length ? '继续添加 PDF，或拖到这里' : '选择 PDF，或拖到这里'}</strong>
          <span>最多 10 个文件 · 单个 20 MB · 总计 50 MB / 100 页</span>
        </button>
        <input
          type="file"
          ref={input}
          accept=".pdf"
          multiple
          disabled={busy}
          className="sr-only"
          aria-label="选择需要整理的 PDF"
          onChange={(event) => {
            void addFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />
        <p className="conversion-note">
          保留页面图文，书签不保留。暂不支持加密、表单或数字签名文件。
        </p>
        {message && (
          <p className="tool-status" role="status">
            {message}
          </p>
        )}
        {!!pages.length && (
          <>
            <div className="pdf-toolbar">
              <span aria-live="polite">
                {sources.length} 个文件 · {pages.length} 页 · 已选 {selected} 页
              </span>
              <div>
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
              </div>
            </div>
            <div className="pdf-range">
              <label htmlFor="pdf-organize-range">按当前顺序选页</label>
              <input
                id="pdf-organize-range"
                className="tool-input"
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
            <div className="pdf-pages">
              {pages.map((page, index) => {
                const source = sources.find((source) => source.id === page.sourceId)!
                const label = `${source.file.name} 第 ${page.index + 1} 页`
                return (
                  <article
                    key={page.id}
                    className={`pdf-page ${page.selected ? 'is-selected' : ''}`}
                    aria-label={`页面 ${index + 1}：${label}`}
                    onDragOver={(event) => {
                      if (moving.current) event.preventDefault()
                    }}
                    onDrop={(event) => {
                      if (!moving.current) return
                      event.preventDefault()
                      move(moving.current, index)
                      moving.current = null
                    }}
                  >
                    <div className="pdf-page-heading">
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`选择页面 ${index + 1}`}
                          checked={page.selected}
                          disabled={busy}
                          onChange={(event) =>
                            commit(
                              pages.map((item) =>
                                item.id === page.id
                                  ? { ...item, selected: event.target.checked }
                                  : item,
                              ),
                            )
                          }
                        />
                        <span>第 {index + 1} 页</span>
                      </label>
                      <span
                        draggable={!busy}
                        className="pdf-drag"
                        title="拖动排序，也可使用下方箭头"
                        aria-label={`拖动页面 ${index + 1}`}
                        onDragStart={(event) => {
                          moving.current = page.id
                          event.dataTransfer.setData('text/plain', page.id)
                          event.dataTransfer.effectAllowed = 'move'
                        }}
                        onDragEnd={() => {
                          moving.current = null
                        }}
                      >
                        <GripVertical size={15} />
                      </span>
                    </div>
                    <Thumbnail
                      source={source}
                      page={page}
                      position={index}
                      onOpen={(button) => {
                        previewTrigger.current = button
                        setPreviewId(page.id)
                      }}
                    />
                    <p className="pdf-page-origin" title={label}>
                      {source.file.name}
                      <span>
                        原第 {page.index + 1} 页{page.rotation ? ` · 已旋转 ${page.rotation}°` : ''}
                      </span>
                    </p>
                    <div className="pdf-page-actions">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`上移页面 ${index + 1}`}
                        disabled={busy || index === 0}
                        onClick={() => move(page.id, index - 1)}
                      >
                        <ArrowUp size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`下移页面 ${index + 1}`}
                        disabled={busy || index === pages.length - 1}
                        onClick={() => move(page.id, index + 1)}
                      >
                        <ArrowDown size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`旋转页面 ${index + 1}`}
                        disabled={busy}
                        onClick={() =>
                          commit(
                            pages.map((item) =>
                              item.id === page.id
                                ? { ...item, rotation: (item.rotation + 90) % 360 }
                                : item,
                            ),
                          )
                        }
                      >
                        <RotateCw size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`删除页面 ${index + 1}`}
                        disabled={busy}
                        onClick={() => commit(pages.filter((item) => item.id !== page.id))}
                      >
                        <X size={14} />
                      </Button>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
        <div className="conversion-actions">
          <Button
            variant="ghost"
            disabled={busy || !pages.length}
            onClick={() => {
              commit([])
              setRange('')
            }}
          >
            <Trash2 size={14} />
            清空
          </Button>
          <div>
            {result && <OutputActions outputs={[result]} disabled={busy} />}
            {result && (
              <Button variant="outline" asChild>
                <a href={result.url} download="整理后的文档.pdf">
                  <ArrowDownToLine size={14} />
                  下载 PDF
                </a>
              </Button>
            )}
            <Button disabled={busy || !selected || !!result} onClick={exportPdf}>
              {busy ? (
                <LoaderCircle className="animate-spin" size={14} />
              ) : (
                <ArrowDownToLine size={14} />
              )}
              {busy ? '正在处理' : `导出所选${selected ? ` (${selected} 页)` : ''}`}
            </Button>
          </div>
        </div>
        {pages.length > 1 && (
          <div className="split-row">
            <label className="split-field">
              拆分方式
              <Select
                value={splitMode}
                disabled={busy || !selected}
                onValueChange={(value) => {
                  setSplitMode(value as typeof splitMode)
                  setSplitOutput(null)
                }}
              >
                <SelectTrigger aria-label="拆分方式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="each">每页一个文件</SelectItem>
                  <SelectItem value="every">每 N 页一个文件</SelectItem>
                  <SelectItem value="ranges">按页码段</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {splitMode === 'every' && (
              <label className="split-field">
                每份页数
                <input
                  className="page-range"
                  aria-label="每份页数"
                  disabled={busy || !selected}
                  value={splitSize}
                  onChange={(event) => {
                    setSplitSize(event.target.value)
                    setSplitOutput(null)
                  }}
                />
              </label>
            )}
            {splitMode === 'ranges' && (
              <label className="split-field">
                页码段（按当前排序，每页恰属一段）
                <input
                  className="page-range"
                  aria-label="拆分页码段"
                  disabled={busy || !selected}
                  placeholder="如 1-3,4-6"
                  value={splitRanges}
                  onChange={(event) => {
                    setSplitRanges(event.target.value)
                    setSplitOutput(null)
                  }}
                />
              </label>
            )}
            <Button variant="outline" disabled={busy || !selected} onClick={splitExport}>
              拆分导出 ({selected} 页)
            </Button>
            {splitOutput && <OutputActions outputs={[splitOutput.output]} disabled={busy} />}
            {splitOutput && (
              <Button variant="outline" asChild>
                <a href={splitOutput.url} download={splitOutput.name}>
                  <ArrowDownToLine size={14} />
                  下载 {splitOutput.name}（{splitOutput.parts} 份）
                </a>
              </Button>
            )}
          </div>
        )}
      </section>
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
