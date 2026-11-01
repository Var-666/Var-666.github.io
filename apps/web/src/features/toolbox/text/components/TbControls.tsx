import type { ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

/**
 * 文本工具对齐设计源的基础控件（逐字移植 Redesign Personal Portfolio Website src/tools/ui.tsx）：
 * TbSegmented（分段选择）与 TbToggleRow（平铺规则开关行，开启即生效，children 为行下展开的细项）。
 * 开关沿用 shadcn Switch（Radix role=switch，e2e 依赖其角色），仅用工具类把外观调成设计源 Toggle。
 */

const toggleTrack =
  'mt-0.5 h-[22px] w-[38px] shrink-0 rounded-full border-transparent bg-tb-chip shadow-none data-[state=checked]:bg-[#30d158] data-[state=unchecked]:bg-tb-chip [&>span]:h-[18px] [&>span]:w-[18px] [&>span]:bg-white [&>span]:shadow-sm'

export function TbSegmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  ariaLabel,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  ariaLabel?: string
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-tb-chip p-1"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className={cn(
            'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] font-medium transition',
            size === 'sm' ? 'px-3 py-1 text-[13px]' : 'px-3.5 py-1.5 text-[14px]',
            option.value === value
              ? 'bg-tb-card shadow-sm'
              : 'text-[#57575d] hover:text-tb-fg dark:text-tb-mute',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function TbToggleRow({
  label,
  hint,
  checked,
  onChange,
  small = false,
  children,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
  small?: boolean
  children?: ReactNode
}) {
  return (
    <div className="py-2">
      <label className="flex cursor-pointer items-start justify-between gap-4">
        <span className="min-w-0">
          <span
            className={cn('block leading-6', small ? 'text-[13px] text-tb-mute' : 'text-[14px]')}
          >
            {label}
          </span>
          {hint && <span className="mt-0.5 block text-[12px] leading-5 text-tb-mute">{hint}</span>}
        </span>
        <Switch
          aria-label={label}
          checked={checked}
          onCheckedChange={onChange}
          className={toggleTrack}
        />
      </label>
      {checked && children && <div className="pb-2">{children}</div>}
    </div>
  )
}
