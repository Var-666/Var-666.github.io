import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  defaultExtraction,
  extractionPresets,
  type ChineseDirection,
  type ExtractionOptions,
  type TextExtraJob,
} from '@/lib/text-extra'
import { DIFF_MAX_CHARS } from '@/lib/text-diff'
import { useTextExtra } from './useTextExtra'
import { OverlayMarks } from './DiffOverlay'

export function TextExtras({
  active,
  source,
  onApply,
}: {
  active: boolean
  source: string
  onApply: (label: string, text: string) => void
}) {
  const [extraction, setExtraction] = useState(defaultExtraction)
  const [direction, setDirection] = useState<ChineseDirection>('traditional')
  const [left, setLeft] = useState(''),
    [right, setRight] = useState('')
  const [diffOpen, setDiffOpen] = useState(false),
    [extractOpen, setExtractOpen] = useState(false),
    [convertOpen, setConvertOpen] = useState(false)
  const [diffJob, setDiffJob] = useState<TextExtraJob | null>(null)
  const [extractJob, setExtractJob] = useState<TextExtraJob | null>(null)
  const [convertJob, setConvertJob] = useState<TextExtraJob | null>(null)
  const comparison = useTextExtra(diffJob, active && diffOpen)
  const extracted = useTextExtra(
    extractJob?.kind === 'extract' &&
      extractJob.text === source &&
      extractJob.options === extraction
      ? extractJob
      : null,
    active && extractOpen,
  )
  const converted = useTextExtra(
    convertJob?.kind === 'convert' &&
      convertJob.text === source &&
      convertJob.direction === direction
      ? convertJob
      : null,
    active && convertOpen,
  )
  const changeExtraction = (patch: Partial<ExtractionOptions>) =>
    setExtraction((previous) => ({ ...previous, ...patch }))
  const marks = useMemo(
    () => ({
      left:
        comparison.result?.diff?.flatMap((hunk) =>
          hunk.sourceRuns.map((run) => ({ ...run, hunk: hunk.id, side: 'del' as const })),
        ) ?? [],
      right:
        comparison.result?.diff?.flatMap((hunk) =>
          hunk.resultRuns.map((run) => ({ ...run, hunk: hunk.id, side: 'ins' as const })),
        ) ?? [],
    }),
    [comparison.result],
  )
  const tooMany = marks.left.length + marks.right.length > 4000
  const tooLong = left.length + right.length > DIFF_MAX_CHARS
  const output = (state: typeof extracted, label: string) => (
    <>
      {state.pending && (
        <p className="text-ops-meta" role="status">
          正在处理…
        </p>
      )}
      {state.error && (
        <p className="text-ops-error" role="alert">
          {state.error}
        </p>
      )}
      {state.result?.text !== undefined && (
        <>
          {state.result.count !== undefined && (
            <p className="text-ops-meta" role="status">
              提取 {state.result.count} 项
            </p>
          )}
          <pre className="text-ops-preview" aria-label={`${label}预览`}>
            {state.result.text.slice(0, 2000)}
            {state.result.text.length > 2000 ? '\n…（仅预览前 2000 字符，应用保留全部）' : ''}
          </pre>
          <Button
            size="sm"
            disabled={!state.result.text}
            onClick={() => onApply(label, state.result!.text!)}
          >
            应用{label}
          </Button>
        </>
      )}
    </>
  )
  return (
    <>
      <details
        className="text-ops-block text-extra-block"
        onToggle={(event) => setDiffOpen(event.currentTarget.open)}
      >
        <summary>任意文本对比</summary>
        <div className="text-ops-actions">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLeft(source)
              setDiffJob(null)
            }}
          >
            原文填入左侧
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setLeft(right)
              setRight(left)
              setDiffJob(null)
            }}
          >
            交换两侧
          </Button>
        </div>
        <div className="text-diff-grid">
          <label>
            旧文本
            <Textarea
              aria-label="对比旧文本"
              value={left}
              maxLength={1_000_000}
              onChange={(event) => {
                setLeft(event.target.value)
                setDiffJob(null)
              }}
            />
          </label>
          <label>
            新文本
            <Textarea
              aria-label="对比新文本"
              value={right}
              maxLength={1_000_000}
              onChange={(event) => {
                setRight(event.target.value)
                setDiffJob(null)
              }}
            />
          </label>
        </div>
        <p className="text-ops-meta">独立比较两段文本，合计最多 20 万字符；不会应用整理规则。</p>
        {tooLong && (
          <p role="alert" className="text-ops-error">
            两段文本合计最多 20 万字符，请减少内容。
          </p>
        )}
        <Button
          size="sm"
          disabled={tooLong || (!left && !right) || comparison.pending}
          onClick={() => setDiffJob({ kind: 'diff', left, right })}
        >
          {comparison.pending ? '正在对比…' : '比较两段文本'}
        </Button>
        {comparison.error && (
          <p role="alert" className="text-ops-error">
            {comparison.error}
          </p>
        )}
        {comparison.result?.diff && (
          <>
            <p className="text-ops-meta" role="status">
              {comparison.result.diff.length
                ? `共 ${comparison.result.diff.length} 处差异 · 新增 ${comparison.result.diff.filter((h) => h.kind === 'add').length} · 删除 ${comparison.result.diff.filter((h) => h.kind === 'remove').length} · 替换 ${comparison.result.diff.filter((h) => h.kind === 'replace').length}`
                : '两段文本完全一致'}
            </p>
            {tooMany && (
              <p className="text-ops-meta">
                变化片段超过 4000 个，已停用高亮；可缩小文本范围查看。
              </p>
            )}
            <div className="text-diff-grid text-diff-results" aria-label="独立对比结果">
              <section>
                <h4>旧文本 · 红色为删除</h4>
                <pre aria-label="旧文本差异">
                  <OverlayMarks text={left} marks={tooMany ? [] : marks.left} />
                </pre>
              </section>
              <section>
                <h4>新文本 · 绿色为新增</h4>
                <pre aria-label="新文本差异">
                  <OverlayMarks text={right} marks={tooMany ? [] : marks.right} />
                </pre>
              </section>
            </div>
          </>
        )}
      </details>
      <details
        className="text-ops-block text-extra-block"
        onToggle={(event) => setExtractOpen(event.currentTarget.open)}
      >
        <summary>内容提取</summary>
        <label className="text-extra-setting">
          提取类型
          <Select
            value={extraction.preset}
            onValueChange={(value) =>
              changeExtraction({ preset: value as ExtractionOptions['preset'] })
            }
          >
            <SelectTrigger aria-label="提取类型">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(extractionPresets).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        {extraction.preset === 'regex' && (
          <>
            <label className="text-extra-setting">
              表达式
              <input
                aria-label="提取正则表达式"
                placeholder="如：编号：(\\d+)"
                value={extraction.pattern}
                maxLength={2000}
                onChange={(event) => changeExtraction({ pattern: event.target.value })}
              />
            </label>
            <label className="text-extra-setting">
              标志
              <input
                aria-label="提取正则标志"
                placeholder="i / m / s / u"
                value={extraction.flags}
                maxLength={8}
                onChange={(event) => changeExtraction({ flags: event.target.value })}
              />
            </label>
            <label className="compare-switch">
              <Switch
                aria-label="仅提取第一个捕获组"
                checked={extraction.group === 1}
                onCheckedChange={(checked) => changeExtraction({ group: checked ? 1 : 0 })}
              />
              仅提取第一个捕获组
            </label>
          </>
        )}
        <label className="compare-switch">
          <Switch
            aria-label="提取结果去重"
            checked={extraction.unique}
            onCheckedChange={(value) => changeExtraction({ unique: value })}
          />
          去重并保留首次出现顺序
        </label>
        <p className="text-ops-meta">
          从原文提取，最多 1 万项。手机号为中国大陆 11 位；身份证按 18
          位日期与校验码筛选，不核验身份。应用会替换原文，可撤销。
        </p>
        <Button
          size="sm"
          disabled={!source || extracted.pending}
          onClick={() => setExtractJob({ kind: 'extract', text: source, options: extraction })}
        >
          {extracted.pending ? '正在提取…' : '开始提取'}
        </Button>
        {output(extracted, '提取结果')}
      </details>
      <details
        className="text-ops-block text-extra-block"
        onToggle={(event) => setConvertOpen(event.currentTarget.open)}
      >
        <summary>简繁转换</summary>
        <label className="text-extra-setting">
          转换方向
          <Select
            value={direction}
            onValueChange={(value) => setDirection(value as ChineseDirection)}
          >
            <SelectTrigger aria-label="简繁转换方向">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="traditional">简体 → 繁体（台湾字形）</SelectItem>
              <SelectItem value="taiwan">简体 → 台湾常用词</SelectItem>
              <SelectItem value="simplified">繁体 → 简体</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <p className="text-ops-meta">
          OpenCC 词典在浏览器本地处理，不上传正文；人名、专名与歧义词请核对。应用后可撤销。
        </p>
        <Button
          size="sm"
          disabled={!source || converted.pending}
          onClick={() => setConvertJob({ kind: 'convert', text: source, direction })}
        >
          {converted.pending ? '正在转换…' : '开始简繁转换'}
        </Button>
        {output(converted, '简繁转换')}
      </details>
    </>
  )
}
