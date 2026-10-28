import { Switch } from '@/components/ui/switch'

export type PdfSettings = { numbering: boolean; start: string; watermark: string; opacity: number }
export function PdfOutputSettings({
  value,
  disabled,
  onChange,
}: {
  value: PdfSettings
  disabled: boolean
  onChange: (value: PdfSettings) => void
}) {
  const update = (patch: Partial<PdfSettings>) => onChange({ ...value, ...patch })
  return (
    <details className="tool-advanced pdf-output-settings">
      <summary>页码与水印</summary>
      <label className="compare-switch">
        <Switch
          aria-label="添加 PDF 页码"
          checked={value.numbering}
          disabled={disabled}
          onCheckedChange={(numbering) => update({ numbering })}
        />
        添加页码
      </label>
      {value.numbering && (
        <label className="pdf-setting-field">
          起始页码
          <input
            type="number"
            className="tool-input"
            aria-label="PDF 起始页码"
            min={1}
            max={99999}
            value={value.start}
            disabled={disabled}
            onChange={(event) => update({ start: event.target.value })}
          />
        </label>
      )}
      <label className="pdf-setting-field">
        水印文字
        <input
          className="tool-input"
          aria-label="PDF 水印文字"
          value={value.watermark}
          maxLength={80}
          placeholder="留空不添加，最多 80 字符"
          disabled={disabled}
          onChange={(event) => update({ watermark: event.target.value })}
        />
      </label>
      {value.watermark.trim() && (
        <label className="image-watermark-opacity">
          不透明度 {value.opacity}%
          <input
            aria-label="PDF 水印不透明度"
            type="range"
            min={10}
            max={80}
            value={value.opacity}
            disabled={disabled}
            onChange={(event) => update({ opacity: Number(event.target.value) })}
          />
        </label>
      )}
      <p className="conversion-note">
        按导出顺序添加底部页码和居中斜向水印，保留原有的可选文字；导出后可预览。拆分的每个文件分别从起始页码编号。水印和密码不保存到浏览器设置。
      </p>
    </details>
  )
}
