import { useEffect, useRef, useState } from 'react'
import { ZoomIn } from 'lucide-react'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import type { PdfPageEntry } from '@/lib/pdf-organize'

export function PdfThumbnail({
  source,
  page,
  onOpen,
  position,
}: {
  source: { file: File; preview: PDFDocumentProxy }
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
