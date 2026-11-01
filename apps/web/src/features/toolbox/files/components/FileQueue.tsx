import { toast } from 'sonner'
import { OutputActions } from '@/features/toolbox/components/OutputActions'
import { ContinueWith } from '@/features/toolbox/components/ContinueWith'
// 转换文件队列：排序（图片合并模式）、逐文件状态、下载、移除、失败行内重试与结果详情开关。
// 行样式对齐设计源（48px 预览方块 + 文件名 + 状态行 + 行内操作，divide-y 圆角环），
// 类名 file-queue / file-row / file-details 为 e2e 稳定钩子，保留不改逻辑。
import { useRef } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  Check,
  GripVertical,
  LoaderCircle,
  RotateCw,
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
  onRetry,
  retryDisabled,
}: {
  rows: Row[]
  mode: Mode
  busy: boolean
  packing: boolean
  onMove: (id: string, to: number) => void
  onRemove: (row: Row) => void
  onToggleDetail: (id: string) => void
  onMarkPreviewError: (id: string) => void
  /** 与底栏「重试失败项 / 开始转换」完全相同的既有重试入口 */
  onRetry: () => void
  /** 与底栏重试按钮一致的禁用语义（占用中 / 工作簿未就绪等） */
  retryDisabled: boolean
}) {
  const moving = useRef<string | null>(null)
  const image = mode === 'image' || mode === 'image-compress'
  return (
    <div className="file-queue mt-4 divide-y divide-tb-line overflow-hidden rounded-[18px] ring-1 ring-tb-line">
      {rows.map((row, index) => (
        <div key={row.id} className="file-row-group flex flex-col gap-2">
          <div
            className="file-row flex flex-wrap items-center gap-x-3 gap-y-2 bg-tb-raise px-4 py-3 dark:bg-transparent"
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
              <div className="flex items-center gap-0.5 text-tb-mute">
                <span
                  role="img"
                  draggable={!busy && !packing}
                  aria-label={`拖动排序 ${row.file.name}`}
                  title="拖动排序，或使用下方箭头"
                  className="cursor-grab px-0.5 py-2"
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
                <button
                  type="button"
                  aria-label={`上移 ${row.file.name}`}
                  disabled={busy || packing || index === 0}
                  onClick={() => onMove(row.id, index - 1)}
                  className="grid size-8 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  aria-label={`下移 ${row.file.name}`}
                  disabled={busy || packing || index === rows.length - 1}
                  onClick={() => onMove(row.id, index + 1)}
                  className="grid size-8 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                >
                  <ArrowDown size={15} />
                </button>
              </div>
            )}
            <span
              aria-hidden="true"
              className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-tb-chip text-[11px] font-semibold text-[#57575d] uppercase dark:text-tb-mute"
            >
              {row.file.name.includes('.') ? row.file.name.split('.').pop() : 'FILE'}
            </span>
            <div className="file-details min-w-0 flex-1 basis-48">
              <p className="truncate text-[14px] font-medium">{row.file.name}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-[12px] tabular-nums [overflow-wrap:anywhere]">
                {row.status === 'working' && (
                  <LoaderCircle
                    className="animate-spin shrink-0 text-tb-blue"
                    size={14}
                    aria-hidden="true"
                  />
                )}
                {row.status === 'done' && (
                  <Check className="shrink-0 text-tb-green" size={14} aria-hidden="true" />
                )}
                {row.status === 'error' && (
                  <X
                    className="shrink-0 text-[#c4141f] dark:text-[#ff6961]"
                    size={14}
                    aria-hidden="true"
                  />
                )}
                <span
                  className={
                    row.status === 'error' ? 'text-[#c4141f] dark:text-[#ff6961]' : 'text-tb-mute'
                  }
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
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {row.output && (row.report || image) && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7! px-2.5! text-[12px]!"
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
              {row.status === 'error' && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={retryDisabled}
                  aria-label={`重试 ${row.file.name}`}
                  onClick={onRetry}
                >
                  <RotateCw size={14} />
                  重试
                </Button>
              )}
              <button
                type="button"
                aria-label={`移除 ${row.file.name}`}
                disabled={busy || packing}
                onClick={() => onRemove(row)}
                className="grid size-8 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          {row.notices?.map((notice) => (
            <p className="matrix-notice mx-4!" key={notice}>
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
