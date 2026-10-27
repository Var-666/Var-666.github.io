import { TextEncodingSelect } from './components/TextEncodingSelect'
import { readTextFile, type TextEncoding, type DecodedText } from './lib/text-encoding'
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
import { matricesToExcelFile, parseCsvMatrix } from './lib/file-excel'
import { packOutputs } from './lib/file-media'
import type { OutputFile } from './lib/file-convert'
import { validateQueueFiles } from './lib/file-queue'
import {
  groupFileName,
  processTables,
  type LoadedTable,
  type ProcessOptions,
} from './lib/table-process'

type ExportFormat = 'csv' | 'xlsx'
type InputTable = LoadedTable & { file: File; encoding: DecodedText['encoding'] }
async function readTable(file: File, encoding: TextEncoding): Promise<InputTable> {
  const decoded = await readTextFile(file, encoding)
  const parsed = parseCsvMatrix(decoded.text)
  const [headers = [], ...rows] = parsed.rows
  return { name: file.name, file, encoding: decoded.encoding, headers, rows }
}

const csvBlob = (rows: string[][]) =>
  new Blob(['\uFEFF', Papa.unparse(rows, { escapeFormulae: true })], {
    type: 'text/csv;charset=utf-8',
  })

export default function TableTool({ active }: { active: boolean }) {
  const [tables, setTables] = useState<InputTable[]>([])
  const [readEncoding, setReadEncoding] = useState<TextEncoding>('auto')
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
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    if (!active) return
    const current = urls.current
    return () => {
      for (const url of current) URL.revokeObjectURL(url)
      current.clear()
    }
  }, [active])

  const headers = useMemo(() => tables[0]?.headers ?? [], [tables])
  const addFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setOutput(null)
    try {
      validateQueueFiles(
        tables.map((table) => new File([], table.name)),
        files,
        '.csv',
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
          loaded.push(await readTable(file, readEncoding))
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

  // 选项列取「已选列；不在当前表头时回退第一列」，UI 显示与实际处理使用同一取值
  const effectiveDedupeColumn = headers.includes(dedupeColumn) ? dedupeColumn : (headers[0] ?? '')
  const effectiveFilterColumn = headers.includes(filterColumn) ? filterColumn : (headers[0] ?? '')

  const options: ProcessOptions = useMemo(
    () => ({
      dedupe: dedupeOn && effectiveDedupeColumn ? { column: effectiveDedupeColumn, keep } : null,
      filter:
        filterOn && effectiveFilterColumn && keyword.trim()
          ? { column: effectiveFilterColumn, mode: filterMode, keyword }
          : null,
      dropColumns: droppedColumns.filter((column) => headers.includes(column)),
      splitBy: headers.includes(splitBy) ? splitBy : null,
    }),
    [
      headers,
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
      let file: OutputFile
      if (!options.splitBy) {
        file =
          format === 'csv'
            ? { name: '处理结果.csv', blob: csvBlob(matrix) }
            : await matricesToExcelFile([{ name: '处理结果', rows: matrix }], '处理结果')
      } else if (format === 'csv') {
        file = await packOutputs(
          validResult.stats.groups.map((group) => ({
            name: `${groupFileName(group.value)}.csv`,
            blob: csvBlob([result.headers, ...group.rows]),
          })),
          '处理结果-拆分.zip',
        )
      } else {
        file = await matricesToExcelFile(
          validResult.stats.groups.map((group) => ({
            name: groupFileName(group.value),
            rows: [result.headers, ...group.rows],
          })),
          '处理结果-拆分',
        )
      }
      const url = URL.createObjectURL(file.blob)
      urls.current.add(url)
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
      <Select value={value || (withNone ? 'none' : undefined)} onValueChange={onChange}>
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
      <section className="intro">
        <h1>表格批量处理</h1>
      </section>
      <p className="compare-note">
        导入多份同结构 CSV，按固定顺序处理：合并 → 按关键列去重（保留第一条 / 最后一条）→ 按列筛选 →
        删除列 → 按字段拆分。每一步的影响在预览中给出数量，可导出 CSV 或 XLSX（拆分为 ZIP /
        多工作表）。
      </p>
      <div className="table-files">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          <FileUp size={14} />
          添加 CSV 文件（最多 10 个）
        </Button>
        <input
          ref={input}
          type="file"
          disabled={busy}
          multiple
          accept=".csv"
          className="sr-only"
          aria-label="添加 CSV 文件"
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
              const updated = await Promise.all(tables.map((table) => readTable(table.file, value)))
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
            <div className="table-file-row" key={`${table.name}-${index}`}>
              <span>
                {table.name}
                <small className="encoding-note"> · 已按 {table.encoding} 读取</small>
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
      {!!tables.length && (
        <section className="compare-options" aria-label="处理选项">
          <div className="table-option-row">
            <label className="compare-switch">
              <Switch
                aria-label="启用去重"
                checked={dedupeOn}
                onCheckedChange={(value) => {
                  setDedupeOn(value)
                  setOutput(null)
                }}
              />
              去重
            </label>
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
              <Select value={keep} onValueChange={(value) => setKeep(value as 'first' | 'last')}>
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
          <div className="table-option-row">
            <label className="compare-switch">
              <Switch
                aria-label="启用筛选"
                checked={filterOn}
                onCheckedChange={(value) => {
                  setFilterOn(value)
                  setOutput(null)
                }}
              />
              筛选
            </label>
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
                onChange={(event) => {
                  setKeyword(event.target.value)
                  setOutput(null)
                }}
              />
            </label>
          </div>
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
                  onClick={() => {
                    setDroppedColumns((previous) =>
                      dropped ? previous.filter((item) => item !== column) : [...previous, column],
                    )
                    setOutput(null)
                  }}
                >
                  {column}
                </button>
              )
            })}
          </div>
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
              <Select value={format} onValueChange={(value) => setFormat(value as ExportFormat)}>
                <SelectTrigger aria-label="输出格式">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV{options.splitBy ? '（ZIP）' : ''}</SelectItem>
                  <SelectItem value="xlsx">XLSX{options.splitBy ? '（多工作表）' : ''}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </section>
      )}
      {preview?.error && (
        <p className="compare-error" role="alert">
          {preview.error}
        </p>
      )}
      {validResult && (
        <section className="compare-result" aria-label="处理预览">
          <div className="compare-summary">
            <span className="chip">
              合并 {validResult.stats.files} 份 · {validResult.stats.mergedRows} 行
            </span>
            {!!validResult.stats.dedupedRemoved && (
              <span className="chip chip-del">去重删除 {validResult.stats.dedupedRemoved} 行</span>
            )}
            {!!validResult.stats.filterRemoved && (
              <span className="chip chip-del">筛选移除 {validResult.stats.filterRemoved} 行</span>
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
                  {validResult.headers.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {validResult.rows.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {validResult.headers.map((_, columnIndex) => (
                      <td key={columnIndex}>{row[columnIndex] ?? ''}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {validResult.rows.length > 10 && (
            <p className="compare-more">
              预览前 10 行，共 {validResult.rows.length} 行，导出查看全部
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
      <p className="compare-note compare-limit">
        限制：单个 CSV 2 MB、UTF-8 / GBK，最多 10 份、合计 10 万行 / 100
        万格；合并要求各文件表头完全一致； 只处理普通表格数据，不支持公式、样式与合并单元格。
      </p>
    </main>
  )
}
