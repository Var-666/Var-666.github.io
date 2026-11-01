import { useUnsavedWork } from '../DraftGuard'
import { OutputActions } from '../components/OutputActions'
import { TbCard, TbCollapsible, revealCard } from '../components/tb'
import { useTransferReceiver } from '../tool-transfer'
import { TextEncodingSelect } from '../components/TextEncodingSelect'
import type { TextEncoding } from '../lib/text-encoding'
import { readTable, workbookTable, validateInputTables, type InputTable } from './input'
import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ArrowLeftRight,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  Info,
  LoaderCircle,
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
import { Switch } from '@/components/ui/switch'
import { matricesToExcelFile } from '../files/file-excel'
import { packOutputs } from '../files/file-media'
import type { OutputFile } from '../files/file-convert'
import { validateQueueFiles } from '../lib/file-queue'
import { ToolHead } from '../components/ToolHead'
import {
  groupFileNames,
  joinColumns,
  tableLimits,
  type TableMergeMode,
  processTables,
  type ProcessOptions,
} from './table-process'
import { sampleBatchFiles } from './table-samples'

type ExportFormat = 'csv' | 'xlsx'

const csvBlob = (rows: string[][]) =>
  new Blob(['\uFEFF', Papa.unparse(rows, { escapeFormulae: true })], {
    type: 'text/csv;charset=utf-8',
  })

export default function TableTool({ active }: { active: boolean }) {
  const [tables, setTables] = useState<InputTable[]>([])
  const [limitsOpen, setLimitsOpen] = useState(false)
  const [readEncoding, setReadEncoding] = useState<TextEncoding>('auto')
  const [mergeMode, setMergeMode] = useState<TableMergeMode>('strict')
  const [leftKey, setLeftKey] = useState('')
  const [rightKey, setRightKey] = useState('')
  const [columnNames, setColumnNames] = useState<Record<string, string>>({})
  const [columnOrder, setColumnOrder] = useState<string[]>([])
  const [columnOpsOn, setColumnOpsOn] = useState(false)
  const [dedupeOn, setDedupeOn] = useState(false)
  const [dedupeColumn, setDedupeColumn] = useState('')
  const [keep, setKeep] = useState<'first' | 'last'>('first')
  const [filterOn, setFilterOn] = useState(false)
  const [filterColumn, setFilterColumn] = useState('')
  const [filterMode, setFilterMode] = useState<'include' | 'exclude'>('include')
  const [keyword, setKeyword] = useState('')
  const [droppedColumns, setDroppedColumns] = useState<string[]>([])
  const [splitBy, setSplitBy] = useState('')
  const [format, setFormat] = useState<ExportFormat>('csv')
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState<(OutputFile & { url: string }) | null>(null)
  useUnsavedWork(tables.length > 0 || busy)
  const input = useRef<HTMLInputElement>(null)
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url)
    },
    [output],
  )

  const effectiveLeftKey = tables[0]?.headers.includes(leftKey)
    ? leftKey
    : (tables[0]?.headers[0] ?? '')
  const effectiveRightKey = tables[1]?.headers.includes(rightKey)
    ? rightKey
    : (tables[1]?.headers[0] ?? '')
  const isJoin = !['strict', 'align'].includes(mergeMode)
  const headers = useMemo(() => {
    const names =
      mergeMode === 'strict'
        ? (tables[0]?.headers ?? [])
        : mergeMode === 'align'
          ? [...new Set(tables.flatMap((table) => table.headers))]
          : joinColumns(tables[0]?.headers ?? [], tables[1]?.headers ?? [], effectiveRightKey)
              .headers
    return names.length > tableLimits.maxCols ? [] : names
  }, [tables, mergeMode, effectiveRightKey])
  useEffect(() => {
    setOutput(null)
  }, [
    tables,
    mergeMode,
    leftKey,
    rightKey,
    columnNames,
    columnOrder,
    columnOpsOn,
    keep,
    filterMode,
    format,
  ])
  const addFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setOutput(null)
    try {
      validateQueueFiles(
        tables.map((table) => table.file),
        files,
        '.csv,.xlsx',
        10,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    setBusy(true)
    const loaded: InputTable[] = []
    try {
      for (const file of files) {
        try {
          const existing = [...tables, ...loaded]
          const available =
            256 * 1024 * 1024 - existing.reduce((sum, table) => sum + table.expandedBytes, 0)
          const table = await readTable(file, readEncoding, undefined, available)
          validateInputTables([...existing, table])
          loaded.push(table)
        } catch (error) {
          // 单个文件失败不影响其他文件
          toast.error(`${file.name}：${error instanceof Error ? error.message : '读取失败'}`)
        }
      }
      if (loaded.length) {
        setTables((previous) => [...previous, ...loaded])
        const firstHeaders = tables[0]?.headers ?? loaded[0].headers
        setDroppedColumns((previous) => previous.filter((column) => firstHeaders.includes(column)))
      }
    } finally {
      setBusy(false)
    }
  }

  useTransferReceiver('table', active && !busy, (request) => {
    void addFiles(request.files ?? [])
  })
  // 选项列取「已选列；不在当前表头时回退第一列」，UI 显示与实际处理使用同一取值
  const effectiveDedupeColumn = headers.includes(dedupeColumn) ? dedupeColumn : (headers[0] ?? '')
  const effectiveFilterColumn = headers.includes(filterColumn) ? filterColumn : (headers[0] ?? '')

  const options: ProcessOptions = useMemo(
    () => ({
      merge: { mode: mergeMode, leftKey: effectiveLeftKey, rightKey: effectiveRightKey },
      renameColumns: columnOpsOn
        ? Object.fromEntries(
            Object.entries(columnNames).filter(
              ([key, value]) => headers.includes(key) && value.trim(),
            ),
          )
        : {},
      columnOrder: columnOpsOn ? columnOrder : [],
      dedupe: dedupeOn && effectiveDedupeColumn ? { column: effectiveDedupeColumn, keep } : null,
      filter:
        filterOn && effectiveFilterColumn && keyword.trim()
          ? { column: effectiveFilterColumn, mode: filterMode, keyword }
          : null,
      dropColumns: columnOpsOn ? droppedColumns.filter((column) => headers.includes(column)) : [],
      splitBy: headers.includes(splitBy) ? splitBy : null,
    }),
    [
      headers,
      mergeMode,
      effectiveLeftKey,
      effectiveRightKey,
      columnNames,
      columnOrder,
      columnOpsOn,
      dedupeOn,
      effectiveDedupeColumn,
      keep,
      filterOn,
      effectiveFilterColumn,
      filterMode,
      keyword,
      droppedColumns,
      splitBy,
    ],
  )

  const preview = useMemo(() => {
    if (!tables.length) return null
    try {
      return { result: processTables(tables, options) }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '处理失败，请检查选项。' }
    }
  }, [tables, options])

  const validResult = preview?.result ?? null

  const exportOutput = async () => {
    if (!validResult) return
    setBusy(true)
    try {
      const result = validResult
      const matrix = [result.headers, ...result.rows]
      const groupNames = groupFileNames(validResult.stats.groups.map((group) => group.value))
      let file: OutputFile
      if (!options.splitBy) {
        file =
          format === 'csv'
            ? { name: '处理结果.csv', blob: csvBlob(matrix) }
            : await matricesToExcelFile([{ name: '处理结果', rows: matrix }], '处理结果')
      } else if (format === 'csv') {
        function* outputs() {
          for (const [index, group] of result.stats.groups.entries())
            yield {
              name: `${groupNames[index]}.csv`,
              blob: csvBlob([result.headers, ...group.rows]),
            }
        }
        file = await packOutputs(outputs(), '处理结果-拆分.zip')
      } else {
        file = await matricesToExcelFile(
          validResult.stats.groups.map((group, index) => ({
            name: groupNames[index],
            rows: [result.headers, ...group.rows],
          })),
          '处理结果-拆分',
        )
      }
      const url = URL.createObjectURL(file.blob)
      setOutput({ ...file, url })
      toast.success('处理结果已生成，可下载查看。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  // V8：汇总 chip 用设计源格式「{模式名} {N} 份 → {行数} 行」，模式名与合并方式 Segmented 一致
  const mergeModeLabel =
    mergeMode === 'strict' ? '同结构追加' : mergeMode === 'align' ? '列名并集' : '主键连接'

  const columnSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    withNone: boolean,
    noneLabel = '不拆分',
  ) => (
    <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
      {label}
      <Select
        disabled={busy}
        value={value || (withNone ? 'none' : undefined)}
        onValueChange={onChange}
      >
        <SelectTrigger aria-label={label} className="font-normal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {withNone && <SelectItem value="none">{noneLabel}</SelectItem>}
          {headers.map((column) => (
            <SelectItem key={column} value={column}>
              {column}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )

  // V2：设计源 Segmented（r14 chip 容器 + r10 选项）——选中白底投影、未选中 #57575d（C 类达标色）
  const mergeSegment = (active: boolean) =>
    active
      ? 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3 py-1 text-[13px] font-medium shadow-sm transition disabled:opacity-50'
      : 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1 text-[13px] font-medium text-[#57575d] transition enabled:hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute'

  return (
    <main className="main-content table-tool">
      <p className={busy ? 'compare-note' : 'sr-only'} role="status" aria-atomic="true">
        {busy
          ? '正在读取或导出表格，请稍候。'
          : output
            ? '表格导出结果已生成，可以下载。'
            : tables.length
              ? `已导入 ${tables.length} 份表格。`
              : ''}
      </p>
      <ToolHead
        toolId="table"
        title="表格工具"
        tagline="两张表，差异一眼看清。"
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
      <div className={limitsOpen ? 'tool-limits-reveal' : 'tool-limits-reveal is-closed'}>
        <div className="tool-limits-panel">
          <p>
            导入 CSV / XLSX（可选工作表），单个 10 MB（CSV 最多 1000 万字符），总计 50
            MB；合并结果不超过 10 万行 / 100 万格。按固定顺序处理：合并或连接 →
            按关键列去重（保留第一条 / 最后一条）→ 按列筛选 → 删除列 →
            按字段拆分。每一步的影响在预览中给出数量，可导出 CSV 或 XLSX（拆分为 ZIP / 多工作表）。
          </p>
        </div>
      </div>
      <div className="tool-body">
        <div className="tool-main">
          <TbCard
            title="导入表格"
            aria-label="导入表格"
            extra={
              <div className="flex min-w-0 items-center gap-2">
                {tables.length ? (
                  <>
                    <span className="whitespace-nowrap text-[12px] tabular-nums text-tb-mute">
                      {tables.length} / 10 份
                    </span>
                    {/* V7：设计源卡头清空为 ghost 蓝字（text-tb-link，hover chip 底） */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-tb-link! hover:bg-tb-chip! hover:text-tb-link!"
                      disabled={busy}
                      onClick={(event) => {
                        setTables([])
                        setDroppedColumns([])
                        setOutput(null)
                        revealCard(event.currentTarget)
                      }}
                    >
                      <Trash2 size={14} />
                      清空
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busy}
                    onClick={() => void addFiles(sampleBatchFiles())}
                  >
                    载入示例
                  </Button>
                )}
              </div>
            }
          >
            <div className="min-w-0">
              <button
                type="button"
                className={
                  tables.length
                    ? 'flex w-full items-center gap-4 rounded-[20px] border-2 border-dashed border-tb-line px-4 py-3 text-left transition enabled:hover:border-[#0071e3]/50 disabled:opacity-60'
                    : 'flex w-full flex-col items-center justify-center gap-4 rounded-[20px] border-2 border-dashed border-tb-line px-6 py-12 text-center transition enabled:hover:border-[#0071e3]/50 disabled:opacity-60'
                }
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <span
                  className={
                    tables.length
                      ? 'grid size-9 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white'
                      : 'grid size-14 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white shadow-[0_10px_24px_-10px_rgba(0,113,227,0.8)]'
                  }
                  aria-hidden="true"
                >
                  <FileUp size={tables.length ? 16 : 24} strokeWidth={1.75} />
                </span>
                <span className="min-w-0">
                  <span
                    className={`block font-semibold [overflow-wrap:anywhere] ${tables.length ? 'text-[14px]' : 'text-[19px]'}`}
                  >
                    {tables.length ? '继续添加表格' : '添加表格文件（CSV / XLSX，最多 10 个）'}
                  </span>
                  <span className="mt-1 block text-[13px] text-tb-mute [overflow-wrap:anywhere]">
                    支持 UTF-8 与 GBK 编码，单个 10 MB；编号与前导零按文本保留
                  </span>
                </span>
              </button>
              <input
                ref={input}
                type="file"
                tabIndex={-1}
                disabled={busy}
                multiple
                accept=".csv,.xlsx"
                className="sr-only"
                aria-label="添加表格文件"
                onChange={(event) => {
                  void addFiles(Array.from(event.target.files || []))
                  event.target.value = ''
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <TextEncodingSelect
                value={readEncoding}
                disabled={busy}
                onChange={async (value) => {
                  if (!tables.length) {
                    setReadEncoding(value)
                    return
                  }
                  setBusy(true)
                  try {
                    const updated = await Promise.all(
                      tables.map((table) =>
                        table.workbook
                          ? Promise.resolve(table)
                          : readTable(table.file, value, table.id),
                      ),
                    )
                    validateInputTables(updated)
                    setTables(updated)
                    setReadEncoding(value)
                    setOutput(null)
                  } catch (error) {
                    toast.error(
                      error instanceof Error ? error.message : '无法重新读取文件，已保留原数据。',
                    )
                  } finally {
                    setBusy(false)
                  }
                }}
              />
            </div>
            {!!tables.length && (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {tables.map((table, index) => (
                  <div
                    className="table-file-row flex items-start! gap-3 rounded-[14px]! border border-tb-line! bg-tb-raise! px-3.5! py-2.5! text-[13px]! dark:bg-tb-chip"
                    key={table.id}
                  >
                    <span
                      className="mt-px grid flex-none! place-items-center overflow-visible! whitespace-normal! text-tb-orange"
                      aria-hidden="true"
                    >
                      <FileSpreadsheet size={18} />
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="block min-w-0 truncate font-medium">
                        {isJoin && index < 2 && (
                          <span className="mr-1.5 font-normal text-tb-mute">
                            {index ? '右表' : '左表'}
                          </span>
                        )}
                        {table.name}
                      </span>
                      <span className="text-[11px] tabular-nums text-tb-mute">
                        {table.rows.length.toLocaleString()} 行 × {table.headers.length} 列
                      </span>
                      {table.encoding && (
                        <small className="encoding-note"> · 已按 {table.encoding} 读取</small>
                      )}
                      {table.workbook && (
                        <Select
                          disabled={busy}
                          value={table.sheetName}
                          onValueChange={(value) => {
                            try {
                              const updated = workbookTable(
                                table.file,
                                table.workbook!,
                                value,
                                table.expandedBytes,
                                table.id,
                              )
                              const next = tables.map((item) =>
                                item.id === table.id ? updated : item,
                              )
                              validateInputTables(next)
                              setTables(next)
                              setOutput(null)
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : '无法读取该工作表。',
                              )
                            }
                          }}
                        >
                          <SelectTrigger aria-label={`${table.name} 工作表`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {table.workbook.sheets.map((sheet) => (
                              <SelectItem value={sheet.name} key={sheet.name}>
                                {sheet.name}（{sheet.rows} 行 × {sheet.cols} 列）
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {table.notices.map((notice, noticeIndex) => (
                        <small className="encoding-note" key={noticeIndex}>
                          {notice}
                        </small>
                      ))}
                    </span>
                    <button
                      type="button"
                      className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute enabled:hover:bg-tb-chip enabled:hover:text-tb-fg disabled:opacity-50"
                      aria-label={`移除 ${table.name}`}
                      disabled={busy}
                      onClick={() => {
                        setTables((previous) => previous.filter((_, i) => i !== index))
                        setOutput(null)
                      }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </TbCard>
          {preview?.error && (
            <p className="compare-error" role="alert">
              {preview.error}
            </p>
          )}
          {validResult && (
            <TbCard title="结果预览" aria-label="处理预览">
              <ol className="mb-4 flex flex-wrap gap-2">
                {validResult.stats.join && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums">
                    <span className="font-semibold">匹配</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      {validResult.stats.join.pairs} 对 · 左表未匹配{' '}
                      {validResult.stats.join.leftUnmatched} 行 · 右表未匹配{' '}
                      {validResult.stats.join.rightUnmatched} 行
                    </span>
                  </li>
                )}
                {!!validResult.stats.renamedColumns && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums">
                    <span className="font-semibold">列改名</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      {validResult.stats.renamedColumns} 列
                    </span>
                  </li>
                )}
                <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums">
                  <span className="font-semibold">{mergeModeLabel}</span>{' '}
                  <span className="text-[#57575d] dark:text-tb-mute">
                    {validResult.stats.files} 份 → {validResult.stats.mergedRows} 行
                  </span>
                </li>
                {!!validResult.stats.dedupedRemoved && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums text-[#a03530] dark:text-[#ef9c96]">
                    <span className="font-semibold">去重</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      删除 {validResult.stats.dedupedRemoved} 行
                    </span>
                  </li>
                )}
                {!!validResult.stats.filterRemoved && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums text-[#a03530] dark:text-[#ef9c96]">
                    <span className="font-semibold">筛选</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      移除 {validResult.stats.filterRemoved} 行
                    </span>
                  </li>
                )}
                {!!validResult.stats.droppedColumns.length && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums text-[#855700] dark:text-[#e9bd66]">
                    <span className="font-semibold">删除列</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      {validResult.stats.droppedColumns.join('、')}
                    </span>
                  </li>
                )}
                {!!options.splitBy && (
                  <li className="rounded-full bg-tb-chip px-3 py-1 text-[12px] tabular-nums">
                    <span className="font-semibold">拆分为</span>{' '}
                    <span className="text-[#57575d] dark:text-tb-mute">
                      {validResult.stats.groups.length} 组：
                      {validResult.stats.groups
                        .slice(0, 6)
                        .map((group) => group.value)
                        .join('、')}
                      {validResult.stats.groups.length > 6 ? ' …' : ''}
                    </span>
                  </li>
                )}
              </ol>
              <div className="table-preview-scroll">
                <table className="table-preview" aria-label="处理结果预览（前 10 行）">
                  <thead>
                    <tr>
                      {validResult.headers.slice(0, 20).map((header) => (
                        <th key={header}>{header}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {validResult.rows.slice(0, 10).map((row, index) => (
                      <tr key={index}>
                        {validResult.headers.slice(0, 20).map((_, columnIndex) => (
                          <td key={columnIndex}>
                            {(row[columnIndex] ?? '').length > 160
                              ? (row[columnIndex] ?? '').slice(0, 160) + '…'
                              : (row[columnIndex] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(validResult.rows.length > 10 ||
                validResult.headers.length > 20 ||
                validResult.rows
                  .slice(0, 10)
                  .some((row) => row.some((cell) => cell.length > 160))) && (
                <p className="compare-more mt-2.5">
                  预览前 10 行 / 20 列，长单元格显示前 160 字；导出保留全部内容（共{' '}
                  {validResult.rows.length} 行）
                </p>
              )}
            </TbCard>
          )}
        </div>
        <aside className="tool-aside">
          <div className="tool-aside-card">
            <h2 className="tool-aside-title">1 · 合并方式</h2>
            <div className="grid gap-3">
              {/* V2：合并方式 Segmented——strict=同结构追加、align=列名并集、left/inner/full=主键连接，
                 与设计源三选项一一对应；主键连接首次点击默认左连接（设计源 joinType 默认值），子胶囊可切换 */}
              <div
                className="flex min-w-0 flex-col items-start gap-1.5 text-[12px] font-semibold text-tb-mute"
                role="group"
                aria-label="合并方式"
              >
                合并方式
                <div className="inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-tb-chip p-1">
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={mergeMode === 'strict'}
                    onClick={() => setMergeMode('strict')}
                    className={mergeSegment(mergeMode === 'strict')}
                  >
                    同结构追加
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={mergeMode === 'align'}
                    onClick={() => setMergeMode('align')}
                    className={mergeSegment(mergeMode === 'align')}
                  >
                    列名并集
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    aria-pressed={isJoin}
                    onClick={() => {
                      if (!isJoin) setMergeMode('left')
                    }}
                    className={mergeSegment(isJoin)}
                  >
                    主键连接
                  </button>
                </div>
              </div>
              {isJoin && (
                <>
                  <div
                    className="inline-flex max-w-full flex-wrap gap-1 self-start rounded-[14px] bg-tb-chip p-1"
                    role="group"
                    aria-label="连接方式"
                  >
                    {(
                      [
                        ['left', '左连接'],
                        ['inner', '内连接'],
                        ['full', '全连接'],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        disabled={busy}
                        aria-pressed={mergeMode === value}
                        onClick={() => setMergeMode(value)}
                        className={mergeSegment(mergeMode === value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 max-[480px]:grid-cols-1">
                    <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                      左表主键
                      <Select
                        disabled={busy || !tables[0]}
                        value={effectiveLeftKey || undefined}
                        onValueChange={setLeftKey}
                      >
                        <SelectTrigger aria-label="左表主键" className="font-normal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tables[0]?.headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                    <button
                      type="button"
                      className="grid size-9 shrink-0 place-items-center rounded-full bg-tb-chip text-tb-mute enabled:hover:text-tb-fg disabled:opacity-30 max-[480px]:justify-self-center"
                      aria-label="交换左右表"
                      disabled={busy || tables.length !== 2}
                      onClick={() => {
                        setTables((previous) => [previous[1], previous[0]])
                        setLeftKey(effectiveRightKey)
                        setRightKey(effectiveLeftKey)
                      }}
                    >
                      <ArrowLeftRight size={15} aria-hidden="true" />
                    </button>
                    <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                      右表主键
                      <Select
                        disabled={busy || !tables[1]}
                        value={effectiveRightKey || undefined}
                        onValueChange={setRightKey}
                      >
                        <SelectTrigger aria-label="右表主键" className="font-normal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tables[1]?.headers.map((header) => (
                            <SelectItem key={header} value={header}>
                              {header}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>
                  </div>
                  <p className="text-[12px] text-tb-mute">
                    第一份为左表，第二份为右表；主键去首尾空白后精确匹配，空主键不互相匹配。一对多保留所有组合，超限时拒绝生成。
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="tool-aside-card">
            <h2 className="tool-aside-title">2 · 清理与拆分</h2>
            <div className="grid">
              <div className="mt-2.5 border-t border-tb-line pt-2.5 first:mt-0 first:border-t-0 first:pt-0">
                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[14px] text-tb-fg">
                  <span>关键列去重</span>
                  <Switch
                    aria-label="启用去重"
                    checked={dedupeOn}
                    disabled={busy}
                    onCheckedChange={(value) => {
                      setDedupeOn(value)
                      setOutput(null)
                    }}
                  />
                </label>
                {dedupeOn && (
                  <div className="grid gap-2.5 pt-1.5 pb-1">
                    {columnSelect(
                      '去重列',
                      effectiveDedupeColumn,
                      (value) => {
                        setDedupeColumn(value)
                        setOutput(null)
                      },
                      false,
                    )}
                    <div
                      role="group"
                      aria-label="去重保留"
                      className="inline-flex max-w-full flex-wrap gap-1 rounded-[14px] bg-tb-chip p-1"
                    >
                      <button
                        type="button"
                        className={
                          keep === 'first'
                            ? 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3 py-1 text-[13px] font-medium shadow-sm transition disabled:opacity-50'
                            : 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1 text-[13px] font-medium text-[#57575d] transition enabled:hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute'
                        }
                        aria-pressed={keep === 'first'}
                        disabled={busy}
                        onClick={() => setKeep('first')}
                      >
                        保留第一条
                      </button>
                      <button
                        type="button"
                        className={
                          keep === 'last'
                            ? 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-tb-card px-3 py-1 text-[13px] font-medium shadow-sm transition disabled:opacity-50'
                            : 'flex items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3 py-1 text-[13px] font-medium text-[#57575d] transition enabled:hover:text-tb-fg disabled:opacity-50 dark:text-tb-mute'
                        }
                        aria-pressed={keep === 'last'}
                        disabled={busy}
                        onClick={() => setKeep('last')}
                      >
                        保留最后一条
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-2.5 border-t border-tb-line pt-2.5 first:mt-0 first:border-t-0 first:pt-0">
                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[14px] text-tb-fg">
                  <span>筛选</span>
                  <Switch
                    aria-label="启用筛选"
                    checked={filterOn}
                    disabled={busy}
                    onCheckedChange={(value) => {
                      setFilterOn(value)
                      setOutput(null)
                    }}
                  />
                </label>
                {filterOn && (
                  <div className="grid gap-2.5 pt-1.5 pb-1">
                    {columnSelect(
                      '筛选列',
                      effectiveFilterColumn,
                      (value) => {
                        setFilterColumn(value)
                        setOutput(null)
                      },
                      false,
                    )}
                    <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                      方式
                      <Select
                        disabled={busy}
                        value={filterMode}
                        onValueChange={(value) => setFilterMode(value as 'include' | 'exclude')}
                      >
                        <SelectTrigger aria-label="筛选方式" className="font-normal">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="include">只保留包含</SelectItem>
                          <SelectItem value="exclude">排除包含</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    <label className="table-keyword grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                      关键词
                      <input
                        aria-label="筛选关键词"
                        value={keyword}
                        placeholder="关键词"
                        disabled={busy}
                        onChange={(event) => {
                          setKeyword(event.target.value)
                          setOutput(null)
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              <div className="mt-2.5 border-t border-tb-line pt-2.5 first:mt-0 first:border-t-0 first:pt-0">
                <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[14px] text-tb-fg">
                  <span>删除列</span>
                  <Switch
                    aria-label="启用列操作"
                    checked={columnOpsOn}
                    disabled={busy}
                    onCheckedChange={setColumnOpsOn}
                  />
                </label>
                {columnOpsOn && (
                  <div className="grid gap-2.5 pt-1.5 pb-1">
                    <div className="compare-columns">
                      <span>点击列名切换是否删除（红色 = 将删除）：</span>
                      {headers.map((column) => {
                        const dropped = droppedColumns.includes(column)
                        return (
                          <button
                            type="button"
                            key={column}
                            className={`compare-column-chip${dropped ? ' is-dropped' : ''}`}
                            aria-pressed={dropped}
                            disabled={busy}
                            onClick={() => {
                              setDroppedColumns((previous) =>
                                dropped
                                  ? previous.filter((item) => item !== column)
                                  : [...previous, column],
                              )
                              setOutput(null)
                            }}
                          >
                            {column}
                          </button>
                        )
                      })}
                    </div>
                    <TbCollapsible className="mt-0.5" title="列改名和顺序">
                      <div className="table-column-editor">
                        {[
                          ...columnOrder.filter((column) => headers.includes(column)),
                          ...headers.filter((column) => !columnOrder.includes(column)),
                        ].map((column, index, array) => (
                          <div className="table-column-row" key={column}>
                            <label>
                              {column}
                              <input
                                className="tool-input"
                                aria-label={`${column} 新列名`}
                                maxLength={255}
                                value={
                                  Object.hasOwn(columnNames, column) ? columnNames[column] : ''
                                }
                                placeholder={column}
                                disabled={busy || droppedColumns.includes(column)}
                                onChange={(event) =>
                                  setColumnNames((previous) => ({
                                    ...previous,
                                    [column]: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            {([-1, 1] as const).map((offset) => (
                              <Button
                                key={offset}
                                size="sm"
                                variant="outline"
                                aria-label={`${offset < 0 ? '上移列' : '下移列'} ${column}`}
                                disabled={
                                  busy || index + offset < 0 || index + offset >= array.length
                                }
                                onClick={() => {
                                  const order = [...array]
                                  order.splice(index + offset, 0, order.splice(index, 1)[0])
                                  setColumnOrder(order)
                                }}
                              >
                                {offset < 0 ? '↑' : '↓'}
                              </Button>
                            ))}
                          </div>
                        ))}
                      </div>
                    </TbCollapsible>
                  </div>
                )}
              </div>
              <div className="mt-2.5 border-t border-tb-line pt-2.5 first:mt-0 first:border-t-0 first:pt-0">
                <h3 className="py-1 text-[14px] font-semibold text-tb-fg">按字段拆分导出</h3>
                <div className="grid gap-2.5 pt-1.5 pb-1">
                  {columnSelect(
                    '按列拆分',
                    splitBy,
                    (value) => {
                      setSplitBy(value === 'none' ? '' : value)
                      setOutput(null)
                    },
                    true,
                  )}
                  <p className="text-[12px] text-tb-mute">
                    每个取值一份 CSV，打包为 ZIP；XLSX 拆分为多工作表。
                  </p>
                  <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                    输出格式
                    <Select
                      value={format}
                      disabled={busy}
                      onValueChange={(value) => setFormat(value as ExportFormat)}
                    >
                      <SelectTrigger aria-label="输出格式" className="font-normal">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV{options.splitBy ? '（ZIP）' : ''}</SelectItem>
                        <SelectItem value="xlsx">
                          XLSX{options.splitBy ? '（多工作表）' : ''}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>
      <div className="workbench-actions">
        <div className="workbench-status">
          {validResult ? (
            <>
              <span>
                输入 <b>{tables.length} 份</b>
              </span>
              <span>
                结果{' '}
                <b>
                  {validResult.stats.finalRows} 行 × {validResult.stats.finalColumns} 列
                </b>
              </span>
            </>
          ) : tables.length ? (
            <span>已导入 {tables.length} 份，请查看上方提示</span>
          ) : (
            <span>导入 CSV / XLSX 开始</span>
          )}
        </div>
        <div className="workbench-bar-actions">
          {output && <OutputActions outputs={[output]} disabled={busy} />}
          {output && (
            <Button size="sm" variant="outline" asChild>
              <a href={output.url} download={output.name}>
                下载 {output.name}
              </a>
            </Button>
          )}
          <Button
            size="sm"
            className="copy-button"
            disabled={busy || !validResult || !validResult.rows.length}
            onClick={() => void exportOutput()}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={14} />
            ) : (
              <FileSpreadsheet size={14} />
            )}
            {`导出 ${format === 'csv' ? 'CSV' : 'XLSX'}${
              options.splitBy ? (format === 'csv' ? '（ZIP）' : '（多工作表）') : ''
            }`}
          </Button>
        </div>
      </div>
    </main>
  )
}
