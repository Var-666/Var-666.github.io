import { markdownToText } from './markdown'
export type Preset = 'clean' | 'pdf' | 'dedupe' | 'chinese' | 'markdown'
export type RepairMode = 'conservative' | 'standard'
export type Options = {
  trimLines: boolean
  collapseSpaces: boolean
  fullwidth: boolean
  blankLines: 'keep' | 'single' | 'remove'
  repairBreaks: boolean
  repairMode: RepairMode
  dedupe: boolean
  ignoreCase: boolean
  ignoreWhitespace: boolean
  cjkSpacing: boolean
  chinesePunctuation: boolean
  markdownPlain: boolean
}
export type Change = { label: string; count: number }
export type ProcessResult = { text: string; changes: Change[] }
export const baseOptions: Options = {
  trimLines: true,
  collapseSpaces: false,
  fullwidth: false,
  blankLines: 'single',
  repairBreaks: false,
  repairMode: 'conservative',
  dedupe: false,
  ignoreCase: false,
  ignoreWhitespace: true,
  cjkSpacing: false,
  chinesePunctuation: false,
  markdownPlain: false,
}
export const presets: Record<
  Preset,
  { title: string; description: string; options: Options; sample: string }
> = {
  clean: {
    title: '日常清理',
    description: '清空格、去空行，让文字更清爽',
    options: { ...baseOptions, collapseSpaces: true },
    sample:
      '   把时间，留给更重要的事。   \n\n\n我们每天都在复制、粘贴和整理文字。\n  有时，多余的空格    会打断阅读的节奏。  \n\n\n理文帮你整理这些细节，\n让每一段表达，都干净又清晰。   ',
  },
  pdf: {
    title: 'PDF 断行修复',
    description: '连接断句，尽量保留段落',
    options: { ...baseOptions, repairBreaks: true },
    sample:
      '这是一段从 PDF 中复制的文字，原本完整的句子\n因为页面宽度的限制，被拆成了好几行。\n\nGood ideas deserve\nroom to grow.\n\n待办事项：\n1. 整理本周的工作记录\n2. 准备下周的会议材料\n\n参考链接：https://example.com/report\n联系邮箱：hello@example.com',
  },
  dedupe: {
    title: '名单去重',
    description: '删除重复项，保留原有顺序',
    options: { ...baseOptions, blankLines: 'remove', dedupe: true },
    sample: '张小明\n李可\n张小明\n  王安  \n李可\n陈一\n王安\n\nAlex\nalex\nAlex',
  },
  chinese: {
    title: '中文排版',
    description: '中英间距，阅读恰到好处',
    options: { ...baseOptions, fullwidth: true, cjkSpacing: true },
    sample:
      '今天用React完成了第１个小工具。\n设计稿在Figma里，文档写在Notion上。\n\n每天省下１０分钟，就能多读几页书。\n项目版本为v2.1，进度已达到80%。\n\n网址：https://example.com/docs\n邮箱：hello@example.com',
  },
  markdown: {
    title: 'MD 转纯文本',
    description: '去掉 Markdown 格式，保留文字内容',
    options: { ...baseOptions, trimLines: false, blankLines: 'keep', markdownPlain: true },
    sample:
      '# 本周工作记录\n\n完成了 **首页设计**，正在整理 *项目文档*。\n\n## 待办事项\n\n- [x] 完成页面布局\n- [ ] 准备下周的会议材料\n\n> 把时间留给更重要的事。\n\n查看 [项目文档](https://example.com/docs)。\n\n| 项目 | 状态 |\n| --- | --- |\n| 页面开发 | 已完成 |\n| 功能测试 | 进行中 |\n\n```js\nfunction greet() {\n  console.log("你好，理文");\n}\n```\n\n![页面示意图](https://example.com/preview.png)',
  },
}
const cjk = /[\u3400-\u9fff]/u
const listLine =
  /^\s*(?:[-*–—]\s+|[•●▪■]\s*|\d+[.．、)）]\s*|[（(][\d一二三四五六七八九十]+[)）]|[一二三四五六七八九十]+[、.])/u
const chapterLine = /^\s*第[\d一二三四五六七八九十百千]+[章节篇部条回]/u
const headingLine = /^#{1,6}\s/
const fenceStart = /^\s*(`{3,}|~{3,})/
const closingMarks = /[”’"')）\]】》»]+$/u
const linkContext = /(?:https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.)/i
// 手动保留换行的标记：放在需要保留的换行之前，仅断行修复会处理，其他场景视为普通文本
export const KEEP_BREAK_MARK = '⟦保留换行⟧'
const keepMarkAtEnd = /\u27E6保留换行\u27E7[ \t]*$/u

type LineEnding = 'terminal' | 'continue' | 'open' | 'cjk' | 'latin' | 'other'
/** 上一行的结尾类型；句末终止时先剥离尾部的闭合引号与括号再判断 */
function lineEnding(line: string): LineEnding {
  if (/[“「『【（([]$/.test(line)) return 'open'
  const core = line.replace(closingMarks, '')
  const last = core.slice(-1)
  if (/[。！？!?…]/.test(last)) return 'terminal'
  if (/[a-zA-Z]\.$/.test(core)) return 'terminal'
  if (/[，、；：,;:]/.test(last)) return 'continue'
  if (cjk.test(last)) return 'cjk'
  if (/[a-zA-Z]/.test(last)) return 'latin'
  return 'other'
}
type StartKind = 'cjk' | 'lower' | 'upper' | 'digit' | 'other'
function startKind(line: string): StartKind {
  const first = line.charAt(0)
  if (/[a-z]/.test(first)) return 'lower'
  if (/[A-Z]/.test(first)) return 'upper'
  if (/[0-9]/.test(first)) return 'digit'
  if (cjk.test(first)) return 'cjk'
  return 'other'
}
/** 标题、编号、项目符号、章节号与表格行都视为结构性内容 */
const isStructural = (line: string) =>
  headingLine.test(line) || listLine.test(line) || chapterLine.test(line) || line.includes('|')
// 反引号数量为奇数说明行内代码尚未闭合，跨行时不改动
const oddBackticks = (line: string) => (line.match(/`/g)?.length ?? 0) % 2 === 1
/** 断行决策：保守模式只合并有较强续行证据的断行，标准模式在结构保护之下更积极 */
function breakDecision(
  prev: string,
  next: string,
  mode: RepairMode,
): 'keep' | 'join' | 'joinDirect' | 'dehyphen' {
  if (/[a-zA-Z]-$/.test(prev) && /^[a-z]/.test(next)) {
    // 前一个词里已含连字符时更可能是复合词断行，保留连字符直接拼接
    const head = prev.slice(0, -1)
    const lastWord = head.split(/\s+/).pop() ?? head
    return lastWord.includes('-') ? 'joinDirect' : 'dehyphen'
  }
  // 悬挂的连字符无法确认是断词还是破折号，保持换行
  if (prev.endsWith('-')) return 'keep'
  const ending = lineEnding(prev)
  const start = startKind(next)
  // 数字开头的行视作独立条目，保护编号、小数、日期与版本号
  if (start === 'digit') return 'keep'
  if (mode === 'standard') {
    if (ending === 'terminal') return start === 'cjk' || start === 'lower' ? 'join' : 'keep'
    return 'join'
  }
  switch (ending) {
    case 'continue':
    case 'open':
      return 'join'
    case 'cjk':
      return start === 'cjk' || start === 'lower' ? 'join' : 'keep'
    case 'latin':
      return start === 'lower' ? 'join' : 'keep'
    default:
      return 'keep'
  }
}
const cjkText = (char: string) => cjk.test(char) || /[，。、；：！？…）】》”’]/.test(char)
function joinSeparator(prev: string, next: string) {
  const first = next.charAt(0)
  if (cjkText(prev.slice(-1)) && (cjk.test(first) || /^[，。、；：！？）】》”’…]/.test(first)))
    return ''
  return ' '
}
function repairParagraphs(text: string, mode: RepairMode): { text: string; count: number } {
  const lines = text.split('\n')
  const output: string[] = []
  let count = 0
  let fence = ''
  let previousCode = false
  let previous: { line: string; marked: boolean } | null = null
  for (const raw of lines) {
    const marker = raw.match(fenceStart)
    const codeLine = !!fence || !!marker
    const codeBoundary = previousCode || codeLine
    previousCode = codeLine
    if (marker) {
      if (!fence) fence = marker[1]
      else if (
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !raw.slice(marker[0].length).trim()
      )
        fence = ''
    }
    // 代码块内不处理保留标记，内容照抄
    const marked = !codeLine && keepMarkAtEnd.test(raw)
    const line = marked ? raw.replace(keepMarkAtEnd, '') : raw
    if (!previous) {
      output.push(line)
      previous = { line, marked }
      continue
    }
    const prev = previous.line.trimEnd()
    const next = line.trimStart()
    const separate =
      codeBoundary ||
      previous.marked ||
      !prev ||
      !next ||
      isStructural(prev) ||
      isStructural(next) ||
      linkContext.test(prev + ' ' + next) ||
      oddBackticks(prev) ||
      oddBackticks(next)
    const decision = separate ? 'keep' : breakDecision(prev, next, mode)
    if (decision === 'keep') {
      output.push('\n', line)
    } else {
      // Trim only the previous fragment; rescanning the entire output makes long documents quadratic.
      output[output.length - 1] = output[output.length - 1].trimEnd()
      if (decision === 'dehyphen')
        output[output.length - 1] = output[output.length - 1].slice(0, -1)
      else if (decision === 'join') output.push(joinSeparator(prev, next))
      output.push(next)
      count++
    }
    previous = { line, marked }
  }
  return { text: output.join(''), count }
}
export function processText(source: string, options: Options): ProcessResult {
  let text = source.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '')
  const changes: Change[] = []
  if (options.markdownPlain) {
    const converted = markdownToText(text)
    if (converted !== text) changes.push({ label: '转换 Markdown', count: 1 })
    text = converted
  }
  const replace = (
    pattern: RegExp,
    replacement: string | ((value: string) => string),
    label: string,
  ) => {
    let count = 0
    text = text.replace(pattern, (...args: string[]) => {
      const next = typeof replacement === 'function' ? replacement(args[0]) : replacement
      if (next !== args[0]) count++
      return next
    })
    if (count) changes.push({ label, count })
  }
  if (options.fullwidth)
    replace(
      /[\uFF01-\uFF5E\u3000]/g,
      (value) => (value === '\u3000' ? ' ' : String.fromCharCode(value.charCodeAt(0) - 0xfee0)),
      '转换全角字符',
    )
  if (options.trimLines) replace(/^[\t \u00a0\u3000]+|[\t \u00a0\u3000]+$/gm, '', '清理首尾空格')
  if (options.collapseSpaces) replace(/[\t \u00a0\u3000]{2,}/g, ' ', '合并多余空格')
  if (options.repairBreaks) {
    const result = repairParagraphs(text, options.repairMode)
    text = result.text
    if (result.count) changes.push({ label: '连接断行', count: result.count })
  }
  if (options.dedupe) {
    const seen = new Set<string>()
    let count = 0
    text = text
      .split('\n')
      .filter((line) => {
        if (!line.trim()) return true
        let key = options.ignoreWhitespace ? line.trim() : line
        if (options.ignoreCase) key = key.toLowerCase()
        if (seen.has(key)) {
          count++
          return false
        }
        seen.add(key)
        return true
      })
      .join('\n')
    if (count) changes.push({ label: '移除重复行', count })
  }
  if (options.blankLines !== 'keep') {
    const before = text.split('\n').length
    if (options.blankLines === 'remove')
      text = text
        .split('\n')
        .filter((line) => line.trim())
        .join('\n')
    else text = text.replace(/\n(?:[\t \u00a0\u3000]*\n){2,}/g, '\n\n')
    const count = before - text.split('\n').length
    if (count) changes.push({ label: '移除多余空行', count })
  }
  // Preserve URLs, email addresses, inline code and decimal numbers during typography.
  if (options.cjkSpacing || options.chinesePunctuation) {
    let spacingCount = 0
    let punctuationCount = 0
    const segments = text.split(
      /(^[\t ]*`{3,}[^\n]*\n[\s\S]*?^[\t ]*`{3,}[\t ]*(?=\n|$)|^[\t ]*~{3,}[^\n]*\n[\s\S]*?^[\t ]*~{3,}[\t ]*(?=\n|$)|https?:\/\/[^\s\u3400-\u9fff，。；！？]+|www\.[^\s\u3400-\u9fff，。；！？]+|[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}|`[^`\n]*`)/gim,
    )
    text = segments
      .map((segment, i) => {
        if (i % 2) return segment
        if (options.cjkSpacing) {
          segment = segment
            .replace(/([\u3400-\u9fff])([a-zA-Z0-9])/g, (_, a, b) => {
              spacingCount++
              return a + ' ' + b
            })
            .replace(/([a-zA-Z0-9])([\u3400-\u9fff])/g, (_, a, b) => {
              spacingCount++
              return a + ' ' + b
            })
        }
        if (options.chinesePunctuation && cjk.test(segment)) {
          const map: Record<string, string> = {
            ',': '，',
            ':': '：',
            ';': '；',
            '?': '？',
            '!': '！',
            '(': '（',
            ')': '）',
          }
          segment = segment.replace(/\d+(?:[.,]\d+)+|[,;:?!()]/g, (value) => {
            if (!map[value]) return value
            punctuationCount++
            return map[value]
          })
        }
        return segment
      })
      .join('')
    if (spacingCount) changes.push({ label: '调整中英间距', count: spacingCount })
    if (punctuationCount) changes.push({ label: '转换中文标点', count: punctuationCount })
  }
  return { text, changes }
}
export function textStats(text: string) {
  return {
    chars: Array.from(text).length,
    lines: text ? text.split(/\r\n?|\n/).length : 0,
    nonSpace: Array.from(text.replace(/\s/g, '')).length,
  }
}
