// 转换结果详情：指标、注意事项与文本 / PDF 结果预览
import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { Button } from '@/components/ui/button'
import { openPdf } from '@/lib/file-convert'
import { previewLayout } from '@/lib/pdf-preview'
import type { ConvertReport } from '@/lib/convert-report'
import type { Row } from './types'

export function ConversionResultDetails({
  report,
  detail,
  onPreviewError,
}: {
  report: ConvertReport
  detail: Row['detail']
  onPreviewError: () => void
}) {
  return (
    <div className="convert-detail">
      <div className="convert-detail-metrics">
        {report.metrics.map((metric) => (
          <span key={metric.label}>
            {metric.label} <b>{metric.value}</b>
          </span>
        ))}
      </div>
      {report.issues.map((issue) => (
        <p
          key={issue.text}
          className={issue.level === 'warning' ? 'convert-issue warning' : 'convert-issue'}
        >
          {issue.text}
        </p>
      ))}
      {detail?.kind === 'pdf' && <PdfResultPreview file={detail.file} onError={onPreviewError} />}
      {detail?.kind === 'text' && <TextResultPreview text={detail.text} />}
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
