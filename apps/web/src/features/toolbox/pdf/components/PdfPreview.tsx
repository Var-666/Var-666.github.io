import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import { ChevronLeft, ChevronRight, LoaderCircle, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { previewLayout } from '../pdf-preview'

export default function PdfPreview({
  document,
  pageIndex,
  rotation,
  name,
  position,
  total,
  onNavigate,
  onClose,
  returnFocus,
}: {
  document: PDFDocumentProxy
  pageIndex: number
  rotation: number
  name: string
  position: number
  total: number
  onNavigate: (offset: number) => void
  onClose: () => void
  returnFocus: HTMLButtonElement | null
}) {
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)
  const paper = useRef<HTMLDivElement>(null)
  const [bounds, setBounds] = useState({ width: 0, height: 0 })
  const [zoom, setZoom] = useState<number | null>(() => (window.innerWidth <= 650 ? null : 1))
  const [scale, setScale] = useState(1)
  const [maxScale, setMaxScale] = useState(4)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    const element = viewport
    if (!element) return
    const observer = new ResizeObserver(() => {
      const next = { width: element.clientWidth, height: element.clientHeight }
      setBounds((previous) =>
        previous.width === next.width && previous.height === next.height ? previous : next,
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [viewport])
  useEffect(() => {
    const container = paper.current
    if (!container || !bounds.width || !bounds.height) return
    let cancelled = false
    let render: RenderTask | undefined
    const canvas = window.document.createElement('canvas')
    setLoading(true)
    setFailed(false)
    void (async () => {
      try {
        const page = await document.getPage(pageIndex + 1)
        if (cancelled) return
        const angle = (page.rotate + rotation) % 360
        const base = page.getViewport({ scale: 1, rotation: angle })
        const layout = previewLayout(
          base.width,
          base.height,
          bounds.width,
          bounds.height,
          zoom,
          window.devicePixelRatio || 1,
        )
        canvas.width = layout.width
        canvas.height = layout.height
        canvas.style.width = `${layout.cssWidth}px`
        canvas.style.height = `${layout.cssHeight}px`
        canvas.setAttribute('aria-label', `${name} 原第 ${pageIndex + 1} 页`)
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Canvas unavailable')
        container.append(canvas)
        setScale(layout.scale)
        setMaxScale(layout.maxScale)
        render = page.render({
          canvas,
          canvasContext: context,
          viewport: page.getViewport({ scale: layout.renderScale, rotation: angle }),
          background: '#ffffff',
        })
        await render.promise
        if (!cancelled) setLoading(false)
      } catch {
        if (!cancelled) {
          canvas.remove()
          canvas.width = canvas.height = 0
          setFailed(true)
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
      render?.cancel()
      canvas.remove()
      canvas.width = canvas.height = 0
    }
  }, [document, pageIndex, rotation, name, bounds, zoom])
  useEffect(() => {
    viewport?.scrollTo(0, 0)
  }, [viewport, document, pageIndex])
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        className="pdf-preview-dialog"
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus?.focus()
        }}
      >
        <div className="pdf-preview-heading">
          <DialogTitle>页面预览</DialogTitle>
          <DialogDescription className="pdf-preview-meta">
            {name} · 原第 {pageIndex + 1} 页
          </DialogDescription>
        </div>
        <div className="pdf-preview-controls">
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="上一页"
              disabled={position === 0}
              onClick={() => onNavigate(-1)}
            >
              <ChevronLeft size={16} />
            </Button>
            <span aria-live="polite">
              {position + 1} / {total}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="下一页"
              disabled={position === total - 1}
              onClick={() => onNavigate(1)}
            >
              <ChevronRight size={16} />
            </Button>
          </div>
          <div>
            <Button
              variant="outline"
              size="icon"
              aria-label="缩小预览"
              disabled={loading || scale <= 0.25}
              onClick={() => setZoom(Math.max(0.25, scale - 0.25))}
            >
              <ZoomOut size={16} />
            </Button>
            <span aria-label="预览缩放比例">{Math.round(scale * 100)}%</span>
            <Button
              variant="outline"
              size="icon"
              aria-label="放大预览"
              disabled={loading || scale >= maxScale}
              onClick={() => setZoom(Math.min(maxScale, scale + 0.25))}
            >
              <ZoomIn size={16} />
            </Button>
            <Button variant="outline" size="sm" disabled={loading} onClick={() => setZoom(null)}>
              适合页面
            </Button>
          </div>
        </div>
        <div
          className="pdf-preview-viewport"
          ref={setViewport}
          role="region"
          aria-label="整页预览，可滚动查看"
          tabIndex={0}
          aria-busy={loading}
        >
          <div className="pdf-preview-paper" ref={paper} />
          {loading && (
            <span className="pdf-preview-status" role="status">
              <LoaderCircle size={16} className="animate-spin" />
              正在渲染…
            </span>
          )}
          {failed && (
            <span className="pdf-preview-status" role="alert">
              此页预览失败，请切换页面或关闭后重试。
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
