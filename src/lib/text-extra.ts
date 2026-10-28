import { DIFF_MAX_CHARS, textDiff, type DiffHunk } from './text-diff'

export const extractionPresets = {
  email: '邮箱',
  phone: '手机号',
  url: '网址',
  id: '身份证',
  regex: '自定义正则',
} as const
export type ExtractionOptions = {
  preset: keyof typeof extractionPresets
  pattern: string
  flags: string
  group: 0 | 1
  unique: boolean
}
export const defaultExtraction: ExtractionOptions = {
  preset: 'email',
  pattern: '',
  flags: 'i',
  group: 0,
  unique: true,
}
const patterns = {
  email:
    /(?<![a-z0-9.!#$%&'*+/=?^_`{|}~-])[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+/gi,
  phone: /(?<!\d)1[3-9]\d{9}(?!\d)/g,
  url: /https?:\/\/[^\s<>"'“”‘’，。；！？、（）【】]+/gi,
  id: /(?<![a-z0-9])\d{17}[\dx](?![a-z0-9])/gi,
}
function identityFormat(value: string) {
  const date = value.slice(6, 14)
  const iso = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) return false
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const sum = weights.reduce((total, weight, index) => total + Number(value[index]) * weight, 0)
  return '10X98765432'[sum % 11] === value[17].toUpperCase()
}
export function extractText(source: string, options: ExtractionOptions) {
  if (source.length > 1_000_000) throw new Error('提取最多支持 100 万字符。')
  if (!Object.hasOwn(extractionPresets, options.preset)) throw new Error('提取类型无效。')
  if (options.group !== 0 && options.group !== 1) throw new Error('捕获组无效。')
  let expression: RegExp
  if (options.preset === 'regex') {
    if (!options.pattern) throw new Error('请输入正则表达式。')
    if (options.pattern.length > 2000 || !/^[imsu]*$/.test(options.flags))
      throw new Error('表达式最多 2000 字符；标志仅支持 i、m、s、u，自动全局匹配。')
    try {
      expression = new RegExp(options.pattern, options.flags + 'g')
    } catch {
      throw new Error('正则表达式或标志无效，请检查后重试。')
    }
  } else expression = new RegExp(patterns[options.preset])
  const values: string[] = [],
    seen = new Set<string>()
  let scanned = 0,
    length = 0
  for (const match of source.matchAll(expression)) {
    if (++scanned > 10_000) throw new Error('匹配超过 1 万项，请缩小文本范围。')
    let value = options.preset === 'regex' ? match[options.group] : match[0]
    if (value === undefined) throw new Error('表达式没有第 1 个捕获组，请添加括号或选择完整匹配。')
    if (options.preset === 'id' && !identityFormat(value)) continue
    if (options.preset === 'url') {
      value = value.replace(/[.,;!?]+$/, '')
      let extraClosings = [...value].reduce(
        (count, char) => count + (char === ')' ? 1 : char === '(' ? -1 : 0),
        0,
      )
      let end = value.length
      while (extraClosings > 0 && value[end - 1] === ')') {
        end--
        extraClosings--
      }
      value = value.slice(0, end)
    }
    if (!value || (options.unique && seen.has(value))) continue
    length += value.length + (values.length ? 1 : 0)
    if (length > 1_000_000) throw new Error('提取结果超过 100 万字符，请缩小范围。')
    seen.add(value)
    values.push(value)
  }
  return { text: values.join('\n'), count: values.length }
}

export type ChineseDirection = 'simplified' | 'traditional' | 'taiwan'
export async function convertChinese(text: string, direction: ChineseDirection) {
  if (text.length > 1_000_000) throw new Error('简繁转换最多支持 100 万字符。')
  if (!['simplified', 'traditional', 'taiwan'].includes(direction))
    throw new Error('转换方向无效。')
  const { Converter } = await import('opencc-js')
  const converter =
    direction === 'simplified'
      ? Converter({ from: 't', to: 'cn' })
      : Converter({ from: 'cn', to: direction === 'taiwan' ? 'twp' : 'tw' })
  return converter(text)
}

export type TextExtraJob =
  | { kind: 'extract'; text: string; options: ExtractionOptions }
  | { kind: 'convert'; text: string; direction: ChineseDirection }
  | { kind: 'diff'; left: string; right: string }
export type TextExtraResult = { text?: string; count?: number; diff?: DiffHunk[] }
export async function runTextExtra(job: TextExtraJob): Promise<TextExtraResult> {
  if (job.kind === 'extract') return extractText(job.text, job.options)
  if (job.kind === 'convert') return { text: await convertChinese(job.text, job.direction) }
  if (job.left.length + job.right.length > DIFF_MAX_CHARS)
    throw new Error('两段文本合计最多 20 万字符。')
  return { diff: textDiff(job.left, job.right) ?? [] }
}
