import { useUnsavedWork } from '../DraftGuard'
import { OutputActions } from '../components/OutputActions'
import { useTransferReceiver } from '../tool-transfer'
import { TextEncodingSelect } from '../components/TextEncodingSelect'
import type { TextEncoding } from '../lib/text-encoding'
import { readTable, workbookTable, validateInputTables, type InputTable } from './input'
import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { FileSpreadsheet, FileUp, LoaderCircle, Trash2, X } from 'lucide-react'
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

type ExportFormat = 'csv' | 'xlsx'

const csvBlob = (rows: string[][]) =>
  new Blob(['\uFEFF', Papa.unparse(rows, { escapeFormulae: true })], {
    type: 'text/csv;charset=utf-8',
  })

export default function TableTool({ active }: { active: boolean }) {
  const [tables, setTables] = useState<InputTable[]>([])
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

  const columnSelect = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    withNone: boolean,
    noneLabel = '不拆分',
  ) => (
    <label>
      {label}
      <Select
        disabled={busy}
        value={value || (withNone ? 'none' : undefined)}
        onValueChange={onChange}
      >
        <SelectTrigger aria-label={label}>
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
      <ToolHead toolId="table" title="表格批量处理" tagline="多份表格，一次处理到位。" />
      <div className="tool-body">
        <div className="tool-main">
          <div className="table-files">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              <FileUp size={14} />
              添加表格文件（CSV / XLSX，最多 10 个）
            </Button>
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
            {!!tables.length && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setTables([])
                  setDroppedColumns([])
                  setOutput(null)
                }}
              >
                <Trash2 size={14} />
                清空
              </Button>
            )}
          </div>
          {!!tables.length && (
            <div className="table-file-list">
              {tables.map((table, index) => (
                <div className="table-file-row" key={table.id}>
                  <span>
                    {table.name}
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
                    {table.notices.map((notice, index) => (
                      <small className="encoding-note" key={index}>
                        {notice}
                      </small>
                    ))}
                  </span>
                  <span className="table-file-meta">
                    {table.rows.length.toLocaleString()} 行 × {table.headers.length} 列
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`移除 ${table.name}`}
                    disabled={busy}
                    onClick={() => {
                      setTables((previous) => previous.filter((_, i) => i !== index))
                      setOutput(null)
                    }}
                  >
                    <X size={15} />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {preview?.error && (
            <p className="compare-error" role="alert">
              {preview.error}
            </p>
          )}
          {validResult && (
            <section className="compare-result" aria-label="处理预览">
              <div className="compare-summary" role="status" aria-atomic="true">
                {validResult.stats.join && (
                  <span className="chip">
                    匹配 {validResult.stats.join.pairs} 对 · 左表未匹配{' '}
                    {validResult.stats.join.leftUnmatched} 行 · 右表未匹配{' '}
                    {validResult.stats.join.rightUnmatched} 行
                  </span>
                )}
                {!!validResult.stats.renamedColumns && (
                  <span className="chip">列改名 {validResult.stats.renamedColumns} 列</span>
                )}
                <span className="chip">
                  合并 {validResult.stats.files} 份 · {validResult.stats.mergedRows} 行
                </span>
                {!!validResult.stats.dedupedRemoved && (
                  <span className="chip chip-del">
                    去重删除 {validResult.stats.dedupedRemoved} 行
                  </span>
                )}
                {!!validResult.stats.filterRemoved && (
                  <span className="chip chip-del">
                    筛选移除 {validResult.stats.filterRemoved} 行
                  </span>
                )}
                {!!validResult.stats.droppedColumns.length && (
                  <span className="chip chip-mod">
                    删除列 {validResult.stats.droppedColumns.join('、')}
                  </span>
                )}
                <span className="chip chip-add">
                  结果 {validResult.stats.finalRows} 行 × {validResult.stats.finalColumns} 列
                </span>
                {!!options.splitBy && (
                  <span className="chip">
                    拆分为 {validResult.stats.groups.length} 组：
                    {validResult.stats.groups
                      .slice(0, 6)
                      .map((group) => group.value)
                      .join('、')}
                    {validResult.stats.groups.length > 6 ? ' …' : ''}
                  </span>
                )}
              </div>
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
                <p className="compare-more">
                  预览前 10 行 / 20 列，长单元格显示前 160 字；导出保留全部内容（共{' '}
                  {validResult.rows.length} 行）
                </p>
              )}
              <div className="compare-export">
                <Button
                  size="sm"
                  disabled={busy || !validResult.rows.length}
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
                {output && <OutputActions outputs={[output]} disabled={busy} />}
                {output && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={output.url} download={output.name}>
                      下载 {output.name}
                    </a>
                  </Button>
                )}
              </div>
            </section>
          )}
        </div>
        <aside className="tool-aside">
          {!!tables.length && (
            <div className="tool-aside-card">
              <section className="compare-options table-steps" aria-label="处理选项">
                <div className="table-step">
                  <h2>1. 合并或连接</h2>
                  <div className="table-option-row">
                    <label>
                      合并方式
                      <Select
                        disabled={busy}
                        value={mergeMode}
                        onValueChange={(value) => setMergeMode(value as TableMergeMode)}
                      >
                        <SelectTrigger aria-label="合并方式">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="strict">同结构追加</SelectItem>
                          <SelectItem value="align">按列名对齐补空</SelectItem>
                          <SelectItem value="left">左连接（保留左表）</SelectItem>
                          <SelectItem value="inner">内连接（只保留匹配）</SelectItem>
                          <SelectItem value="full">全连接（保留两表）</SelectItem>
                        </SelectContent>
                      </Select>
                    </label>
                    {isJoin && (
                      <>
                        <label>
                          左表主键
                          <Select
                            disabled={busy || !tables[0]}
                            value={effectiveLeftKey || undefined}
                            onValueChange={setLeftKey}
                          >
                            <SelectTrigger aria-label="左表主键">
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
                        <label>
                          右表主键
                          <Select
                            disabled={busy || !tables[1]}
                            value={effectiveRightKey || undefined}
                            onValueChange={setRightKey}
                          >
                            <SelectTrigger aria-label="右表主键">
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy || tables.length !== 2}
                          onClick={() => {
                            setTables((previous) => [previous[1], previous[0]])
                            setLeftKey(effectiveRightKey)
                            setRightKey(effectiveLeftKey)
                          }}
                        >
                          交换左右表
                        </Button>
                      </>
                    )}
                  </div>
                  {isJoin && (
                    <p className="conversion-note">
                      第一份为左表，第二份为右表；主键去首尾空白后精确匹配，空主键不互相匹配。一对多保留所有组合，超限时拒绝生成。
                    </p>
                  )}
                </div>
                <div className="table-step">
                  <label className="compare-switch">
                    <Switch
                      aria-label="启用去重"
                      checked={dedupeOn}
                      disabled={busy}
                      onCheckedChange={(value) => {
                        setDedupeOn(value)
                        setOutput(null)
                      }}
                    />
                    2. 去重
                  </label>
                  {dedupeOn && (
                    <div className="table-option-row">
                      {columnSelect(
                        '去重列',
                        effectiveDedupeColumn,
                        (value) => {
                          setDedupeColumn(value)
                          setOutput(null)
                        },
                        false,
                      )}
                      <label>
                        保留
                        <Select
                          value={keep}
                          disabled={busy}
                          onValueChange={(value) => setKeep(value as 'first' | 'last')}
                        >
                          <SelectTrigger aria-label="去重保留">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="first">第一条</SelectItem>
                            <SelectItem value="last">最后一条</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                    </div>
                  )}
                </div>
                <div className="table-step">
                  <label className="compare-switch">
                    <Switch
                      aria-label="启用筛选"
                      checked={filterOn}
                      disabled={busy}
                      onCheckedChange={(value) => {
                        setFilterOn(value)
                        setOutput(null)
                      }}
                    />
                    3. 筛选
                  </label>
                  {filterOn && (
                    <div className="table-option-row">
                      {columnSelect(
                        '筛选列',
                        effectiveFilterColumn,
                        (value) => {
                          setFilterColumn(value)
                          setOutput(null)
                        },
                        false,
                      )}
                      <label>
                        方式
                        <Select
                          disabled={busy}
                          value={filterMode}
                          onValueChange={(value) => setFilterMode(value as 'include' | 'exclude')}
                        >
                          <SelectTrigger aria-label="筛选方式">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="include">只保留包含</SelectItem>
                            <SelectItem value="exclude">排除包含</SelectItem>
                          </SelectContent>
                        </Select>
                      </label>
                      <label className="table-keyword">
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
                <div className="table-step">
                  <label className="compare-switch">
                    <Switch
                      aria-label="启用列操作"
                      checked={columnOpsOn}
                      disabled={busy}
                      onCheckedChange={setColumnOpsOn}
                    />
                    4. 列操作
                  </label>
                  {columnOpsOn && (
                    <>
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
                      <details className="tool-advanced">
                        <summary>列改名和顺序</summary>
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
                      </details>
                    </>
                  )}
                </div>
                <div className="table-step">
                  <h2>5. 拆分与导出</h2>
                  <div className="table-option-row">
                    {columnSelect(
                      '按列拆分',
                      splitBy,
                      (value) => {
                        setSplitBy(value === 'none' ? '' : value)
                        setOutput(null)
                      },
                      true,
                    )}
                    <label>
                      输出格式
                      <Select
                        value={format}
                        disabled={busy}
                        onValueChange={(value) => setFormat(value as ExportFormat)}
                      >
                        <SelectTrigger aria-label="输出格式">
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
              </section>
            </div>
          )}
          <div className="tool-aside-card">
            <details className="tool-advanced">
              <summary>使用说明与限制</summary>
              <p className="compare-note">
                导入 CSV / XLSX（可选工作表），单个 10 MB（CSV 最多 1000 万字符），总计 50
                MB；合并结果不超过 10 万行 / 100 万格。按固定顺序处理：合并或连接 →
                按关键列去重（保留第一条 / 最后一条）→ 按列筛选 → 删除列 →
                按字段拆分。每一步的影响在预览中给出数量，可导出 CSV 或 XLSX（拆分为 ZIP /
                多工作表）。
              </p>
            </details>
          </div>
        </aside>
      </div>
    </main>
  )
}
