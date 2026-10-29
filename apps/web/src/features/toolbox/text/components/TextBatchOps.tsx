import { TextExtras } from './TextExtras'
import { OutputActions } from '@/features/toolbox/components/OutputActions'
import { useTransferReceiver } from '@/features/toolbox/tool-transfer'
import { TextEncodingSelect } from '@/features/toolbox/components/TextEncodingSelect'
import type { TextEncoding } from '@/features/toolbox/lib/text-encoding'
// 文本「更多操作」：批量替换、列表处理、格式转换与批量文件处理。
// 预览与应用共用同一份纯函数结果；应用即写回原文（走 TextTool 的撤销栈），原规则保留便于重复执行。
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ChevronDown,
  FileDown,
  FileUp,
  LoaderCircle,
  Package,
  Plus,
  Trash2,
  WandSparkles,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  applyListOps,
  applyReplaceRules,
  convertLineFormat,
  emptyListOptions,
  lineFormatLabels,
  type LineJoinFormat,
  type ListOptions,
  type ReplaceRule,
} from '@/features/toolbox/text/text-ops'
import {
  batchTextLimits,
  batchTextOutputName,
  processBatchTextFiles,
  validateBatchTextFiles,
  type BatchTextItem,
} from '@/features/toolbox/text/text-batch'
import type { Options } from '@/features/toolbox/text/text'
import { packOutputs } from '@/features/toolbox/files/file-media'

type UiBatchItem = BatchTextItem & { url?: string; blob?: Blob }
const batchPreviewLimit = 600

const previewLimit = 2000
const clip = (text: string) =>
  text.length > previewLimit
    ? `${text.slice(0, previewLimit)}\n…（预览截断，应用时处理全文）`
    : text

export function TextBatchOps({
  active = true,
  source,
  onApply,
  processOptions,
}: {
  active?: boolean
  source: string
  /** 返回是否写入成功（超长会被拒绝） */
  onApply: (text: string) => boolean
  /** 当前整理规则：批量文件处理复用主编辑器的设置 */
  processOptions?: Options
}) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState<ReplaceRule[]>([
    { find: '', replace: '', regex: false, caseSensitive: false },
  ])
  const [list, setList] = useState<ListOptions>(emptyListOptions)
  const [format, setFormat] = useState<LineJoinFormat>('comma')
  const [batchItems, setBatchItems] = useState<UiBatchItem[]>([])
  const [batchEncoding, setBatchEncoding] = useState<TextEncoding>('auto')
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchZip, setBatchZip] = useState<{ url: string; name: string } | null>(null)
  const batchInput = useRef<HTMLInputElement>(null)
  const batchFiles = useRef<File[]>([])
  const batchUrls = useRef(new Set<string>())
  useEffect(
    () => () => {
      for (const url of batchUrls.current) URL.revokeObjectURL(url)
      batchUrls.current.clear()
    },
    [],
  )

  const replace = useMemo(() => {
    if (!rules.some((rule) => rule.find)) return null
    try {
      return applyReplaceRules(source, rules)
    } catch (error) {
      return { error: error instanceof Error ? error.message : '规则无效' }
    }
  }, [source, rules])
  const replaceTotal =
    replace && 'hits' in replace ? replace.hits.reduce((sum, hit) => sum + hit, 0) : 0

  const listResult = useMemo(() => {
    const active =
      list.sort !== 'none' ||
      !!list.filterInclude.trim() ||
      !!list.filterExclude.trim() ||
      list.lineNumbers !== 'none' ||
      !!list.prefix ||
      !!list.suffix ||
      list.removeEmpty
    return active && source ? applyListOps(source, list) : null
  }, [source, list])

  const formatResult = useMemo(
    () => (source ? convertLineFormat(source, format) : null),
    [source, format],
  )

  const apply = (label: string, text: string) => {
    if (onApply(text)) toast.success(`已应用到原文：${label}`)
  }

  const addBatchFiles = (incoming: File[]) => {
    try {
      validateBatchTextFiles(batchItems.length, incoming)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    setBatchItems((previous) => [
      ...previous,
      ...incoming.map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        status: 'waiting' as const,
        originalBytes: file.size,
      })),
    ])
    batchFiles.current.push(...incoming)
  }
  useTransferReceiver('text-batch', active && !batchRunning, (request) => {
    setOpen(true)
    addBatchFiles(request.files ?? [])
  })
  return (
    <section className="text-ops" aria-label="更多操作">
      <button
        type="button"
        className="text-ops-toggle"
        aria-label="更多操作"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <WandSparkles size={15} />
        更多操作
        <span className="text-ops-hint">替换 · 提取 · 简繁 · 文本对比</span>
        <ChevronDown size={15} className={open ? 'is-open' : ''} />
      </button>
      <div className="text-ops-body" hidden={!open}>
        {!source && <p className="text-ops-empty">在原文框输入内容后，这里的预览会实时更新。</p>}
        {/* 批量查找替换 */}
        <div className="text-ops-block">
          <h3>批量查找替换</h3>
          {rules.map((rule, index) => (
            <div className="replace-rule" key={index}>
              <input
                aria-label={`第 ${index + 1} 条查找`}
                placeholder="查找内容"
                value={rule.find}
                onChange={(event) =>
                  setRules((previous) =>
                    previous.map((item, i) =>
                      i === index ? { ...item, find: event.target.value } : item,
                    ),
                  )
                }
              />
              <input
                aria-label={`第 ${index + 1} 条替换`}
                placeholder="替换为（留空即删除）"
                value={rule.replace}
                onChange={(event) =>
                  setRules((previous) =>
                    previous.map((item, i) =>
                      i === index ? { ...item, replace: event.target.value } : item,
                    ),
                  )
                }
              />
              <label className="rule-flag">
                <Switch
                  aria-label={`第 ${index + 1} 条区分大小写`}
                  checked={rule.caseSensitive}
                  onCheckedChange={(value) =>
                    setRules((previous) =>
                      previous.map((item, i) =>
                        i === index ? { ...item, caseSensitive: value } : item,
                      ),
                    )
                  }
                />
                大小写
              </label>
              <label className="rule-flag">
                <Switch
                  aria-label={`第 ${index + 1} 条使用正则`}
                  checked={rule.regex}
                  onCheckedChange={(value) =>
                    setRules((previous) =>
                      previous.map((item, i) => (i === index ? { ...item, regex: value } : item)),
                    )
                  }
                />
                正则
              </label>
              {replace && 'hits' in replace && (
                <span className="rule-hits">命中 {replace.hits[index] ?? 0} 处</span>
              )}
              {rules.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`删除第 ${index + 1} 条规则`}
                  onClick={() => setRules((previous) => previous.filter((_, i) => i !== index))}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
          <div className="text-ops-actions">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setRules((previous) => [
                  ...previous,
                  { find: '', replace: '', regex: false, caseSensitive: false },
                ])
              }
            >
              <Plus size={14} />
              添加规则
            </Button>
            {replace && 'text' in replace && (
              <Button
                size="sm"
                disabled={!replaceTotal}
                onClick={() => apply(`替换 ${replaceTotal} 处`, replace.text)}
              >
                应用替换{replaceTotal ? `（共 ${replaceTotal} 处）` : ''}
              </Button>
            )}
          </div>
          {replace && 'error' in replace && (
            <p className="text-ops-error" role="alert">
              {replace.error}
            </p>
          )}
          {replace && 'text' in replace && !!replaceTotal && (
            <pre className="text-ops-preview" aria-label="替换预览">
              {clip(replace.text)}
            </pre>
          )}
        </div>
        {/* 列表处理 */}
        <div className="text-ops-block">
          <h3>列表处理（按行）</h3>
          <div className="list-options">
            <label>
              排序
              <Select
                value={list.sort}
                onValueChange={(value) => setList({ ...list, sort: value as ListOptions['sort'] })}
              >
                <SelectTrigger aria-label="行排序">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不排序</SelectItem>
                  <SelectItem value="asc">拼音升序</SelectItem>
                  <SelectItem value="desc">拼音降序</SelectItem>
                  <SelectItem value="length">按长度</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              只保留包含
              <input
                aria-label="只保留包含"
                placeholder="关键词"
                value={list.filterInclude}
                onChange={(event) => setList({ ...list, filterInclude: event.target.value })}
              />
            </label>
            <label>
              排除包含
              <input
                aria-label="排除包含"
                placeholder="关键词"
                value={list.filterExclude}
                onChange={(event) => setList({ ...list, filterExclude: event.target.value })}
              />
            </label>
            <label>
              行号
              <Select
                value={list.lineNumbers}
                onValueChange={(value) =>
                  setList({ ...list, lineNumbers: value as ListOptions['lineNumbers'] })
                }
              >
                <SelectTrigger aria-label="行号样式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不加行号</SelectItem>
                  <SelectItem value="dot">1. 2. 3.</SelectItem>
                  <SelectItem value="paren">1) 2) 3)</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label>
              行前缀
              <input
                aria-label="行前缀"
                value={list.prefix}
                onChange={(event) => setList({ ...list, prefix: event.target.value })}
              />
            </label>
            <label>
              行后缀
              <input
                aria-label="行后缀"
                value={list.suffix}
                onChange={(event) => setList({ ...list, suffix: event.target.value })}
              />
            </label>
            <label className="rule-flag">
              <Switch
                aria-label="删除空行"
                checked={list.removeEmpty}
                onCheckedChange={(value) => setList({ ...list, removeEmpty: value })}
              />
              删除空行
            </label>
          </div>
          {listResult && (
            <>
              <p className="text-ops-meta">
                {listResult.beforeLines} 行 → {listResult.afterLines} 行
                {listResult.removedLines ? `（${listResult.removedLines} 行被移除）` : ''}
                ；不去重，筛选与删除都会在计数中体现
              </p>
              <div className="text-ops-actions">
                <Button
                  size="sm"
                  onClick={() => apply(`列表处理 → ${listResult.afterLines} 行`, listResult.text)}
                >
                  应用列表处理
                </Button>
              </div>
              <pre className="text-ops-preview" aria-label="列表处理预览">
                {clip(listResult.text)}
              </pre>
            </>
          )}
        </div>
        {processOptions && (
          <div className="text-ops-block">
            <h3>批量文件处理</h3>
            <TextEncodingSelect
              label="批量读取编码"
              value={batchEncoding}
              disabled={batchRunning}
              onChange={(value) => {
                setBatchEncoding(value)
                for (const url of batchUrls.current) URL.revokeObjectURL(url)
                batchUrls.current.clear()
                setBatchZip(null)
                setBatchItems((previous) =>
                  previous.map((item) => ({
                    id: item.id,
                    name: item.name,
                    originalBytes: item.originalBytes,
                    status: 'waiting',
                  })),
                )
              }}
            />
            <p className="text-ops-meta">
              导入多份 TXT / MD，统一应用主编辑器当前的整理规则；单个文件的错误不影响其他文件。
            </p>
            <div className="text-ops-actions">
              <Button
                variant="outline"
                size="sm"
                disabled={batchRunning}
                onClick={() => batchInput.current?.click()}
              >
                <FileUp size={14} />
                添加文件（≤ {batchTextLimits.maxFiles} 个，单个 2 MB）
              </Button>
              <input
                ref={batchInput}
                type="file"
                multiple
                accept=".txt,.md,text/plain,text/markdown"
                className="sr-only"
                aria-label="添加批量文本文件"
                onChange={(event) => {
                  addBatchFiles(Array.from(event.target.files || []))
                  event.target.value = ''
                }}
              />
              <Button
                size="sm"
                disabled={batchRunning || !batchItems.some((item) => item.status === 'waiting')}
                onClick={async () => {
                  setBatchRunning(true)
                  setBatchZip((previous) => {
                    if (previous) {
                      URL.revokeObjectURL(previous.url)
                      batchUrls.current.delete(previous.url)
                    }
                    return null
                  })
                  try {
                    const waiting = batchItems
                      .map((item, index) => ({ item, index }))
                      .filter(({ item }) => item.status === 'waiting')
                    const files = waiting.map(({ index }) => batchFiles.current[index])
                    const summary = await processBatchTextFiles(
                      files,
                      processOptions,
                      {
                        onStart: (runnerId) => {
                          const position = Number(runnerId.split('-')[1])
                          const id = waiting[position].item.id
                          setBatchItems((previous) =>
                            previous.map((item) =>
                              item.id === id ? { ...item, status: 'working' } : item,
                            ),
                          )
                        },
                        onDone: (runnerId, result, _originalBytes, encoding) => {
                          const position = Number(runnerId.split('-')[1])
                          const id = waiting[position].item.id
                          const blob = new Blob([result.text], {
                            type: 'text/plain;charset=utf-8',
                          })
                          const url = URL.createObjectURL(blob)
                          batchUrls.current.add(url)
                          setBatchItems((previous) =>
                            previous.map((item) =>
                              item.id === id
                                ? {
                                    ...item,
                                    status: 'done',
                                    encoding,
                                    result: result.text,
                                    resultBytes: blob.size,
                                    changeCount: result.changes.reduce(
                                      (sum, change) => sum + change.count,
                                      0,
                                    ),
                                    url,
                                    blob,
                                  }
                                : item,
                            ),
                          )
                        },
                        onError: (runnerId, message) => {
                          const position = Number(runnerId.split('-')[1])
                          const id = waiting[position].item.id
                          setBatchItems((previous) =>
                            previous.map((item) =>
                              item.id === id ? { ...item, status: 'error', message } : item,
                            ),
                          )
                        },
                      },
                      batchEncoding,
                    )
                    toast.success(
                      `批量处理完成：成功 ${summary.done} 个${summary.failed ? `，失败 ${summary.failed} 个` : ''}。`,
                    )
                  } finally {
                    setBatchRunning(false)
                  }
                }}
              >
                {batchRunning ? (
                  <LoaderCircle className="animate-spin" size={14} />
                ) : (
                  <FileDown size={14} />
                )}
                开始处理
              </Button>
              <OutputActions
                outputs={batchItems.flatMap((item) =>
                  item.status === 'done' && item.blob
                    ? [
                        {
                          name: batchTextOutputName(item.name),
                          blob: item.blob!,
                        },
                      ]
                    : [],
                )}
                disabled={batchRunning}
              />
              {batchItems.filter((item) => item.status === 'done').length > 1 &&
                (batchZip ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={batchZip.url} download={batchZip.name}>
                      <Package size={14} />
                      下载 {batchZip.name}（
                      {batchItems.filter((item) => item.status === 'done').length} 个）
                    </a>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={batchRunning}
                    onClick={async () => {
                      const done = batchItems.filter((item) => item.status === 'done' && item.blob)
                      try {
                        const output = await packOutputs(
                          done.map((item) => ({
                            name: batchTextOutputName(item.name),
                            blob: item.blob!,
                          })),
                          '批量整理结果.zip',
                        )
                        const url = URL.createObjectURL(output.blob)
                        batchUrls.current.add(url)
                        setBatchZip({ url, name: output.name })
                      } catch {
                        toast.error('打包失败，请逐个下载文件。')
                      }
                    }}
                  >
                    <Package size={14} />
                    打包下载 ZIP
                  </Button>
                ))}
              {!!batchItems.length && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={batchRunning}
                  onClick={() => {
                    setBatchItems([])
                    batchFiles.current = []
                    setBatchZip((previous) => {
                      if (previous) {
                        URL.revokeObjectURL(previous.url)
                        batchUrls.current.delete(previous.url)
                      }
                      return null
                    })
                  }}
                >
                  <Trash2 size={14} />
                  清空列表
                </Button>
              )}
            </div>
            {!!batchItems.length && (
              <div className="batch-list">
                {batchItems.map((item) => (
                  <div className="batch-item" key={item.id}>
                    <span
                      className={`batch-state state-${item.status}`}
                      aria-label={
                        item.status === 'done'
                          ? '完成'
                          : item.status === 'error'
                            ? '失败'
                            : item.status === 'working'
                              ? '处理中'
                              : '等待'
                      }
                    >
                      {item.status === 'working' ? (
                        <LoaderCircle className="animate-spin" size={14} />
                      ) : item.status === 'done' ? (
                        '✓'
                      ) : item.status === 'error' ? (
                        '✕'
                      ) : (
                        '…'
                      )}
                    </span>
                    <div className="batch-item-main">
                      <strong>{item.name}</strong>
                      <span>
                        {item.status === 'done' &&
                          `${batchTextOutputName(item.name)} · ${(item.originalBytes / 1024).toFixed(1)} KB → ${(item.resultBytes! / 1024).toFixed(1)} KB · ${item.changeCount} 处调整 · 已按 ${item.encoding} 读取`}
                        {item.status === 'error' && item.message}
                        {item.status === 'waiting' && '等待处理'}
                        {item.status === 'working' && '正在整理…'}
                      </span>
                      {item.status === 'done' && (
                        <details className="batch-preview">
                          <summary>预览结果</summary>
                          <pre>
                            {item.result!.length > batchPreviewLimit
                              ? `${item.result!.slice(0, batchPreviewLimit)}…`
                              : item.result}
                          </pre>
                        </details>
                      )}
                    </div>
                    {item.status === 'done' && item.url && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={item.url} download={batchTextOutputName(item.name)}>
                          下载
                        </a>
                      </Button>
                    )}
                    {item.status !== 'working' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`移除 ${item.name}`}
                        disabled={batchRunning}
                        onClick={() => {
                          setBatchItems((previous) =>
                            previous.filter((entry) => entry.id !== item.id),
                          )
                        }}
                      >
                        <X size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* 格式转换 */}
        <div className="text-ops-block">
          <h3>格式转换</h3>
          <div className="list-options">
            <label>
              输出格式
              <Select value={format} onValueChange={(value) => setFormat(value as LineJoinFormat)}>
                <SelectTrigger aria-label="输出格式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(lineFormatLabels) as LineJoinFormat[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {lineFormatLabels[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          {formatResult && !!formatResult.count && (
            <>
              <p className="text-ops-meta">
                {formatResult.count} 个条目
                {formatResult.dropped ? `（丢弃 ${formatResult.dropped} 个空条目）` : ''}
                ；单行输入会按逗号 / 分号 / 制表符自动拆分
              </p>
              <div className="text-ops-actions">
                <Button
                  size="sm"
                  onClick={() =>
                    apply(`格式转换（${lineFormatLabels[format]}）`, formatResult.text)
                  }
                >
                  应用格式转换
                </Button>
              </div>
              <pre className="text-ops-preview" aria-label="格式转换预览">
                {clip(formatResult.text)}
              </pre>
            </>
          )}
        </div>
        <TextExtras active={active && open} source={source} onApply={apply} />
      </div>
    </section>
  )
}
