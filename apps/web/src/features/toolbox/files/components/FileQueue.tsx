import { toast } from 'sonner'
import { OutputActions } from '@/features/toolbox/components/OutputActions'
import { ContinueWith } from '@/features/toolbox/components/ContinueWith'
// 转换文件队列：排序（图片合并模式）、逐文件状态、下载、移除与结果详情开关
import { useRef } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Check,
  FileUp,
  GripVertical,
  LoaderCircle,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Mode } from '../modes'
import { sizeLabel, type Row } from '../types'
import { ConversionResultDetails } from './ConversionResultDetails'

export function FileQueue({
  rows,
  mode,
  busy,
  packing,
  onMove,
  onRemove,
  onToggleDetail,
  onMarkPreviewError,
}: {
  rows: Row[]
  mode: Mode
  busy: boolean
  packing: boolean
  onMove: (id: string, to: number) => void
  onRemove: (row: Row) => void
  onToggleDetail: (id: string) => void
  onMarkPreviewError: (id: string) => void
}) {
  const moving = useRef<string | null>(null)
  const image = mode === 'image' || mode === 'image-compress'
  return (
    <div className="file-queue">
      {rows.map((row, index) => (
        <div key={row.id} className="file-row-group">
          <div
            className={`file-row${row.output ? ' has-output' : ''}`}
            onDragOver={(event) => {
              if (mode === 'image-pdf' && moving.current) event.preventDefault()
            }}
            onDrop={(event) => {
              if (!moving.current) return
              event.preventDefault()
              onMove(moving.current, index)
              moving.current = null
            }}
          >
            {mode === 'image-pdf' && (
              <div className="file-order">
                <span
                  role="img"
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
                  onClick={() => onMove(row.id, index - 1)}
                >
                  <ArrowUp size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`下移 ${row.file.name}`}
                  disabled={busy || packing || index === rows.length - 1}
                  onClick={() => onMove(row.id, index + 1)}
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
            <div className="file-row-actions">
              {row.output && (row.report || image) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="detail-toggle"
                  disabled={busy || packing}
                  onClick={() => onToggleDetail(row.id)}
                >
                  {image
                    ? row.showDetail
                      ? '收起预览'
                      : '预览图片'
                    : row.showDetail
                      ? '收起详情'
                      : '结果详情'}
                </Button>
              )}
              {row.output && (
                <ContinueWith
                  outputs={[row.output]}
                  text={row.detail?.kind === 'text' ? row.detail.text : undefined}
                  disabled={busy || packing}
                />
              )}
              {row.output && <OutputActions outputs={[row.output]} disabled={busy || packing} />}
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
                onClick={() => onRemove(row)}
              >
                <X size={15} />
              </Button>
            </div>
          </div>
          {row.notices?.map((notice) => (
            <p className="matrix-notice" key={notice}>
              {notice}
            </p>
          ))}
          {row.showDetail && image && row.output && (
            <img
              className="file-image-preview"
              src={row.output.url}
              alt={`${row.output.name} 转换预览`}
              onError={() => toast.error('当前浏览器无法预览此图片，仍可下载查看。')}
            />
          )}
          {row.showDetail && row.report && (
            <ConversionResultDetails
              report={row.report}
              detail={row.detail}
              onPreviewError={() => onMarkPreviewError(row.id)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
