import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  defaultImageEdit,
  type ImageEditOptions as Options,
} from '@/features/toolbox/files/image-edit'

// 右栏「设置」卡的图片编辑折叠块：设计源 Collapsible 观感（18px 圆角 ring + 旋转箭头）。
// summary 文字与全部表单 aria-label 逐字保留；tool-input 保持 36px 高（e2e 断言）。
export function ImageEditOptions({
  value,
  disabled,
  onChange,
}: {
  value: Options
  disabled: boolean
  onChange: (value: Options) => void
}) {
  const update = (patch: Partial<Options>) => onChange({ ...value, ...patch })
  const fieldLabel = 'grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute'
  const numeric = (
    key: 'percent' | 'width' | 'height' | 'x' | 'y' | 'cropWidth' | 'cropHeight',
    label: string,
    min: number,
    max: number,
  ) => (
    <label className={fieldLabel}>
      {label}
      <input
        className="tool-input"
        type="number"
        aria-label={label}
        value={value[key]}
        min={min}
        max={max}
        step={key === 'width' || key === 'height' ? 1 : 0.1}
        disabled={disabled}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </label>
  )
  return (
    <details className="group mt-4 rounded-[18px] ring-1 ring-tb-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-left text-[14px] font-medium [&::-webkit-details-marker]:hidden">
        裁剪、旋转与水印
        <ChevronDown size={16} className="shrink-0 text-tb-mute transition group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-4 px-4 pb-4">
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <legend className="text-[12px] font-semibold text-tb-mute">尺寸与旋转</legend>
          <div className="flex flex-col gap-3">
            <label className={fieldLabel}>
              缩放方式
              <Select
                value={value.resize}
                disabled={disabled}
                onValueChange={(resize) => update({ resize: resize as Options['resize'] })}
              >
                <SelectTrigger aria-label="缩放方式" className="font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">沿用尺寸预设</SelectItem>
                  <SelectItem value="percent">按百分比缩放</SelectItem>
                  <SelectItem value="exact">指定像素宽高</SelectItem>
                </SelectContent>
              </Select>
            </label>
            {value.resize === 'percent' && numeric('percent', '缩放百分比', 0.1, 400)}
            {value.resize === 'exact' && (
              <>
                {numeric('width', '输出宽度（px）', 1, 16384)}
                {numeric('height', '输出高度（px）', 1, 16384)}
              </>
            )}
            <label className={fieldLabel}>
              旋转
              <Select
                value={String(value.rotation)}
                disabled={disabled}
                onValueChange={(rotation) =>
                  update({ rotation: Number(rotation) as Options['rotation'] })
                }
              >
                <SelectTrigger aria-label="图片旋转角度" className="font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 90, 180, 270].map((angle) => (
                    <SelectItem key={angle} value={String(angle)}>
                      {angle ? `顺时针 ${angle}°` : '不旋转'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          {value.resize === 'exact' && (
            <p className="text-[12px] leading-[1.5] text-tb-mute">
              只填宽或高会等比缩放；两项都填会调整到指定尺寸。输出仍限 2400 万像素。
            </p>
          )}
        </fieldset>
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <legend>
            <label className="compare-switch">
              <Switch
                aria-label="启用图片裁剪"
                checked={value.crop}
                disabled={disabled}
                onCheckedChange={(crop) => update({ crop })}
              />
              裁剪
            </label>
          </legend>
          {value.crop && (
            <>
              <div className="flex flex-col gap-3">
                {numeric('x', '左边距（%）', 0, 99.9)}
                {numeric('y', '上边距（%）', 0, 99.9)}
                {numeric('cropWidth', '裁剪宽度（%）', 0.1, 100)}
                {numeric('cropHeight', '裁剪高度（%）', 0.1, 100)}
              </div>
              <p className="text-[12px] leading-[1.5] text-tb-mute">
                相对于每张原图，先裁剪、再旋转与缩放；批量文件使用相同比例。
              </p>
            </>
          )}
        </fieldset>
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <legend className="text-[12px] font-semibold text-tb-mute">批量水印</legend>
          <label className={fieldLabel}>
            水印文字
            <input
              className="tool-input"
              aria-label="图片水印文字"
              value={value.watermark}
              maxLength={80}
              placeholder="留空不加水印，如：仅供办理租房使用"
              onChange={(event) => update({ watermark: event.target.value })}
            />
          </label>
          {value.watermark.trim() && (
            <label className="flex items-center gap-3 text-[12px] font-semibold text-tb-mute">
              不透明度 {value.opacity}%
              <input
                type="range"
                aria-label="图片水印不透明度"
                min={10}
                max={80}
                value={value.opacity}
                disabled={disabled}
                onChange={(event) => update({ opacity: Number(event.target.value) })}
                className="w-full flex-1 accent-[#0071e3]"
              />
            </label>
          )}
          <p className="text-[12px] leading-[1.5] text-tb-mute">
            斜向平铺，应用到队列全部图片；水印文字仅留在当前标签页。
          </p>
        </fieldset>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onChange(defaultImageEdit)}
        >
          重置图片编辑
        </Button>
      </div>
    </details>
  )
}
