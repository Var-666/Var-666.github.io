import { useTransferReceiver, type ToolTransfer } from './lib/tool-transfer'
import { ConfirmImport } from './components/ConfirmImport'
import { TextEncodingSelect } from './components/TextEncodingSelect'
import { readTextFile, type TextEncoding, type DecodedText } from './lib/text-encoding'
import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import { ArrowRightLeft, FileSpreadsheet, FileUp, LoaderCircle } from 'lucide-react'
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
import { compareTables, commonHeaders, diffMatrices, type TableMatrix } from './lib/table-compare'
import {
  loadWorkbook,
  matricesToExcelFile,
  parseCsvMatrix,
  type WorkbookData,
} from './lib/file-excel'
import { packOutputs } from './lib/file-media'
import { outputName, type OutputFile } from './lib/file-convert'

type Side = 'left' | 'right'
type SideState = {
  requestedEncoding: TextEncoding
  encoding: DecodedText['encoding'] | null
  file: File | null
  workbook: WorkbookData | null
  sheetName: string
  matrix: TableMatrix | null
  error: string
}

const emptySide: SideState = {
  requestedEncoding: 'auto',
  encoding: null,
  file: null,
  workbook: null,
  sheetName: '',
  matrix: null,
  error: '',
}
const previewLimit = 50

const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`

/** 从 CSV 文本或已选工作表构造表格矩阵；首行为表头 */
function matrixFromRows(name: string, rows: string[][]): TableMatrix {
  const [headers = [], ...body] = rows
  return { name, headers, rows: body }
}

export default function CompareTool({ active }: { active: boolean }) {
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransfer | null>(null)
  useEffect(() => {
    if (!active) setIncomingTransfer(null)
  }, [active])
  const [left, setLeft] = useState<SideState>(emptySide)
  const [right, setRight] = useState<SideState>(emptySide)
  const [keyColumn, setKeyColumn] = useState('')
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([])
  const [normalizeSpaces, setNormalizeSpaces] = useState(false)
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState<(OutputFile & { url: string }) | null>(null)
  const leftInput = useRef<HTMLInputElement>(null)
  const rightInput = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())

  useEffect(() => {
    const current = urls.current
    return () => {
      for (const url of current) URL.revokeObjectURL(url)
      current.clear()
    }
  }, [])

  const loadFile = async (
    side: Side,
    file: File | undefined,
    requestedEncoding: TextEncoding = (side === 'left' ? left : right).requestedEncoding,
  ) => {
    if (!file) return
    setBusy(true)
    setOutput(null)
    const patch = (next: Partial<SideState>) =>
      side === 'left' ? setLeft((p) => ({ ...p, ...next })) : setRight((p) => ({ ...p, ...next }))
    patch({ ...emptySide, file, requestedEncoding })
    try {
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const workbook = await loadWorkbook(file)
        const sheetName = workbook.sheets[0]?.name ?? ''
        patch({
          workbook,
          sheetName,
          matrix: matrixFromRows(file.name, workbook.sheet(sheetName).rows),
        })
      } else {
        const decoded = await readTextFile(file, requestedEncoding)
        const parsed = parseCsvMatrix(decoded.text)
        patch({ matrix: matrixFromRows(file.name, parsed.rows), encoding: decoded.encoding })
      }
    } catch (error) {
      patch({ error: error instanceof Error ? error.message : '读取失败，请检查文件与编码。' })
    } finally {
      setBusy(false)
    }
  }

  const applyTransfer = async (request: ToolTransfer) => {
    const files = request.files ?? []
    if (files.length > 1) {
      await loadFile('left', files[0])
      await loadFile('right', files[1])
    } else await loadFile(!left.file ? 'left' : !right.file ? 'right' : 'left', files[0])
  }
  useTransferReceiver('compare', active && !busy && !incomingTransfer, (request) => {
    if (
      ((request.files?.length ?? 0) > 1 && (left.file || right.file)) ||
      (left.file && right.file)
    )
      setIncomingTransfer(request)
    else void applyTransfer(request)
  })
  const selectSheet = (side: Side, sheetName: string) => {
    const patch = (next: Partial<SideState>) =>
      side === 'left' ? setLeft((p) => ({ ...p, ...next })) : setRight((p) => ({ ...p, ...next }))
    const workbook = side === 'left' ? left.workbook : right.workbook
    if (!workbook) return
    setOutput(null)
    try {
      patch({
        sheetName,
        matrix: matrixFromRows(
          side === 'left' ? left.file!.name : right.file!.name,
          workbook.sheet(sheetName).rows,
        ),
      })
    } catch (error) {
      patch({ error: error instanceof Error ? error.message : '无法读取工作表。' })
    }
  }

  const commons = useMemo(
    () => (left.matrix && right.matrix ? commonHeaders(left.matrix, right.matrix) : []),
    [left.matrix, right.matrix],
  )
  const effectiveKey = keyColumn && commons.includes(keyColumn) ? keyColumn : (commons[0] ?? '')
  const compareColumns = commons.filter(
    (column) => column !== effectiveKey && !ignoredColumns.includes(column),
  )

  const comparison = useMemo(() => {
    if (!left.matrix || !right.matrix || !effectiveKey) return null
    try {
      return {
        report: compareTables(left.matrix, right.matrix, {
          keyColumn: effectiveKey,
          compareColumns,
          normalizeSpaces,
        }),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '无法比较，请检查主键与比较列。' }
    }
  }, [left.matrix, right.matrix, effectiveKey, compareColumns, normalizeSpaces])

  const reportError = comparison?.error ?? ''
  const validReport = comparison?.report ?? null
  const diffCount = validReport
    ? validReport.added.length + validReport.removed.length + validReport.changed.length
    : 0

  const exportFile = async (kind: 'xlsx' | 'csv') => {
    if (!validReport || !left.matrix || !right.matrix || !diffCount) return
    setBusy(true)
    try {
      const matrices = diffMatrices(left.matrix, right.matrix, validReport)
      const file: OutputFile =
        kind === 'xlsx'
          ? await matricesToExcelFile(matrices, '表格对比结果')
          : await packOutputs(
              matrices.map((sheet) => ({
                name: outputName(sheet.name, 'csv'),
                blob: new Blob(['\uFEFF', Papa.unparse(sheet.rows, { escapeFormulae: true })], {
                  type: 'text/csv;charset=utf-8',
                }),
              })),
              '表格对比结果.zip',
            )
      const url = URL.createObjectURL(file.blob)
      urls.current.add(url)
      setOutput({ ...file, url })
      toast.success('差异结果已生成，可下载查看。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  const sidePanel = (side: Side, state: SideState) => {
    const label = side === 'left' ? '旧表（左）' : '新表（右）'
    const input = side === 'left' ? leftInput : rightInput
    return (
      <div className="compare-side">
        <div className="compare-side-head">
          <strong>{label}</strong>
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <FileUp size={14} />
            {state.file ? '更换文件' : '选择 CSV / XLSX'}
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,.xlsx"
            className="sr-only"
            aria-label={`选择${label}文件`}
            onChange={(event) => {
              void loadFile(side, event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
        {state.file && (
          <p className="compare-file-meta">
            {state.file.name} · {sizeLabel(state.file.size)}
          </p>
        )}
        {state.workbook && (
          <label className="compare-sheet-select">
            工作表
            <Select
              value={state.sheetName}
              disabled={busy}
              onValueChange={(value) => selectSheet(side, value)}
            >
              <SelectTrigger aria-label={`${label}工作表`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {state.workbook.sheets.map((sheet) => (
                  <SelectItem key={sheet.name} value={sheet.name}>
                    {sheet.name}（{sheet.rows} 行 × {sheet.cols} 列）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        {!state.workbook && (
          <TextEncodingSelect
            label={`${label}读取编码`}
            value={state.requestedEncoding}
            disabled={busy}
            onChange={(value) => {
              if (state.file) void loadFile(side, state.file, value)
              else if (side === 'left')
                setLeft((previous) => ({ ...previous, requestedEncoding: value }))
              else setRight((previous) => ({ ...previous, requestedEncoding: value }))
            }}
          />
        )}
        {state.encoding && <span className="encoding-note">已按 {state.encoding} 读取</span>}
        {state.matrix && (
          <p className="compare-file-meta">
            {state.matrix.rows.length.toLocaleString()} 行数据 · {state.matrix.headers.length} 列
          </p>
        )}
        {state.error && (
          <p className="compare-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    )
  }

  return (
    <main className="main-content compare-tool">
      <ConfirmImport
        open={active && !!incomingTransfer}
        description={
          incomingTransfer?.files?.length === 1
            ? '旧表将被新文件替换，新表保留。'
            : '当前两份表格与未下载结果将被新任务替换。'
        }
        onCancel={() => setIncomingTransfer(null)}
        onAccept={() => {
          if (incomingTransfer) void applyTransfer(incomingTransfer)
          setIncomingTransfer(null)
        }}
      />
      <section className="intro">
        <h1>表格对比</h1>
      </section>
      <p className="compare-note">
        导入旧表与新表（CSV 或
        .xlsx），选择主键列后按主键匹配记录：列出新增、删除与修改（逐列前后对照）。
        重复主键按首次出现参与匹配并显式提示，主键为空的行不参与匹配；不自动猜测主键。
      </p>
      <div className="compare-grid">
        {sidePanel('left', left)}
        <ArrowRightLeft className="compare-swap-icon" size={18} aria-hidden="true" />
        {sidePanel('right', right)}
      </div>
      {left.matrix && right.matrix && (
        <section className="compare-options" aria-label="对比选项">
          <label>
            主键列
            <Select value={effectiveKey} onValueChange={setKeyColumn}>
              <SelectTrigger aria-label="主键列">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commons.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="compare-switch">
            <Switch
              aria-label="空格规范化"
              checked={normalizeSpaces}
              onCheckedChange={(value) => {
                setNormalizeSpaces(value)
                setOutput(null)
              }}
            />
            空格规范化（仅空白不同的值视为相同）
          </label>
          {!!commons.length && (
            <div className="compare-columns">
              <span>比较列（取消勾选的列不参与比较）：</span>
              {commons
                .filter((column) => column !== effectiveKey)
                .map((column) => {
                  const ignored = ignoredColumns.includes(column)
                  return (
                    <label key={column} className="compare-column-chip">
                      <input
                        type="checkbox"
                        checked={!ignored}
                        onChange={() => {
                          setIgnoredColumns((previous) =>
                            ignored
                              ? previous.filter((item) => item !== column)
                              : [...previous, column],
                          )
                          setOutput(null)
                        }}
                      />
                      {column}
                    </label>
                  )
                })}
            </div>
          )}
        </section>
      )}
      {reportError && (
        <p className="compare-error" role="alert">
          {reportError}
        </p>
      )}
      {validReport && (
        <section className="compare-result" aria-label="对比结果">
          <div className="compare-summary">
            <span className="chip chip-add">新增 {validReport.added.length}</span>
            <span className="chip chip-del">删除 {validReport.removed.length}</span>
            <span className="chip chip-mod">修改 {validReport.changed.length}</span>
            <span className="chip">未变 {validReport.unchanged}</span>
            {(validReport.headersOnlyLeft.length > 0 ||
              validReport.headersOnlyRight.length > 0) && (
              <span className="compare-warn" role="status">
                结构差异：仅旧表有 [{validReport.headersOnlyLeft.join('、')}]，仅新表有 [
                {validReport.headersOnlyRight.join('、')}]
              </span>
            )}
            {validReport.duplicateKeys.length > 0 && (
              <span className="compare-warn" role="status">
                重复主键（按首次出现匹配）：
                {validReport.duplicateKeys
                  .map(
                    (item) =>
                      `${item.side === 'left' ? '旧' : '新'}表「${item.key}」×${item.count}`,
                  )
                  .join('；')}
              </span>
            )}
            {validReport.missingKeys.left + validReport.missingKeys.right > 0 && (
              <span className="compare-warn" role="status">
                主键为空：旧表 {validReport.missingKeys.left} 行、新表{' '}
                {validReport.missingKeys.right} 行，未参与匹配
              </span>
            )}
          </div>
          {diffCount === 0 ? (
            <p className="compare-same">两表按当前设置没有差异。</p>
          ) : (
            <>
              {[
                {
                  title: `新增记录（${validReport.added.length}）`,
                  rows: validReport.added,
                  right: true,
                },
                {
                  title: `删除记录（${validReport.removed.length}）`,
                  rows: validReport.removed,
                  right: false,
                },
              ].map((block) =>
                block.rows.length ? (
                  <div key={block.title} className="compare-block">
                    <h3>{block.title}</h3>
                    <div className="compare-key-list">
                      {block.rows.slice(0, previewLimit).map((entry) => (
                        <span className="compare-key" key={entry.key} title={entry.key}>
                          {entry.key}
                        </span>
                      ))}
                      {block.rows.length > previewLimit && (
                        <span className="compare-more">
                          …共 {block.rows.length} 条，导出查看全部
                        </span>
                      )}
                    </div>
                  </div>
                ) : null,
              )}
              {!!validReport.changed.length && (
                <div className="compare-block">
                  <h3>修改记录（{validReport.changed.length}）</h3>
                  <ul className="compare-changes">
                    {validReport.changed.slice(0, previewLimit).map((entry) => (
                      <li key={entry.key}>
                        <span className="compare-key" title={entry.key}>
                          {entry.key}
                        </span>
                        {entry.cells.map((cell) => (
                          <span className="compare-change" key={cell.column}>
                            <b>{cell.column}</b>
                            <del>{cell.left || '（空）'}</del>→<ins>{cell.right || '（空）'}</ins>
                          </span>
                        ))}
                      </li>
                    ))}
                    {validReport.changed.length > previewLimit && (
                      <li className="compare-more">
                        …共 {validReport.changed.length} 条，导出查看全部
                      </li>
                    )}
                  </ul>
                </div>
              )}
              <div className="compare-export">
                <Button
                  size="sm"
                  disabled={busy || !diffCount}
                  onClick={() => void exportFile('xlsx')}
                >
                  {busy ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <FileSpreadsheet size={14} />
                  )}
                  导出 XLSX（新增 / 删除 / 修改三个工作表）
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !diffCount}
                  onClick={() => void exportFile('csv')}
                >
                  导出 CSV（ZIP 三个文件）
                </Button>
                {output && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={output.url} download={output.name}>
                      下载 {output.name}
                    </a>
                  </Button>
                )}
              </div>
            </>
          )}
        </section>
      )}
      <p className="compare-note compare-limit">
        限制：CSV 单个 2 MB（UTF-8 / GBK），XLSX 单个 10 MB、单表 10 万行 × 1024
        列；比较按单元格显示文本进行，不比较公式与样式。
      </p>
    </main>
  )
}
