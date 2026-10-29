import { useRef } from 'react'
import { ArrowDown, ArrowUp, GripVertical, RotateCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { PdfPageEntry } from '@/features/toolbox/pdf/pdf-organize'
import { PdfThumbnail } from './PdfThumbnail'

export function PdfPageGrid({
  sources,
  pages,
  busy,
  onMove,
  onChange,
  onOpen,
}: {
  sources: { id: string; file: File; preview: PDFDocumentProxy }[]
  pages: PdfPageEntry[]
  busy: boolean
  onMove: (id: string, position: number) => void
  onChange: (pages: PdfPageEntry[]) => void
  onOpen: (id: string, button: HTMLButtonElement) => void
}) {
  const moving = useRef<string | null>(null)
  return (
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
              onMove(moving.current, index)
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
                    onChange(
                      pages.map((item) =>
                        item.id === page.id ? { ...item, selected: event.target.checked } : item,
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
            <PdfThumbnail
              source={source}
              page={page}
              position={index}
              onOpen={(button) => onOpen(page.id, button)}
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
                onClick={() => onMove(page.id, index - 1)}
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`下移页面 ${index + 1}`}
                disabled={busy || index === pages.length - 1}
                onClick={() => onMove(page.id, index + 1)}
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`旋转页面 ${index + 1}`}
                disabled={busy}
                onClick={() =>
                  onChange(
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
                onClick={() => onChange(pages.filter((item) => item.id !== page.id))}
              >
                <X size={14} />
              </Button>
            </div>
          </article>
        )
      })}
    </div>
  )
}
