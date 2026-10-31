import { useUnsavedWork } from '../DraftGuard'
import { PdfPageGrid } from './components/PdfPageGrid'
import { PdfOutputSettings, type PdfSettings } from './components/PdfOutputSettings'
import { createPdfWatermark } from './pdf-decorations'
import { processPdfLocal } from './pdf-qpdf'
import { outputName } from '../files/file-convert'
import { OutputActions } from '../components/OutputActions'
import type { OutputFile } from '../files/file-convert'
import { useTransferReceiver } from '../tool-transfer'
import { useEffect, useRef, useState } from 'react'
import type { PDFDocument } from 'pdf-lib'
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'
import { ArrowDownToLine, FileUp, LoaderCircle, RotateCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { openPdf } from '../files/file-convert'
import { validateQueueFiles } from '../lib/file-queue'
import { pdfPageNumbers } from '../files/media-options'
import {
  loadOrganizablePdf,
  EncryptedPdfError,
  organizePdf,
  organizePdfSegments,
  splitSegments,
  type PdfPageEntry,
  type SplitMode,
} from './pdf-organize'
import { verifyPdfBlob } from '../files/convert-report'
import { imagesToPdf, packOutputs } from '../files/file-media'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import PdfPreview from './components/PdfPreview'
import { ToolHead } from '../components/ToolHead'

type Source = {
  id: string
  file: File
  pdfFile: File
  blank?: boolean
  document: PDFDocument
  preview: PDFDocumentProxy
  task: PDFDocumentLoadingTask
}

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
      <ToolHead toolId="pdf" />
      <div className="tool-body">
        <div className="tool-main">
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
              <strong>
                {pages.length ? '继续添加 PDF 或图片，或拖到这里' : '选择 PDF 或图片，或拖到这里'}
              </strong>
              <span>PDF / PNG / JPG / WebP / HEIC / AVIF</span>
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
            {!!lockedFiles.length && (
              <section className="pdf-unlock-panel" aria-label="待解密 PDF">
                <strong>待解密 {lockedFiles.length} 个文件</strong>
                <p>{lockedFiles[0].name}</p>
                <label className="pdf-setting-field">
                  文件打开密码
                  <input
                    className="tool-input"
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
                <p className="conversion-note">
                  仅使用你已知的密码，本地解密；密码不会保存。待解密文件还未加入页面列表。
                </p>
                {unlockError && (
                  <p role="alert" className="file-error" id="pdf-unlock-error">
                    {unlockError}
                  </p>
                )}
                <div className="text-ops-actions">
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
              <div className="merged-result" aria-label="解密结果">
                <span>{unlockResult.name}</span>
                <Button variant="outline" size="sm" asChild>
                  <a href={unlockResult.url} download={unlockResult.name}>
                    下载解密 PDF
                  </a>
                </Button>
                <OutputActions outputs={[unlockResult]} disabled={busy} />
              </div>
            )}
            <div className="pdf-insert-actions">
              <Button
                size="sm"
                variant="outline"
                disabled={busy || pages.length >= 100}
                onClick={addBlank}
              >
                添加 A4 空白页
              </Button>
            </div>
            {message && <p className="tool-status">{message}</p>}
            {!!pages.length && (
              <>
                <div className="pdf-toolbar">
                  <span aria-live="polite">
                    {sources.filter((source) => !source.blank).length
                      ? `${sources.filter((source) => !source.blank).length} 个文件 · `
                      : ''}
                    {pages.length} 页 · 已选 {selected} 页
                  </span>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        commit(
                          pages.map((page) => ({ ...page, selected: selected !== pages.length })),
                        )
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
                            page.selected
                              ? { ...page, rotation: (page.rotation + 90) % 360 }
                              : page,
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
              </>
            )}
            {result?.info && (
              <p className="tool-status" role="status">
                {result.info}
              </p>
            )}
            <div className="conversion-actions">
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
              <div>
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
          </section>
        </div>
        <aside className="tool-aside">
          <div className="tool-aside-card">
            <PdfOutputSettings
              value={settings}
              disabled={busy}
              onChange={(value) => {
                invalidate()
                setSettings(value)
              }}
            />
          </div>
          {pages.length > 1 && (
            <div className="tool-aside-card">
              <details className="tool-advanced">
                <summary>拆分导出</summary>
                <div className="split-row">
                  <label className="split-field">
                    拆分方式
                    <Select
                      value={splitMode}
                      disabled={busy || !selected}
                      onValueChange={(value) => {
                        setSplitMode(value as typeof splitMode)
                        clearSplitOutput()
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
                          clearSplitOutput()
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
                          clearSplitOutput()
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
              </details>
            </div>
          )}
          <div className="tool-aside-card">
            <details className="tool-advanced pdf-compress-settings">
              <summary>PDF 结构压缩</summary>
              <p className="conversion-note">
                压缩文档数据流和内部结构，保留文字与图片分辨率，不转成图片。已经压缩的照片或扫描件可能无法继续缩小，未减小时保留输入内容。只压缩当前所选页；未改动的单文件保留其完整结构。
              </p>
              <Button
                variant="outline"
                disabled={busy || !selected || result?.compressed}
                onClick={() => void exportPdf(true)}
              >
                压缩并导出所选
              </Button>
            </details>
          </div>
          <div className="tool-aside-card">
            <details className="tool-advanced">
              <summary>使用说明与限制</summary>
              <p className="conversion-note">
                最多 10 个输入文件，单个 20 MB，总计 50 MB / 原文与当前列表各不超过 100
                页，导出不超过 100 MB。空白页不占文件名额。
                整理保留页面图文和尺寸，书签不保留；已知密码可先解密，原样解密副本单独下载。表单与数字签名文件仍不支持。
                图片按 A4 完整显示、144 DPI 上限和 JPG 编码插入，透明区填白；HEIC 只取主图，HDR /
                元数据不保留。
              </p>
            </details>
          </div>
        </aside>
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
