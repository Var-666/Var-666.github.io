import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import type { ImageSize, PdfSheetSize } from '@/lib/media-options'
import type { FileOptions } from './options'
import { modes, type Mode } from './modes'
import { TextEncodingSelect } from '@/components/TextEncodingSelect'
import type { TextEncoding } from '@/lib/text-encoding'

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
  return (
    <div className="conversion-options">
      {mode === 'image' && (
        <div className="image-options">
          <label>
            输出格式
            <Select
              disabled={disabled}
              value={format}
              onValueChange={(value) => {
                onChange({ format: value as typeof format })
              }}
            >
              <SelectTrigger aria-label="输出格式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPG</SelectItem>
                <SelectItem value="webp">WebP</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      )}
      {mode === 'image-compress' && (
        <div className="image-options">
          <label>
            目标大小
            <Select
              disabled={disabled}
              value={compressTarget}
              onValueChange={(value) => {
                onChange({ compressTarget: value as typeof compressTarget })
              }}
            >
              <SelectTrigger aria-label="目标大小">
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
        </div>
      )}
      {mode === 'image-pdf' && (
        <div className="image-options">
          <label>
            页面尺寸
            <Select
              disabled={disabled}
              value={mergeSize}
              onValueChange={(value) => {
                onChange({ mergeSize: value as PdfSheetSize })
              }}
            >
              <SelectTrigger aria-label="页面尺寸">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="a4">A4（210 × 297 mm）</SelectItem>
                <SelectItem value="a3">A3（297 × 420 mm）</SelectItem>
                <SelectItem value="letter">Letter（215.9 × 279.4 mm）</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      )}
      {mode === 'pdf-image' && (
        <div className="image-options">
          <label>
            输出格式
            <Select
              disabled={disabled}
              value={pdfFormat}
              onValueChange={(value) => {
                onChange({ pdfFormat: value as typeof pdfFormat })
              }}
            >
              <SelectTrigger aria-label="PDF 图片格式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="png">PNG</SelectItem>
                <SelectItem value="jpeg">JPG</SelectItem>
              </SelectContent>
            </Select>
          </label>
          <label>
            导出方式
            <Select
              disabled={disabled}
              value={pdfLayout}
              onValueChange={(value) => {
                onChange({ pdfLayout: value as typeof pdfLayout })
              }}
            >
              <SelectTrigger aria-label="PDF 导出方式">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pages">逐页图片</SelectItem>
                <SelectItem value="long">拼成长图</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </div>
      )}
      <details key={mode} className="tool-advanced conversion-advanced">
        <summary>高级设置与说明</summary>
        {mode === 'image' && (
          <div className="image-options">
            <label>
              尺寸
              <Select
                disabled={disabled}
                value={imageSize}
                onValueChange={(value) => {
                  onChange({ imageSize: value as ImageSize })
                }}
              >
                <SelectTrigger aria-label="图片尺寸">
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
              <label>
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
                />
              </label>
            )}
          </div>
        )}
        {mode === 'image-compress' && (
          <div className="image-options">
            <label>
              输出格式
              <Select
                disabled={disabled}
                value={compressFormat}
                onValueChange={(value) => {
                  onChange({ compressFormat: value as typeof compressFormat })
                }}
              >
                <SelectTrigger aria-label="压缩输出格式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="jpeg">JPG</SelectItem>
                  <SelectItem value="webp">WebP</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              尺寸上限
              <Select
                disabled={disabled}
                value={imageSize}
                onValueChange={(value) => {
                  onChange({ imageSize: value as ImageSize })
                }}
              >
                <SelectTrigger aria-label="尺寸上限">
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
          </div>
        )}
        {mode === 'image-pdf' && (
          <div className="image-options">
            <label>
              方向
              <Select
                disabled={disabled}
                value={mergeOrientation}
                onValueChange={(value) => {
                  onChange({ mergeOrientation: value as typeof mergeOrientation })
                }}
              >
                <SelectTrigger aria-label="页面方向">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="portrait">纵向</SelectItem>
                  <SelectItem value="landscape">横向</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              适配
              <Select
                disabled={disabled}
                value={mergeFit}
                onValueChange={(value) => {
                  onChange({ mergeFit: value as typeof mergeFit })
                }}
              >
                <SelectTrigger aria-label="图片适配">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">完整显示（留白）</SelectItem>
                  <SelectItem value="cover">填满页面</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        )}
        {mode === 'pdf-image' && (
          <div className="image-options">
            <label>
              页码
              <input
                className="page-range"
                aria-label="PDF 页码"
                disabled={disabled}
                placeholder="全部页，如 1,3-5"
                value={pages}
                onChange={(event) => {
                  onChange({ pages: event.target.value })
                }}
              />
            </label>
          </div>
        )}
        {mode === 'csv-excel' && (
          <div className="image-options">
            <label className="number-toggle">
              <Switch
                aria-label="尝试识别数字"
                checked={detectNumbers}
                disabled={disabled}
                onCheckedChange={(value) => {
                  onChange({ detectNumbers: value })
                }}
              />
              <span>
                尝试识别数字
                <small>仅转换无前导零、非科学计数的普通数字；编号与长整数保持文本</small>
              </span>
            </label>
          </div>
        )}
        {textInput && (
          <TextEncodingSelect value={encoding} disabled={disabled} onChange={onEncodingChange} />
        )}
        <p className="conversion-note">{modes[mode].note}</p>
        <p className="conversion-note">{modes[mode].hint}</p>
      </details>
    </div>
  )
}
