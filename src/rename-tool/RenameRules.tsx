import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { RenameOptions } from '@/lib/rename'

type Quick = 'number' | 'replace' | 'affix' | 'base'
export function RenameRules({
  options,
  update,
  busy,
  children,
}: {
  options: RenameOptions
  update: (patch: Partial<RenameOptions>) => void
  busy: boolean
  children: ReactNode
}) {
  const [quick, setQuick] = useState<Quick>('number')
  const text = (
    key: 'base' | 'find' | 'replace' | 'prefix' | 'suffix' | 'customExtension',
    label: string,
    placeholder = '',
  ) => (
    <label key={key}>
      {label}
      <input
        className="tool-input"
        maxLength={255}
        value={options[key]}
        placeholder={placeholder}
        onChange={(event) => update({ [key]: event.target.value })}
      />
    </label>
  )
  const choice = <K extends keyof RenameOptions>(
    key: K,
    label: string,
    values: [RenameOptions[K], string][],
  ) => (
    <label>
      {label}
      <Select
        value={String(options[key])}
        disabled={busy}
        onValueChange={(value) => {
          const selected = values.find(([option]) => String(option) === value)?.[0]
          if (selected !== undefined) update({ [key]: selected })
        }}
      >
        <SelectTrigger aria-label={label}>
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
  const groups: Record<Quick, ReactNode> = {
    base: text('base', '统一名称', '留空保留原名'),
    replace: (
      <>
        {text('find', '查找文字', options.regex ? '正则表达式' : '按原样匹配')}
        {text('replace', '替换为', '留空即删除')}
        <div className="rename-cleanup">
          {(
            [
              ['regex', '正则表达式'],
              ['caseSensitive', '区分大小写'],
            ] as const
          ).map(([key, label]) => (
            <label className="rename-cleanup-item" key={key}>
              <Switch
                aria-label={label}
                checked={options[key]}
                disabled={busy}
                onCheckedChange={(value) => update({ [key]: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </>
    ),
    affix: (
      <>
        {text('prefix', '前缀')}
        {text('suffix', '后缀')}
      </>
    ),
    number: (
      <div className="rename-numbering">
        <label htmlFor="rename-numbering">
          添加编号
          <Switch
            id="rename-numbering"
            checked={options.numbered}
            disabled={busy}
            onCheckedChange={(numbered) => update({ numbered })}
          />
        </label>
        {options.numbered && (
          <div>
            <label>
              起始编号
              <input
                className="tool-input"
                type="number"
                min="0"
                max="1000000"
                value={options.start}
                onChange={(event) => update({ start: Number(event.target.value) })}
              />
            </label>
            {choice(
              'digits',
              '编号位数',
              [1, 2, 3, 4].map((value) => [value, String(1).padStart(value, '0')]),
            )}
          </div>
        )}
      </div>
    ),
  }
  return (
    <>
      <div className="rename-modes" role="group" aria-label="重命名快速模式">
        {(
          [
            ['number', '编号'],
            ['replace', '替换'],
            ['affix', '前后缀'],
            ['base', '统一名称'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={quick === key ? 'secondary' : 'outline'}
            aria-pressed={quick === key}
            disabled={busy}
            onClick={() => setQuick(key)}
          >
            {label}
          </Button>
        ))}
      </div>
      <fieldset className="rename-rules" disabled={busy}>
        <legend className="sr-only">重命名规则</legend>
        {groups[quick]}
      </fieldset>
      <details className="tool-advanced rename-advanced">
        <summary>更多规则与名单导入</summary>
        <fieldset className="rename-rules" disabled={busy}>
          <legend className="sr-only">更多重命名规则</legend>
          {(Object.keys(groups) as Quick[])
            .filter((key) => key !== quick)
            .map((key) => (
              <div className="rename-rule-group" key={key}>
                {groups[key]}
              </div>
            ))}
          {choice('caseMode', '主名大小写', [
            ['keep', '保持原样'],
            ['lower', '全部小写'],
            ['upper', '全部大写'],
            ['title', '单词首字母大写'],
          ])}
          {choice('extensionMode', '扩展名', [
            ['keep', '保持原样'],
            ['lower', '全部小写'],
            ['upper', '全部大写'],
            ['remove', '去掉扩展名'],
            ['custom', '指定扩展名'],
          ])}
          {options.extensionMode === 'custom' &&
            text('customExtension', '新扩展名', '例如 txt；只改名称，不转换内容')}
          {choice('dateSource', '日期来源', [
            ['none', '不添加日期'],
            ['modified', '文件修改时间'],
            ['exif', 'EXIF 拍摄时间'],
          ])}
          {options.dateSource !== 'none' && (
            <>
              {choice('datePosition', '日期位置', [
                ['prefix', '主名前'],
                ['suffix', '主名后'],
                ['replace', '替换主名'],
              ])}
              {choice('dateFormat', '日期格式', [
                ['date', '2026-10-27'],
                ['datetime', '2026-10-27_14-30-00'],
                ['compact', '20261027_143000'],
              ])}
            </>
          )}
          <div className="rename-cleanup">
            <span>清理生成名称：</span>
            {(
              [
                ['specialChars', '特殊字符换成空格'],
                ['spaces', '折叠空格'],
                ['duplicateSeparators', '合并重复分隔符'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="rename-cleanup-item">
                <Switch
                  aria-label={label}
                  checked={options.cleanup[key]}
                  disabled={busy}
                  onCheckedChange={(value) =>
                    update({ cleanup: { ...options.cleanup, [key]: value } })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="conversion-note">
          规则可组合；切换快速模式会保留其他设置。修改扩展名只改变名称，不会转换文件格式。
        </p>
        {children}
      </details>
    </>
  )
}
