import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TextEncoding } from '@/features/toolbox/lib/text-encoding'

export function TextEncodingSelect({
  value,
  onChange,
  disabled = false,
  label = '读取编码',
}: {
  value: TextEncoding
  onChange: (value: TextEncoding) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <label className="encoding-control">
      <span>{label}</span>
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(value) => onChange(value as TextEncoding)}
      >
        <SelectTrigger aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">自动识别</SelectItem>
          <SelectItem value="utf-8">UTF-8</SelectItem>
          <SelectItem value="gb18030">GBK / GB18030</SelectItem>
        </SelectContent>
      </Select>
    </label>
  )
}
