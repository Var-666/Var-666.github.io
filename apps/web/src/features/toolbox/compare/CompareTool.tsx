import { useUnsavedWork } from '../DraftGuard'
import { highlightDiffWorkbook } from './xlsx-highlight'
import { uniqueHeaders } from '../files/file-text'
import { OutputActions } from '../components/OutputActions'
import { TbCard } from '../components/tb'
import { useTransferReceiver, type ToolTransfer } from '../tool-transfer'
import { ConfirmImport } from '../components/ConfirmImport'
import { TextEncodingSelect } from '../components/TextEncodingSelect'
import { readTextFile, type TextEncoding, type DecodedText } from '../lib/text-encoding'
import { useEffect, useMemo, useRef, useState } from 'react'
import Papa from 'papaparse'
import {
  ArrowRightLeft,
  ChevronDown,
  FileSpreadsheet,
  FileUp,
  Info,
  LoaderCircle,
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
import { compareTables, commonHeaders, diffMatrices, type TableMatrix } from './table-compare'
import {
  loadWorkbook,
  matricesToExcelFile,
  parseCsvMatrix,
  type WorkbookData,
  sheetNotices,
  excelLimits,
} from '../files/file-excel'
import { packOutputs } from '../files/file-media'
import { outputName, type OutputFile } from '../files/file-convert'
import { ToolHead } from '../components/ToolHead'
import { sampleCompareFiles } from '../table/table-samples'

type Side = 'left' | 'right'
type SideState = {
  requestedEncoding: TextEncoding
  encoding: DecodedText['encoding'] | null
  file: File | null
  workbook: WorkbookData | null
  sheetName: string
  matrix: TableMatrix | null
  error: string
  notices: string[]
}

const emptySide: SideState = {
  requestedEncoding: 'auto',
  encoding: null,
  file: null,
  workbook: null,
  sheetName: '',
  matrix: null,
  error: '',
  notices: [],
}
const previewLimit = 50
const clip = (text: string) => (text.length > 160 ? text.slice(0, 160) + '…' : text)

const sizeLabel = (size: number) =>
  size < 1024 * 1024
    ? `${Math.max(1, Math.round(size / 1024))} KB`
    : `${(size / 1024 / 1024).toFixed(1)} MB`

// 分类视图卡的选中描边与标签配色（数值与设计源 KIND 一致；浅色标签加深保证对比度）
type DiffKind = 'added' | 'removed' | 'changed' | 'unchanged'
const catTone: Record<DiffKind, { label: string; ring: string }> = {
  added: { label: 'text-[#1b7f4d] dark:text-[#6fd0a0]', ring: 'var(--tb-green)' },
  removed: { label: 'text-[#b3453f] dark:text-[#ef9c96]', ring: '#ff3b30' },
  changed: { label: 'text-[#855700] dark:text-[#e9bd66]', ring: 'var(--tb-orange)' },
  unchanged: { label: 'text-tb-mute', ring: '#8e8e93' },
}

/** 从 CSV 文本或已选工作表构造表格矩阵；首行为表头 */
function matrixFromRows(name: string, rows: string[][], notices: string[]): TableMatrix {
  const [headers = [], ...body] = rows
  const names = uniqueHeaders(headers, notices)
  if (names.some((name) => name.length > 512)) throw new Error('列名超过 512 字符，请先缩短表头。')
  return { name, headers: names, rows: body }
}

export default function CompareTool({ active }: { active: boolean }) {
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransfer | null>(null)
  const [limitsOpen, setLimitsOpen] = useState(false)
  useEffect(() => {
    if (!active) setIncomingTransfer(null)
  }, [active])
  const [left, setLeft] = useState<SideState>(emptySide)
  const [right, setRight] = useState<SideState>(emptySide)
  const [keyColumn, setKeyColumn] = useState('')
  const [compositeOn, setCompositeOn] = useState(false)
  const [extraKeys, setExtraKeys] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'added' | 'removed' | 'changed' | 'unchanged'>('all')
  const [ignoredColumns, setIgnoredColumns] = useState<string[]>([])
  const [normalizeSpaces, setNormalizeSpaces] = useState(false)
  const [busy, setBusy] = useState(false)
  const [output, setOutput] = useState<(OutputFile & { url: string }) | null>(null)
  useUnsavedWork(!!left.file || !!right.file || busy)
  const leftInput = useRef<HTMLInputElement>(null)
  const rightInput = useRef<HTMLInputElement>(null)
  useEffect(
    () => () => {
      if (output) URL.revokeObjectURL(output.url)
    },
    [output],
  )
  useEffect(() => {
    setOutput(null)
  }, [keyColumn, compositeOn, extraKeys, ignoredColumns, normalizeSpaces])

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
    try {
      if (!/\.(csv|xlsx)$/i.test(file.name)) throw new Error('请选择 CSV 或 XLSX 文件。')
      if (!file.size || file.size > (/\.xlsx$/i.test(file.name) ? 10 : 2) * 1024 * 1024)
        throw new Error('文件不能为空；CSV 单个最多 2 MB，XLSX 单个最多 10 MB。')
      if (file.name.toLowerCase().endsWith('.xlsx')) {
        const workbook = await loadWorkbook(file)
        const sheetName = workbook.sheets[0]?.name ?? ''
        const sheet = workbook.sheet(sheetName),
          notices = sheetNotices(sheet)
        patch({
          ...emptySide,
          file,
          requestedEncoding,
          workbook,
          sheetName,
          matrix: matrixFromRows(file.name, sheet.rows, notices),
          notices,
        })
      } else {
        const decoded = await readTextFile(file, requestedEncoding)
        const parsed = parseCsvMatrix(decoded.text)
        const notices = [...parsed.notices]
        patch({
          ...emptySide,
          file,
          requestedEncoding,
          matrix: matrixFromRows(file.name, parsed.rows, notices),
          encoding: decoded.encoding,
          notices,
        })
      }
    } catch (error) {
      patch({
        error: `${file.name}：${error instanceof Error ? error.message : '读取失败，请检查文件与编码。'}`,
      })
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
      const sheet = workbook.sheet(sheetName),
        notices = sheetNotices(sheet)
      patch({
        sheetName,
        error: '',
        notices,
        matrix: matrixFromRows(
          side === 'left' ? left.file!.name : right.file!.name,
          sheet.rows,
          notices,
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
  const keyColumns = useMemo(
    () =>
      compositeOn
        ? [
            effectiveKey,
            ...extraKeys.filter((key) => commons.includes(key) && key !== effectiveKey),
          ]
        : [effectiveKey],
    [compositeOn, effectiveKey, extraKeys, commons],
  )
  const compareColumns = useMemo(
    () =>
      commons.filter((column) => !keyColumns.includes(column) && !ignoredColumns.includes(column)),
    [commons, keyColumns, ignoredColumns],
  )

  const comparison = useMemo(() => {
    if (!left.matrix || !right.matrix || !effectiveKey) return null
    try {
      return {
        report: compareTables(left.matrix, right.matrix, {
          keyColumn: effectiveKey,
          keyColumns,
          compareColumns,
          normalizeSpaces,
        }),
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '无法比较，请检查主键与比较列。' }
    }
  }, [left.matrix, right.matrix, effectiveKey, keyColumns, compareColumns, normalizeSpaces])

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
      if (
        kind === 'xlsx' &&
        matrices.some(
          (sheet) =>
            sheet.rows.length > excelLimits.maxRows ||
            sheet.rows.length * (sheet.rows[0]?.length ?? 0) > excelLimits.maxCells,
        )
      )
        throw new Error('XLSX 明细超过 10 万行或 100 万格，请减少比较列或导出 CSV。')
      const file: OutputFile =
        kind === 'xlsx'
          ? await highlightDiffWorkbook(await matricesToExcelFile(matrices, '表格对比结果'))
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
      setOutput({ ...file, url })
      toast.success('差异结果已生成，可下载查看。')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '导出失败，请重试。')
    } finally {
      setBusy(false)
    }
  }

  // 「载入示例」：设计源 SAMPLE_OLD / SAMPLE_NEW 数据，包装成 File 走现有 loadFile 校验与读取
  const loadSamples = async () => {
    const [oldFile, newFile] = sampleCompareFiles()
    await loadFile('left', oldFile)
    await loadFile('right', newFile)
  }

  const sidePanel = (side: Side, state: SideState) => {
    const label = side === 'left' ? '旧表（左）' : '新表（右）'
    const input = side === 'left' ? leftInput : rightInput
    return (
      <div className="grid min-w-0 gap-2">
        <span className="block text-[12px] font-semibold text-tb-mute">{label}</span>
        {state.file ? (
          <div className="table-file-row flex items-start! gap-3 rounded-[14px]! border border-tb-line! bg-tb-raise! px-3.5! py-2.5! text-[13px]! dark:bg-tb-chip">
            <span
              className="mt-px grid flex-none! place-items-center overflow-visible! whitespace-normal! text-tb-orange"
              aria-hidden="true"
            >
              <FileSpreadsheet size={18} />
            </span>
            <span className="grid min-w-0 flex-1 gap-0.5">
              <span className="block min-w-0 truncate font-medium">{state.file.name}</span>
              {state.matrix && (
                <span className="text-[11px] tabular-nums text-tb-mute">
                  {state.matrix.rows.length.toLocaleString()} 行 × {state.matrix.headers.length} 列
                </span>
              )}
            </span>
            <button
              type="button"
              className="grid size-7 shrink-0 place-items-center rounded-full text-tb-mute enabled:hover:bg-tb-chip enabled:hover:text-tb-fg disabled:opacity-50"
              aria-label={`移除 ${state.file.name}`}
              disabled={busy}
              onClick={() => {
                if (side === 'left') setLeft(emptySide)
                else setRight(emptySide)
                setOutput(null)
              }}
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-4 rounded-[20px] border-2 border-dashed border-tb-line px-4 py-3 text-left transition enabled:hover:border-[#0071e3]/50 disabled:opacity-60"
            disabled={busy}
            onClick={() => input.current?.click()}
          >
            <span
              className="grid size-9 shrink-0 place-items-center rounded-full bg-[#0071e3] text-white"
              aria-hidden="true"
            >
              <FileUp size={16} strokeWidth={1.75} />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold text-[14px] [overflow-wrap:anywhere]">
                选择{label}
              </span>
              <span className="mt-1 block text-[13px] text-tb-mute [overflow-wrap:anywhere]">
                CSV / XLSX
              </span>
            </span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          tabIndex={-1}
          accept=".csv,.xlsx"
          className="sr-only"
          disabled={busy}
          aria-label={`选择${label}文件`}
          onChange={(event) => {
            void loadFile(side, event.target.files?.[0])
            event.target.value = ''
          }}
        />
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
        {state.notices.map((notice, index) => (
          <p className="encoding-note" key={index}>
            {notice}
          </p>
        ))}
        {state.error && (
          <p className="compare-error" role="alert">
            {state.error}
          </p>
        )}
      </div>
    )
  }

  const resultCards = validReport
    ? ([
        {
          key: 'added',
          label: '新增',
          count: validReport.added.length,
        },
        {
          key: 'removed',
          label: '删除',
          count: validReport.removed.length,
        },
        {
          key: 'changed',
          label: '修改',
          count: validReport.changed.length,
        },
        {
          key: 'unchanged',
          label: '未变',
          count: validReport.unchanged,
        },
      ] as const)
    : []

  return (
    <main className="main-content compare-tool">
      <p className="sr-only" role="status" aria-atomic="true">
        {busy
          ? '正在读取或导出表格，请稍候。'
          : validReport
            ? `表格对比：新增 ${validReport.added.length} 行，删除 ${validReport.removed.length} 行，修改 ${validReport.changed.length} 行。`
            : ''}
      </p>
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
      <ToolHead
        toolId="table"
        title="表格对比"
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
            导入旧表与新表（CSV 或
            .xlsx），选择主键列后按主键匹配记录：列出新增、删除与修改（逐列前后对照）。
            重复主键按首次出现参与匹配并显式提示，主键为空的行不参与匹配；不自动猜测主键。 CSV 单个
            2 MB、XLSX 单个 10 MB、单表最多 10 万行/100 万格；按显示值比较，不比较公式或样式。
          </p>
        </div>
      </div>
      <div className="tool-body">
        <div className="tool-main">
          <TbCard
            title="导入两张表"
            aria-label="导入两张表"
            extra={
              !left.file && !right.file ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void loadSamples()}
                >
                  载入示例
                </Button>
              ) : undefined
            }
          >
            <div className="compare-grid grid mt-0! gap-4! sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]!">
              {sidePanel('left', left)}
              <button
                type="button"
                className="grid size-9 shrink-0 place-items-center justify-self-center rounded-full bg-tb-chip text-tb-mute enabled:hover:text-tb-fg disabled:opacity-30 sm:mt-7"
                aria-label="交换旧表与新表"
                disabled={busy || (!left.file && !right.file)}
                onClick={() => {
                  setLeft(right)
                  setRight(left)
                  setOutput(null)
                }}
              >
                <ArrowRightLeft size={16} aria-hidden="true" />
              </button>
              {sidePanel('right', right)}
            </div>
          </TbCard>
          {reportError && (
            <p className="compare-error" role="alert">
              {reportError}
            </p>
          )}
          {validReport && (
            <TbCard aria-label="对比结果">
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {resultCards.map((card) => (
                  <button
                    key={card.key}
                    type="button"
                    className={`grid gap-1 rounded-[18px] p-4 text-left ring-1 transition ${filter === card.key ? 'ring-2' : 'ring-tb-line hover:ring-tb-mute'}`}
                    aria-pressed={filter === card.key}
                    style={
                      filter === card.key
                        ? { boxShadow: `0 0 0 2px ${catTone[card.key].ring}` }
                        : undefined
                    }
                    onClick={() => setFilter(card.key)}
                  >
                    <span className={`text-[12px] font-semibold ${catTone[card.key].label}`}>
                      {card.label}
                    </span>{' '}
                    <span className="text-[28px] leading-none font-semibold tabular-nums">
                      {card.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <button
                  type="button"
                  className="rounded-full border border-tb-line bg-tb-chip px-3 py-[5px] text-[13px] text-tb-fg hover:border-tb-mute aria-pressed:border-transparent aria-pressed:shadow-[0_0_0_1.5px_var(--tb-blue)]"
                  aria-pressed={filter === 'all'}
                  onClick={() => setFilter('all')}
                >
                  全部差异
                </button>
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
              {diffCount === 0 && filter !== 'unchanged' && (
                <p className="compare-same mt-4!">两表按当前设置没有差异。</p>
              )}
              {(
                [
                  {
                    type: 'added',
                    title: `新增记录（${validReport.added.length}）`,
                    rows: validReport.added,
                    matrix: right.matrix!,
                  },
                  {
                    type: 'removed',
                    title: `删除记录（${validReport.removed.length}）`,
                    rows: validReport.removed,
                    matrix: left.matrix!,
                  },
                  {
                    type: 'unchanged',
                    title: `未变记录（${validReport.unchanged}）`,
                    rows: validReport.unchangedRows,
                    matrix: left.matrix!,
                  },
                ] as const
              )
                .filter((block) =>
                  filter === 'all' ? block.type !== 'unchanged' : block.type === filter,
                )
                .map((block) =>
                  block.rows.length ? (
                    <div key={block.type} className="compare-block mt-4">
                      <h3>{block.title}</h3>
                      <div className="table-preview-scroll">
                        <table className="table-preview" aria-label={block.title}>
                          <thead>
                            <tr>
                              {block.matrix.headers.map((header) => (
                                <th key={header}>{header}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.slice(0, previewLimit).map((entry) => (
                              <tr key={entry.key}>
                                {block.matrix.headers.map((header, index) => (
                                  <td key={header}>
                                    {keyColumns.includes(header) ? (
                                      <span className="compare-key">
                                        {clip(entry.row[index] ?? '')}
                                      </span>
                                    ) : (
                                      clip(entry.row[index] ?? '')
                                    )}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {block.rows.length > previewLimit && (
                        <p className="compare-more mt-2">
                          …共 {block.rows.length} 条，导出查看全部
                        </p>
                      )}
                    </div>
                  ) : null,
                )}
              {(filter === 'all' || filter === 'changed') && !!validReport.changed.length && (
                <div className="compare-block mt-4">
                  <h3>修改记录（{validReport.changed.length}）</h3>
                  <ul className="compare-changes">
                    {validReport.changed.slice(0, previewLimit).map((entry) => (
                      <li key={entry.key}>
                        <span className="compare-key">{clip(entry.key)}</span>
                        {entry.cells.map((cell) => (
                          <span className="compare-change" key={cell.column}>
                            <b>{cell.column}</b>
                            <del>{clip(cell.left) || '（空）'}</del>→
                            <ins>{clip(cell.right) || '（空）'}</ins>
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                  {validReport.changed.length > previewLimit && (
                    <p className="compare-more mt-2">
                      …共 {validReport.changed.length} 条，导出查看全部
                    </p>
                  )}
                </div>
              )}
              {filter !== 'all' &&
                ((filter === 'added' && !validReport.added.length) ||
                  (filter === 'removed' && !validReport.removed.length) ||
                  (filter === 'changed' && !validReport.changed.length) ||
                  (filter === 'unchanged' && !validReport.unchanged)) && (
                  <p className="compare-same mt-4!">当前类型没有记录。</p>
                )}
              <p className="compare-more mt-2.5">
                每类预览前 50 行，长单元格显示前 160 字；导出包含全部差异，筛选不影响下载。XLSX
                用红色标出删除/旧值，绿色标出新增/新值。
              </p>
            </TbCard>
          )}
        </div>
        <aside className="tool-aside">
          <div className="tool-aside-card">
            <h2 className="tool-aside-title">比较设置</h2>
            <div className="grid gap-3">
              <label className="grid min-w-0 gap-1.5 text-[12px] font-semibold text-tb-mute">
                主键列
                <Select
                  value={effectiveKey}
                  disabled={!commons.length}
                  onValueChange={setKeyColumn}
                >
                  <SelectTrigger aria-label="主键列" className="font-normal">
                    <SelectValue placeholder="导入两张表后选择" />
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
              <p className="text-[12px] text-tb-mute">
                按主键匹配两张表的行；空主键跳过，重复主键按首次出现匹配。
              </p>
              <label className="flex cursor-pointer items-center justify-between gap-3 py-1 text-[14px] text-tb-fg">
                <span>使用组合主键</span>
                <Switch
                  aria-label="使用组合主键"
                  checked={compositeOn}
                  disabled={busy}
                  onCheckedChange={setCompositeOn}
                />
              </label>
              {compositeOn && (
                <div className="compare-columns">
                  <span>追加主键字段（任一字段为空的行不匹配）：</span>
                  {commons
                    .filter((column) => column !== effectiveKey)
                    .map((column) => (
                      <label key={column} className="compare-column-chip">
                        <input
                          type="checkbox"
                          aria-label={`主键字段 ${column}`}
                          checked={extraKeys.includes(column)}
                          disabled={busy}
                          onChange={() =>
                            setExtraKeys((previous) =>
                              previous.includes(column)
                                ? previous.filter((key) => key !== column)
                                : [...previous, column],
                            )
                          }
                        />
                        {column}
                      </label>
                    ))}
                </div>
              )}
              <details className="tool-advanced">
                <summary>比较范围与空格规则</summary>
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
                      .filter((column) => !keyColumns.includes(column))
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
              </details>
            </div>
          </div>
        </aside>
      </div>
      <div className="workbench-actions">
        <div className="workbench-status">
          {validReport ? (
            <span>
              新增 <b>{validReport.added.length}</b> · 删除 <b>{validReport.removed.length}</b> ·
              修改 <b>{validReport.changed.length}</b> · 未变 <b>{validReport.unchanged}</b>
            </span>
          ) : (
            <span>导入旧表与新表开始比较</span>
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
        </div>
      </div>
    </main>
  )
}
