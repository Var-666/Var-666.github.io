import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { supportsImageEncoding } from '@/features/toolbox/files/image-decode'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ImageSize, PdfSheetSize } from '@/features/toolbox/files/media-options'
import type { FileOptions } from '../options'
import { modes, type Mode } from '../modes'
import { TextEncodingSelect } from '@/features/toolbox/components/TextEncodingSelect'
import type { TextEncoding } from '@/features/toolbox/lib/text-encoding'

// 右栏「设置」卡的选项区：结构对齐设计源 aside（TbLabel 行 + 设计源 Collapsible 观感的
// 折叠块）。可访问名 / 选项 / 文案逐字保留（e2e 依赖 aria-label 与 summary 文字）。
export function ConversionOptions({
  mode,
  options,
  disabled,
  onChange,
  encoding,
  onEncodingChange,
}: {
  mode: Mode
  options: FileOptions
  disabled: boolean
  onChange: (patch: Partial<FileOptions>) => void
  encoding: TextEncoding
  onEncodingChange: (value: TextEncoding) => void
}) {
  const [avif] = useState(() => supportsImageEncoding('avif'))
  const {
    format,
    imageSize,
    quality,
    compressTarget,
    compressFormat,
    pdfFormat,
    pdfLayout,
    mergeSize,
    mergeOrientation,
    mergeFit,
    pages,
    detectNumbers,
  } = options
  const textInput =
    modes[mode].category === 'text' ||
    (modes[mode].category === 'table' && !mode.startsWith('excel-'))
  const fieldLabel = 'grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute'
  return (
    <div className="flex flex-col gap-4">
      {mode === 'image' && (
        <label className={fieldLabel}>
          输出格式
          <Select
            disabled={disabled}
            value={format}
            onValueChange={(value) => {
              onChange({ format: value as typeof format })
            }}
          >
            <SelectTrigger aria-label="输出格式" className="font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="png">PNG</SelectItem>
              <SelectItem value="jpeg">JPG</SelectItem>
              <SelectItem value="webp">WebP</SelectItem>
              <SelectItem value="avif" disabled={!avif}>
                {avif ? 'AVIF' : 'AVIF（当前浏览器不支持编码）'}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}
      {mode === 'image-compress' && (
        <label className={fieldLabel}>
          目标大小
          <Select
            disabled={disabled}
            value={compressTarget}
            onValueChange={(value) => {
              onChange({ compressTarget: value as typeof compressTarget })
            }}
          >
            <SelectTrigger aria-label="目标大小" className="font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="100">100 KB</SelectItem>
              <SelectItem value="200">200 KB</SelectItem>
              <SelectItem value="500">500 KB</SelectItem>
              <SelectItem value="1000">1 MB</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}
      {mode === 'image-pdf' && (
        <label className={fieldLabel}>
          页面尺寸
          <Select
            disabled={disabled}
            value={mergeSize}
            onValueChange={(value) => {
              onChange({ mergeSize: value as PdfSheetSize })
            }}
          >
            <SelectTrigger aria-label="页面尺寸" className="font-normal">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="a4">A4（210 × 297 mm）</SelectItem>
              <SelectItem value="a3">A3（297 × 420 mm）</SelectItem>
              <SelectItem value="letter">Letter（215.9 × 279.4 mm）</SelectItem>
            </SelectContent>
          </Select>
        </label>
      )}
      {mode === 'pdf-image' && (
        <>
          <label className={fieldLabel}>
            输出格式
            <Select
              disabled={disabled}
              value={pdfFormat}
              onValueChange={(value) => {
                onChange({ pdfFormat: value as typeof pdfFormat })
              }}
            >
              <SelectTrigger aria-label="PDF 图片格式" className="font-normal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPG</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label className={fieldLabel}>
            导出方式
            <Select
              disabled={disabled}
              value={pdfLayout}
              onValueChange={(value) => {
                onChange({ pdfLayout: value as typeof pdfLayout })
              }}
            >
              <SelectTrigger aria-label="PDF 导出方式" className="font-normal">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pages">逐页图片</SelectItem>
                <SelectItem value="long">拼成长图</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </>
      )}
      {mode === 'image' && format === 'avif' && !avif && (
        <p
          className="flex items-start gap-2 rounded-[14px] bg-[#0071e3]/10 px-3.5 py-2.5 text-[13px] leading-[1.5] text-[#0058b0] dark:text-[#64b5ff]"
          role="status"
        >
          当前浏览器不支持 AVIF 编码，请改用 PNG、JPG 或 WebP。
        </p>
      )}
      <details key={mode} className="group rounded-[18px] ring-1 ring-tb-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-[14px] font-medium [&::-webkit-details-marker]:hidden">
          高级设置与说明
          <ChevronDown
            size={16}
            className="shrink-0 text-tb-mute transition group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col gap-4 px-4 pb-4">
          {mode === 'image' && (
            <>
              <label className={fieldLabel}>
                尺寸
                <Select
                  disabled={disabled}
                  value={imageSize}
                  onValueChange={(value) => {
                    onChange({ imageSize: value as ImageSize })
                  }}
                >
                  <SelectTrigger aria-label="图片尺寸" className="font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">原尺寸</SelectItem>
                    <SelectItem value="1920">宽度 ≤ 1920</SelectItem>
                    <SelectItem value="1280">宽度 ≤ 1280</SelectItem>
                    <SelectItem value="half">缩放 50%</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              {format !== 'png' && (
                <label className={fieldLabel}>
                  质量 {quality}%
                  <input
                    type="range"
                    aria-label="图片质量"
                    min="10"
                    max="100"
                    disabled={disabled}
                    value={quality}
                    onChange={(event) => {
                      onChange({ quality: Number(event.target.value) })
                    }}
                    className="w-full accent-[#0071e3]"
                  />
                </label>
              )}
            </>
          )}
          {mode === 'image-compress' && (
            <>
              <label className={fieldLabel}>
                输出格式
                <Select
                  disabled={disabled}
                  value={compressFormat}
                  onValueChange={(value) => {
                    onChange({ compressFormat: value as typeof compressFormat })
                  }}
                >
                  <SelectTrigger aria-label="压缩输出格式" className="font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="jpeg">JPG</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className={fieldLabel}>
                尺寸上限
                <Select
                  disabled={disabled}
                  value={imageSize}
                  onValueChange={(value) => {
                    onChange({ imageSize: value as ImageSize })
                  }}
                >
                  <SelectTrigger aria-label="尺寸上限" className="font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="original">原尺寸</SelectItem>
                    <SelectItem value="1920">宽度 ≤ 1920</SelectItem>
                    <SelectItem value="1280">宽度 ≤ 1280</SelectItem>
                    <SelectItem value="half">缩放 50%</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </>
          )}
          {mode === 'image-pdf' && (
            <>
              <label className={fieldLabel}>
                方向
                <Select
                  disabled={disabled}
                  value={mergeOrientation}
                  onValueChange={(value) => {
                    onChange({ mergeOrientation: value as typeof mergeOrientation })
                  }}
                >
                  <SelectTrigger aria-label="页面方向" className="font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">纵向</SelectItem>
                    <SelectItem value="landscape">横向</SelectItem>
                  </SelectContent>
                </Select>
              </label>
              <label className={fieldLabel}>
                适配
                <Select
                  disabled={disabled}
                  value={mergeFit}
                  onValueChange={(value) => {
                    onChange({ mergeFit: value as typeof mergeFit })
                  }}
                >
                  <SelectTrigger aria-label="图片适配" className="font-normal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contain">完整显示（留白）</SelectItem>
                    <SelectItem value="cover">填满页面</SelectItem>
                  </SelectContent>
                </Select>
              </label>
            </>
          )}
          {mode === 'pdf-image' && (
            <label className={fieldLabel}>
              页码
              <input
                className="tool-input"
                aria-label="PDF 页码"
                disabled={disabled}
                placeholder="全部页，如 1,3-5"
                value={pages}
                onChange={(event) => {
                  onChange({ pages: event.target.value })
                }}
              />
            </label>
          )}
          {mode === 'csv-excel' && (
            <label className="flex items-start gap-3 py-1">
              <Switch
                aria-label="尝试识别数字"
                checked={detectNumbers}
                disabled={disabled}
                onCheckedChange={(value) => {
                  onChange({ detectNumbers: value })
                }}
              />
              <span className="flex flex-col gap-0.5 text-[12px] leading-[1.5] text-tb-mute">
                尝试识别数字
                <small>仅转换无前导零、非科学计数的普通数字；编号与长整数保持文本</small>
              </span>
            </label>
          )}
          {textInput && (
            <TextEncodingSelect value={encoding} disabled={disabled} onChange={onEncodingChange} />
          )}
          <p className="text-[12px] leading-[1.5] text-tb-mute">{modes[mode].note}</p>
          {modes[mode].category === 'image' && (
            <p className="text-[12px] leading-[1.5] text-tb-mute">
              HEIC / HEIF 只导出主图；深度、多图、HDR 和原始元数据不保留，色彩可能变化。AVIF
              输出依浏览器编码能力。
            </p>
          )}
          <p className="text-[12px] leading-[1.5] text-tb-mute">{modes[mode].hint}</p>
        </div>
      </details>
    </div>
  )
}
