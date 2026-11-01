import { useState, type ReactNode } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RenameOptions } from '@/features/toolbox/rename/rename'
import { TbCollapsible, TbReveal } from '@/features/toolbox/components/tb'

/**
 * 批量重命名侧栏，对齐设计源（Redesign Personal Portfolio Website / RenameTool）：
 * - 「命名规则」卡：Segmented 快速模式，字段随模式显隐（编号 / 替换 / 前后缀 / 统一名称）。
 * - 「更多」卡：大小写与扩展名、修改时间与清理开关（开启后行下展开字段，同表格页 StepCard）、
 *   文件排序与读取照片时间、Collapsible 名称清单导入。
 * 功能超集完整保留：所有 aria-label / 文案逐字沿用旧版（e2e 依赖）；仅重排结构，不改生成逻辑。
 */

type Quick = 'number' | 'replace' | 'affix' | 'base'
type UpdateFn = (patch: Partial<RenameOptions>) => void

const labelCls = 'grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute'

function textField(
  key: 'base' | 'find' | 'replace' | 'prefix' | 'suffix' | 'customExtension',
  options: RenameOptions,
  update: UpdateFn,
  busy: boolean,
  label: string,
  placeholder?: string,
) {
  return (
    <label className={labelCls}>
      {label}
      <input
        className="tool-input"
        maxLength={255}
        value={options[key]}
        placeholder={placeholder}
        disabled={busy}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </label>
  )
}

function choiceField<K extends keyof RenameOptions>(
  key: K,
  options: RenameOptions,
  update: UpdateFn,
  busy: boolean,
  label: string,
  values: [RenameOptions[K], string][],
) {
  return (
    <label className={labelCls}>
      {label}
      <Select
        value={String(options[key])}
        disabled={busy}
        onValueChange={(value) => {
          const selected = values.find(([option]) => String(option) === value)?.[0]
          if (selected !== undefined) update({ [key]: selected })
        }}
      >
        <SelectTrigger aria-label={label} className="font-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map(([value, name]) => (
            <SelectItem key={String(value)} value={String(value)}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function switchRow(
  label: string,
  checked: boolean,
  disabled: boolean,
  onChange: (value: boolean) => void,
) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[14px] text-tb-fg">
      <span>{label}</span>
      <Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  )
}

/** 「命名规则」卡：快速模式 Segmented + 随模式显隐的字段 */
export function RenameRules({
  options,
  update,
  busy,
}: {
  options: RenameOptions
  update: UpdateFn
  busy: boolean
}) {
  const [quick, setQuick] = useState<Quick>('number')
  const numbering = (
    <>
      {switchRow('添加编号', options.numbered, busy, (value) => update({ numbered: value }))}
      {/* 保持条件渲染：外层 fieldset 是 flex gap 容器，常驻 0 高展开体也会占一格 gap */}
      {options.numbered && (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
          <label className={labelCls}>
            起始编号
            <input
              className="tool-input"
              type="number"
              min={0}
              max={1000000}
              value={options.start}
              disabled={busy}
              onChange={(event) => update({ start: Number(event.target.value) })}
            />
          </label>
          {choiceField(
            'digits',
            options,
            update,
            busy,
            '编号位数',
            [1, 2, 3, 4].map((value) => [value, String(1).padStart(value, '0')]),
          )}
        </div>
      )}
    </>
  )
  return (
    <>
      <div
        role="group"
        aria-label="重命名快速模式"
        className="inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-tb-chip p-1"
      >
        {(
          [
            ['number', '编号'],
            ['replace', '替换'],
            ['affix', '前后缀'],
            ['base', '统一名称'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={quick === key}
            disabled={busy}
            onClick={() => setQuick(key)}
            className={
              quick === key
                ? 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3.5 py-1.5 text-[14px] font-medium shadow-sm transition disabled:opacity-50'
                : 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-1.5 text-[14px] font-medium text-[#57575d] transition enabled:hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute dark:enabled:hover:text-tb-fg'
            }
          >
            {label}
          </button>
        ))}
      </div>
      <fieldset disabled={busy} className="mt-4 flex flex-col gap-3">
        <legend className="sr-only">重命名规则</legend>
        {(quick === 'number' || quick === 'base') && (
          <>
            {quick === 'base' &&
              textField('base', options, update, busy, '统一名称', '留空保留原名')}
            {numbering}
          </>
        )}
        {quick === 'replace' && (
          <>
            {textField(
              'find',
              options,
              update,
              busy,
              '查找文字',
              options.regex ? '正则表达式' : '按原样匹配',
            )}
            {textField('replace', options, update, busy, '替换为', '留空即删除')}
            <div className="flex flex-col divide-y divide-tb-line">
              {switchRow('正则表达式', options.regex, busy, (value) => update({ regex: value }))}
              {switchRow('区分大小写', options.caseSensitive, busy, (value) =>
                update({ caseSensitive: value }),
              )}
            </div>
          </>
        )}
        {quick === 'affix' && (
          <>
            {textField('prefix', options, update, busy, '前缀')}
            {textField('suffix', options, update, busy, '后缀')}
          </>
        )}
        <p className="text-[12px] leading-[1.6] text-tb-mute">
          规则可组合；切换快速模式会保留其他设置。
        </p>
      </fieldset>
    </>
  )
}

/** 「更多」卡：大小写 / 扩展名、修改时间、清理特殊字符、文件排序与名称清单导入 */
export function RenameMore({
  options,
  update,
  busy,
  sortRow,
  children,
}: {
  options: RenameOptions
  update: UpdateFn
  busy: boolean
  sortRow?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        {choiceField('caseMode', options, update, busy, '主名大小写', [
          ['keep', '保持原样'],
          ['lower', '全部小写'],
          ['upper', '全部大写'],
          ['title', '单词首字母大写'],
        ])}
        {choiceField('extensionMode', options, update, busy, '扩展名', [
          ['keep', '保持原样'],
          ['lower', '全部小写'],
          ['upper', '全部大写'],
          ['remove', '去掉扩展名'],
          ['custom', '指定扩展名'],
        ])}
      </div>
      {options.extensionMode === 'custom' &&
        textField(
          'customExtension',
          options,
          update,
          busy,
          '新扩展名',
          '例如 txt；只改名称，不转换内容',
        )}
      <p className="text-[12px] leading-[1.6] text-tb-mute">
        修改扩展名只改变名称，不会转换文件格式。
      </p>
      <div className="border-t border-tb-line pt-1.5">
        {switchRow('修改时间', options.dateSource !== 'none', busy, (on) =>
          update({ dateSource: on ? 'modified' : 'none' }),
        )}
        <TbReveal open={options.dateSource !== 'none'}>
          <div className="flex flex-col gap-2.5 pt-1.5 pb-1">
            {choiceField('dateSource', options, update, busy, '日期来源', [
              ['modified', '文件修改时间'],
              ['exif', 'EXIF 拍摄时间'],
            ])}
            {choiceField('datePosition', options, update, busy, '日期位置', [
              ['prefix', '主名前'],
              ['suffix', '主名后'],
              ['replace', '替换主名'],
            ])}
            {choiceField('dateFormat', options, update, busy, '日期格式', [
              ['date', '2026-10-27'],
              ['datetime', '2026-10-27_14-30-00'],
              ['compact', '20261027_143000'],
            ])}
          </div>
        </TbReveal>
      </div>
      <div className="border-t border-tb-line pt-1.5">
        {switchRow('特殊字符换成空格', options.cleanup.specialChars, busy, (on) =>
          update({ cleanup: { ...options.cleanup, specialChars: on } }),
        )}
        <TbReveal open={options.cleanup.specialChars}>
          <div className="flex flex-col pt-1 pb-1">
            {switchRow('折叠空格', options.cleanup.spaces, busy, (on) =>
              update({ cleanup: { ...options.cleanup, spaces: on } }),
            )}
            {switchRow('合并重复分隔符', options.cleanup.duplicateSeparators, busy, (on) =>
              update({ cleanup: { ...options.cleanup, duplicateSeparators: on } }),
            )}
          </div>
        </TbReveal>
      </div>
      {sortRow}
      <TbCollapsible title="从名称清单导入" hint="每行一个，按当前顺序对应">
        {children}
      </TbCollapsible>
    </div>
  )
}
