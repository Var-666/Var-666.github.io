import { useUnsavedWork } from '../DraftGuard'
import { RenameMore, RenameRules } from './components/RenameRules'
import { useRenamePreview } from './hooks/useRenamePreview'
import { readPhotoDate, sortRenameFiles, type RenameSort } from './rename-metadata'
import { OutputActions } from '../components/OutputActions'
import { TbCard, TbNotice } from '../components/tb'
import { useTransferReceiver } from '../tool-transfer'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronDown,
  CircleAlert,
  ClipboardPaste,
  FileUp,
  Info,
  LoaderCircle,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { packOutputs } from '../files/file-media'
import { ToolHead } from '../components/ToolHead'
import { tools } from '../tools'
import {
  defaultRenameOptions,
  parseNameList,
  validateRenameFiles,
  type RenameOptions,
} from './rename'

// 头部「说明与限制」胶囊使用的上限数据（与 files/table 同源）
const toolLimits = tools.find((tool) => tool.id === 'rename')!.limits

// 实时预览行单元格：.rename-table / .rename-new / .rename-error 为 e2e 稳定钩子；
// styles.css 的旧 .rename-table th/td 规则仍会命中，故 padding / 边框色用 !important 工具类覆盖
// （表格 / 文件页先例）。纵向结构一律 flex-col，栅格显式 minmax(0,1fr)。
const thCls =
  'px-4! py-2! text-left font-semibold! bg-tb-chip! text-[#57575d]! border-tb-line! dark:text-tb-mute!'
// 水平内边距由各列自行追加（不能与基础类里的同类 !important 工具类重复，避免样式表顺序决定胜负）
const tdCls = 'align-middle border-tb-line! py-2!'

export default function RenameTool({ active = true }: { active?: boolean }) {
  const [files, setFiles] = useState<
    { id: string; file: File; shotAt?: string; shotError?: string }[]
  >([])
  const [options, setOptions] = useState(defaultRenameOptions)
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [nameList, setNameList] = useState('')
  const [packing, setPacking] = useState(false)
  const [readingDates, setReadingDates] = useState(false)
  const [dragging, setDragging] = useState(false)
  // 头部「说明与限制」折叠开关（纯展示状态，照 files/table 先例）
  const [limitsOpen, setLimitsOpen] = useState(false)
  useUnsavedWork(files.length > 0 || !!nameList)
  const [result, setResult] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const resultUrl = useRef('')
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    if (!active) setDragging(false)
  }, [active])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      URL.revokeObjectURL(resultUrl.current)
    }
  }, [])
  const invalidate = () => {
    URL.revokeObjectURL(resultUrl.current)
    resultUrl.current = ''
    setResult('')
  }
  const update = (patch: Partial<RenameOptions>) => {
    if (running.current) return
    invalidate()
    setOptions((previous) => ({ ...previous, ...patch }))
  }
  const previewState = useRenamePreview(
    files.map((entry) => entry.file.name),
    options,
    files.map((_, index) => overrides[index]),
    files.map((entry) => ({ modified: entry.file.lastModified, shotAt: entry.shotAt })),
  )
  const preview = previewState.rows
  const previewPending = previewState.pending
  const errors = preview.filter((row) => row.error).length
  // 仅用于底栏展示：新名称与原文件名不同的行数
  const changed = preview.filter((row, index) => row.name !== files[index]?.file.name).length
  const addFiles = (incoming: File[]) => {
    if (running.current || readingDates || !incoming.length) return
    try {
      validateRenameFiles(
        files.map((entry) => entry.file),
        incoming,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    invalidate()
    setOverrides({})
    setFiles((previous) => [
      ...previous,
      ...incoming.map((file) => ({ id: crypto.randomUUID(), file })),
    ])
  }
  useTransferReceiver('rename', active && !packing && !readingDates, (request) => {
    void addFiles(request.files ?? [])
  })
  const move = (index: number, offset: number) => {
    if (running.current || readingDates || index + offset < 0 || index + offset >= files.length)
      return
    invalidate()
    setOverrides({})
    setFiles((previous) => {
      const next = [...previous]
      next.splice(index + offset, 0, next.splice(index, 1)[0])
      return next
    })
  }
  const pack = async () => {
    if (running.current || !files.length || errors || previewPending || readingDates) return
    running.current = true
    setPacking(true)
    invalidate()
    try {
      const output = await packOutputs(
        files.map((entry, index) => ({ name: preview[index].name, blob: entry.file })),
        '重命名文件.zip',
      )
      if (!mounted.current) return
      resultUrl.current = URL.createObjectURL(output.blob)
      setResult(resultUrl.current)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '打包失败，请减少文件数量后重试。')
    } finally {
      running.current = false
      if (mounted.current) setPacking(false)
    }
  }
  return (
    <main className="main-content rename-tool">
      <p className="sr-only" role="status" aria-atomic="true">
        {packing
          ? '正在生成 ZIP，请稍候。'
          : readingDates
            ? '正在读取拍摄时间，请稍候。'
            : result
              ? '重命名结果已生成，可以下载 ZIP。'
              : files.length
                ? `重命名预览：${files.length} 个文件，${errors} 个命名错误。`
                : ''}
      </p>
      <ToolHead
        toolId="rename"
        actions={
          <button
            type="button"
            className="tool-limits-toggle"
            aria-expanded={limitsOpen}
            onClick={() => setLimitsOpen((value) => !value)}
          >
            <Info size={15} />
            说明与限制
            <ChevronDown size={15} className={limitsOpen ? 'is-open' : undefined} />
          </button>
        }
      />
      {limitsOpen && (
        <div className="tool-limits-panel">
          <p>
            文件只在当前标签页内存中处理，不上传；刷新或关闭标签页即清空。本地仅保存主题、预设与收藏等偏好设置。
          </p>
          <ul>
            {toolLimits.map((limit) => (
              <li key={limit}>{limit}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="tool-body">
        <div className="tool-main">
          <TbCard aria-label="重命名文件">
            <button
              type="button"
              className={`flex w-full items-center gap-4 rounded-[20px] border-2 border-dashed text-left transition disabled:opacity-60 ${
                files.length ? 'px-4 py-3' : 'flex-col justify-center px-6 py-12 text-center'
              } ${
                dragging
                  ? 'border-[#0071e3] bg-[#0071e3]/5'
                  : 'border-tb-line hover:border-[#0071e3]/50'
              }`}
              disabled={packing || readingDates}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <span
                aria-hidden="true"
                className={`grid shrink-0 place-items-center rounded-full bg-[#0071e3] text-white ${
                  files.length ? 'size-9' : 'size-14 shadow-[0_10px_24px_-10px_rgba(0,113,227,0.8)]'
                }`}
              >
                <FileUp size={files.length ? 16 : 24} strokeWidth={1.75} />
              </span>
              <span className="min-w-0">
                <span
                  className={`block font-semibold [overflow-wrap:anywhere] ${files.length ? 'text-[14px]' : 'text-[19px]'}`}
                >
                  {files.length ? '继续添加文件，或拖到这里' : '选择文件，或拖到这里'}
                </span>
                <span className="mt-1 block text-[13px] text-tb-mute [overflow-wrap:anywhere]">
                  任意格式，最多 100 个、总计 100 MB；只改名称，原文件不动
                </span>
              </span>
            </button>
            <input
              ref={input}
              type="file"
              tabIndex={-1}
              multiple
              className="sr-only"
              aria-label="选择需要重命名的文件"
              disabled={packing || readingDates}
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
          </TbCard>
          {!!files.length && (
            <TbCard
              title="实时预览"
              extra={
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={packing || readingDates}
                  onClick={() => {
                    invalidate()
                    setOverrides({})
                    setNameList('')
                    setFiles([])
                  }}
                >
                  <Trash2 size={14} />
                  清空
                </Button>
              }
            >
              {previewPending && (
                <p role="status" className="text-[12px] text-tb-mute">
                  正在预览正则规则…
                </p>
              )}
              {previewState.error && (
                <div role="alert">
                  <TbNotice tone="error">{previewState.error}</TbNotice>
                </div>
              )}
              <div className="rename-table overflow-hidden rounded-[18px] ring-1 ring-tb-line">
                <table className="w-full table-fixed border-collapse text-[13px]">
                  <colgroup>
                    <col className="w-24 max-md:w-10" />
                    <col />
                    <col className="w-8 max-md:collapse" />
                    <col />
                    <col className="w-[4.5rem]" />
                  </colgroup>
                  <thead className="max-md:hidden">
                    <tr>
                      <th className={thCls}>顺序</th>
                      <th className={thCls}>原文件名</th>
                      <th className={thCls} aria-hidden="true" />
                      <th className={thCls}>新文件名（可直接修改）</th>
                      <th className={`${thCls} text-right!`}>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {files.map((entry, index) => {
                      const cell = `${tdCls}${index === files.length - 1 ? ' border-b-0!' : ''}`
                      const row = preview[index]
                      return (
                        <tr key={entry.id} className={row.error ? 'bg-[#ff3b30]/5' : undefined}>
                          <td className={`${cell} px-1!`}>
                            <span className="flex max-md:flex-col items-center gap-0.5">
                              <span className="text-[11px] text-tb-mute tabular-nums">
                                {index + 1}
                              </span>
                              <button
                                type="button"
                                aria-label={`上移 ${entry.file.name}`}
                                disabled={packing || readingDates || index === 0}
                                onClick={() => move(index, -1)}
                                className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                              >
                                <ArrowUp size={13} />
                              </button>
                              <button
                                type="button"
                                aria-label={`下移 ${entry.file.name}`}
                                disabled={packing || readingDates || index === files.length - 1}
                                onClick={() => move(index, 1)}
                                className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                              >
                                <ArrowDown size={13} />
                              </button>
                            </span>
                          </td>
                          <td className={`${cell} px-3! max-md:hidden`}>
                            <span className="flex items-center gap-3">
                              <span
                                aria-hidden="true"
                                className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-tb-chip text-[11px] font-semibold uppercase text-[#57575d] dark:text-tb-mute"
                              >
                                {entry.file.name.includes('.')
                                  ? entry.file.name.split('.').pop()
                                  : 'FILE'}
                              </span>
                              <span className="min-w-0">
                                <span
                                  className="block truncate font-medium"
                                  title={entry.file.name}
                                >
                                  {entry.file.name}
                                </span>
                                {(entry.shotAt || entry.shotError) && (
                                  <small className="mt-0.5 block text-[11px] text-tb-mute [overflow-wrap:anywhere]">
                                    {entry.shotAt ? `拍摄 ${entry.shotAt}` : entry.shotError}
                                  </small>
                                )}
                              </span>
                            </span>
                          </td>
                          <td className={`${cell} px-2! max-md:hidden`}>
                            <ArrowRight size={14} aria-hidden="true" className="text-[#bf5af2]" />
                          </td>
                          <td
                            className={`${row.error ? 'rename-error' : 'rename-new'} ${cell} px-3!`}
                          >
                            <div className="flex min-w-0 items-center gap-1">
                              <input
                                aria-label={`新文件名 ${entry.file.name}`}
                                aria-invalid={!!row.error}
                                aria-describedby={
                                  row.error ? `rename-error-${entry.id}` : undefined
                                }
                                value={row.name}
                                disabled={packing || readingDates}
                                onChange={(event) => {
                                  invalidate()
                                  setOverrides((previous) => ({
                                    ...previous,
                                    [index]: event.target.value,
                                  }))
                                }}
                                className={`min-w-0 flex-1 rounded-[8px] bg-transparent px-2 py-1.5 font-mono text-[13px] text-tb-fg ring-1 outline-none transition focus:ring-2 focus:ring-[#0071e3] ${
                                  overrides[index] !== undefined
                                    ? 'ring-[#bf5af2]/50'
                                    : 'ring-transparent hover:ring-tb-line'
                                }`}
                              />
                              {overrides[index] !== undefined && (
                                <button
                                  type="button"
                                  aria-label={`还原 ${entry.file.name} 的生成名`}
                                  disabled={packing || readingDates}
                                  onClick={() =>
                                    setOverrides((previous) => {
                                      const next = { ...previous }
                                      delete next[index]
                                      return next
                                    })
                                  }
                                  className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              )}
                            </div>
                            {row.error && (
                              <small id={`rename-error-${entry.id}`}>{row.error}</small>
                            )}
                          </td>
                          <td className={`${cell} px-2! text-right`}>
                            <span className="flex items-center justify-end gap-1.5">
                              {row.error ? (
                                <CircleAlert
                                  size={15}
                                  aria-hidden="true"
                                  className="shrink-0 text-[#c4141f] dark:text-[#ff6961]"
                                />
                              ) : (
                                <Check
                                  size={15}
                                  aria-hidden="true"
                                  className="shrink-0 text-[#1a7f37] dark:text-[#30d158]"
                                />
                              )}
                              <button
                                type="button"
                                aria-label={`移除 ${entry.file.name}`}
                                disabled={packing || readingDates}
                                onClick={() => {
                                  if (running.current) return
                                  invalidate()
                                  setFiles((previous) =>
                                    previous.filter((item) => item.id !== entry.id),
                                  )
                                }}
                                className="grid size-7! shrink-0 place-items-center rounded-full text-tb-mute transition hover:bg-tb-chip hover:text-tb-fg disabled:opacity-30"
                              >
                                <X size={14} />
                              </button>
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {errors > 0 && (
                <p className="tool-error" role="alert">
                  有 {errors} 个文件名需要调整，修正后即可打包。
                </p>
              )}
            </TbCard>
          )}
        </div>
        <aside className="tool-aside">
          <TbCard title="命名规则">
            <RenameRules options={options} update={update} busy={packing || readingDates} />
          </TbCard>
          <TbCard title="更多">
            <RenameMore
              options={options}
              update={update}
              busy={packing || readingDates}
              sortRow={
                !!files.length && (
                  <div className="border-t border-tb-line pt-2.5">
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="grid min-w-0 flex-1 basis-44 gap-1.5 text-[12px] font-semibold text-tb-mute">
                        文件排序
                        <Select
                          disabled={packing || readingDates}
                          value="pick"
                          onValueChange={(value) => {
                            if (value === 'pick') return
                            invalidate()
                            setOverrides({})
                            setFiles((previous) => sortRenameFiles(previous, value as RenameSort))
                            toast.info('已排序；逐项覆盖名已清除，编号按新顺序生成。')
                          }}
                        >
                          <SelectTrigger aria-label="文件排序" className="font-normal">
                            <SelectValue placeholder="文件排序" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pick">文件排序</SelectItem>
                            {(
                              [
                                ['name-asc', '名称自然升序'],
                                ['name-desc', '名称自然降序'],
                                ['modified-asc', '修改时间从早到晚'],
                                ['modified-desc', '修改时间从晚到早'],
                                ['size-asc', '大小从小到大'],
                                ['size-desc', '大小从大到小'],
                                ['shot-asc', '拍摄时间从早到晚'],
                                ['shot-desc', '拍摄时间从晚到早'],
                              ] as const
                            ).map(([key, label]) => (
                              <SelectItem
                                key={key}
                                value={key}
                                disabled={
                                  key.startsWith('shot') && !files.some((entry) => entry.shotAt)
                                }
                              >
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={packing || readingDates}
                        onClick={async () => {
                          setReadingDates(true)
                          invalidate()
                          let found = 0
                          try {
                            for (const entry of files) {
                              if (entry.shotAt) {
                                found++
                                continue
                              }
                              try {
                                const shotAt = await readPhotoDate(entry.file)
                                found++
                                setFiles((previous) =>
                                  previous.map((item) =>
                                    item.id === entry.id
                                      ? { ...item, shotAt, shotError: undefined }
                                      : item,
                                  ),
                                )
                              } catch (error) {
                                setFiles((previous) =>
                                  previous.map((item) =>
                                    item.id === entry.id
                                      ? {
                                          ...item,
                                          shotError:
                                            error instanceof Error
                                              ? error.message
                                              : '拍摄时间读取失败。',
                                        }
                                      : item,
                                  ),
                                )
                              }
                            }
                            toast.info(
                              `读取完成：${found}/${files.length} 个文件有拍摄时间。缺失时间的文件排序时放在最后。`,
                            )
                          } finally {
                            setReadingDates(false)
                          }
                        }}
                      >
                        {readingDates ? '正在读取…' : '读取照片时间'}
                      </Button>
                    </div>
                  </div>
                )
              }
            >
              <div className="flex flex-col gap-2">
                <Textarea
                  aria-label="粘贴目标名称列表"
                  placeholder="从文本列表导入：每行一个目标文件名（含扩展名），数量需与文件数一致"
                  value={nameList}
                  disabled={packing || readingDates || !files.length}
                  onChange={(event) => setNameList(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={packing || readingDates || !files.length || !nameList.trim()}
                  onClick={() => {
                    const parsed = parseNameList(nameList, files.length)
                    if ('error' in parsed) {
                      toast.error(parsed.error)
                      return
                    }
                    invalidate()
                    setOverrides(
                      Object.fromEntries(parsed.names.map((name, index) => [index, name])),
                    )
                    toast.success(
                      `已导入 ${parsed.names.length} 个目标名称，可在表格中继续逐项修改。`,
                    )
                  }}
                >
                  <ClipboardPaste size={14} />
                  导入名称
                </Button>
              </div>
            </RenameMore>
          </TbCard>
        </aside>
      </div>
      <div className="workbench-actions">
        <div className="workbench-status">
          <span>
            文件 <b className="font-semibold text-tb-fg tabular-nums">{files.length} / 100</b>
          </span>
          <span>
            将改名{' '}
            <b
              className={`font-semibold tabular-nums ${
                changed ? 'text-[#0058b0] dark:text-[#64b5ff]' : 'text-tb-fg'
              }`}
            >
              {changed}
            </b>
          </span>
          {!!errors && (
            <span>
              待解决{' '}
              <b className="font-semibold text-[#c4141f] tabular-nums dark:text-[#ff6961]">
                {errors}
              </b>
            </span>
          )}
        </div>
        <div className="workbench-bar-actions">
          {!!files.length && !errors && !previewPending && !readingDates && (
            <OutputActions
              outputs={files.map((entry, index) => ({
                name: preview[index].name,
                blob: entry.file,
              }))}
              disabled={packing || readingDates}
            />
          )}
          {result && (
            <Button variant="outline" asChild>
              <a href={result} download="重命名文件.zip">
                <ArrowDownToLine size={14} />
                下载 ZIP
              </a>
            </Button>
          )}
          <Button
            disabled={
              !files.length || errors > 0 || previewPending || readingDates || packing || !!result
            }
            onClick={pack}
          >
            {packing ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : (
              <ArrowDownToLine size={14} />
            )}
            {packing ? '正在打包' : `生成 ZIP${files.length ? ` (${files.length})` : ''}`}
          </Button>
        </div>
      </div>
    </main>
  )
}
