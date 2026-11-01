import { useState } from 'react'
import { ArrowDownToLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { OutputActions } from '../../components/OutputActions'
import { TbReveal } from '../../components/tb'
import type { OutputFile } from '../../files/file-convert'

export type PdfSettings = { numbering: boolean; start: string; watermark: string; opacity: number }
export type PdfSplitUi = { mode: 'each' | 'every' | 'ranges'; size: string; ranges: string }
export type PdfSplitOutput = {
  url: string
  name: string
  parts: number
  output: OutputFile
}

/* 设计源「导出」卡字段样式：tb-* 令牌 + 工具类，浅色文本 #57575d 保证对比度 */
const fieldLabel = 'grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute'
const fieldClass =
  'h-9 w-full rounded-[10px] bg-tb-raise px-3 text-[14px] ring-1 ring-tb-line outline-none transition focus:ring-2 focus:ring-[#0071e3] dark:bg-tb-chip'
const segmentOn =
  'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3 py-1 text-[13px] font-medium shadow-sm transition disabled:opacity-50'
const segmentOff =
  'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1 text-[13px] font-medium text-[#57575d] transition enabled:hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute'
const note = 'text-[12px] leading-[1.6] text-tb-mute'

/**
 * 设计源 Toggle 行（src/tools/ui.tsx Toggle 逐字工具类化）：sr-only checkbox + peer 滑块，
 * 开启后行下展开对应字段。可访问名来自行文字（沿用原 details summary 文字，e2e 依赖）。
 */
function ToggleRow({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  label: string
  hint: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="min-w-0">
        <span className="block text-[14px] text-tb-fg">{label}</span>
        <span className="mt-0.5 block text-[12px] text-tb-mute">{hint}</span>
      </span>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="block h-[22px] w-[38px] rounded-full bg-tb-chip transition peer-checked:bg-[#30d158] peer-focus-visible:ring-2 peer-focus-visible:ring-[#0071e3]" />
        <span className="absolute top-[2px] left-[2px] size-[18px] rounded-full bg-white shadow transition peer-checked:translate-x-4" />
      </span>
    </label>
  )
}

/**
 * aside「导出」卡内容：Toggle 驱动、行下展开。
 * 三行分别为「页码与水印」「拆分导出」「PDF 结构压缩」，可访问名沿用原 details summary 文字。
 * 只承载展示与 UI 态，导出/拆分/压缩逻辑全部由 PdfTool 传入的回调执行。
 */
export function PdfOutputSettings({
  settings,
  disabled,
  selected,
  pageCount,
  onSettingsChange,
  split,
  onSplitChange,
  onSplitExport,
  splitOutput,
  compressDisabled,
  onCompress,
}: {
  settings: PdfSettings
  disabled: boolean
  selected: number
  pageCount: number
  onSettingsChange: (value: PdfSettings) => void
  split: PdfSplitUi
  onSplitChange: (patch: Partial<PdfSplitUi>) => void
  onSplitExport: () => void
  splitOutput: PdfSplitOutput | null
  compressDisabled: boolean
  onCompress: () => void
}) {
  const [decorationsOpen, setDecorationsOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const [compressOpen, setCompressOpen] = useState(false)
  const splitDisabled = disabled || !selected
  return (
    <div className="divide-y divide-tb-line">
      <div>
        <ToggleRow
          checked={decorationsOpen}
          onChange={setDecorationsOpen}
          label="页码与水印"
          hint="按导出顺序添加底部页码，可另加居中斜向水印"
        />
        <TbReveal open={decorationsOpen}>
          <div className="flex flex-col gap-2.5 pb-2">
            <label className="flex cursor-pointer items-center justify-between gap-3 py-0.5 text-[14px] text-tb-fg">
              <span>添加页码</span>
              <Switch
                aria-label="添加 PDF 页码"
                checked={settings.numbering}
                disabled={disabled}
                onCheckedChange={(numbering) => onSettingsChange({ ...settings, numbering })}
              />
            </label>
            {settings.numbering && (
              <label className={fieldLabel}>
                起始页码
                <input
                  type="number"
                  className={`${fieldClass} tabular-nums`}
                  aria-label="PDF 起始页码"
                  min={1}
                  max={99999}
                  value={settings.start}
                  disabled={disabled}
                  onChange={(event) => onSettingsChange({ ...settings, start: event.target.value })}
                />
              </label>
            )}
            <label className={fieldLabel}>
              水印文字
              <input
                className={fieldClass}
                aria-label="PDF 水印文字"
                value={settings.watermark}
                maxLength={80}
                placeholder="留空不添加，最多 80 字符"
                disabled={disabled}
                onChange={(event) =>
                  onSettingsChange({ ...settings, watermark: event.target.value })
                }
              />
            </label>
            {settings.watermark.trim() && (
              <label className={fieldLabel}>
                不透明度 {settings.opacity}%
                <input
                  aria-label="PDF 水印不透明度"
                  type="range"
                  min={10}
                  max={80}
                  value={settings.opacity}
                  disabled={disabled}
                  onChange={(event) =>
                    onSettingsChange({ ...settings, opacity: Number(event.target.value) })
                  }
                  className="accent-[#0071e3]"
                />
              </label>
            )}
            <p className={note}>
              按导出顺序添加底部页码和居中斜向水印，保留原有的可选文字；导出后可预览。拆分的每个文件分别从起始页码编号。水印和密码不保存到浏览器设置。
            </p>
          </div>
        </TbReveal>
      </div>
      {pageCount > 1 && (
        <div>
          <ToggleRow
            checked={splitOpen}
            onChange={setSplitOpen}
            label="拆分导出"
            hint="每页 / 每 N 页 / 按页码段拆分并打包 ZIP"
          />
          <TbReveal open={splitOpen}>
            <div className="flex flex-col gap-2.5 pb-2">
              <div
                role="group"
                aria-label="拆分方式"
                className="inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-tb-chip p-1"
              >
                {(
                  [
                    ['each', '每页'],
                    ['every', '每 N 页'],
                    ['ranges', '自定义'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={split.mode === value}
                    disabled={splitDisabled}
                    className={split.mode === value ? segmentOn : segmentOff}
                    onClick={() => onSplitChange({ mode: value })}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {split.mode === 'every' && (
                <label className={fieldLabel}>
                  每份页数
                  <input
                    className={`${fieldClass} tabular-nums`}
                    aria-label="每份页数"
                    disabled={splitDisabled}
                    value={split.size}
                    onChange={(event) => onSplitChange({ size: event.target.value })}
                  />
                </label>
              )}
              {split.mode === 'ranges' && (
                <label className={fieldLabel}>
                  页码段（按当前排序，每页恰属一段）
                  <input
                    className={fieldClass}
                    aria-label="拆分页码段"
                    disabled={splitDisabled}
                    placeholder="如 1-3,4-6"
                    value={split.ranges}
                    onChange={(event) => onSplitChange({ ranges: event.target.value })}
                  />
                </label>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" disabled={splitDisabled} onClick={onSplitExport}>
                  拆分导出 ({selected} 页)
                </Button>
                {splitOutput && (
                  <OutputActions outputs={[splitOutput.output]} disabled={disabled} />
                )}
                {splitOutput && (
                  <Button variant="outline" asChild>
                    <a href={splitOutput.url} download={splitOutput.name}>
                      <ArrowDownToLine size={14} />
                      下载 {splitOutput.name}（{splitOutput.parts} 份）
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </TbReveal>
        </div>
      )}
      <div>
        <ToggleRow
          checked={compressOpen}
          onChange={setCompressOpen}
          label="PDF 结构压缩"
          hint="压缩结构与数据流，保留文字与图片分辨率"
        />
        <TbReveal open={compressOpen}>
          <div className="flex flex-col gap-2.5 pb-2">
            <p className={note}>
              压缩文档数据流和内部结构，保留文字与图片分辨率，不转成图片。已经压缩的照片或扫描件可能无法继续缩小，未减小时保留输入内容。只压缩当前所选页；未改动的单文件保留其完整结构。
            </p>
            <div>
              <Button variant="outline" disabled={compressDisabled} onClick={onCompress}>
                压缩并导出所选
              </Button>
            </div>
          </div>
        </TbReveal>
      </div>
    </div>
  )
}
