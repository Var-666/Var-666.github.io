import { ConversionOptions } from './file-tool/ConversionOptions'
import { useFileOptions } from './file-tool/options'
import { OutputActions } from './components/OutputActions'
import { useToolTransfer, useTransferReceiver, type ToolTransfer } from './lib/tool-transfer'
import { ConfirmImport } from './components/ConfirmImport'
import { ContinueWith } from './components/ContinueWith'
import { readTextFile, encodingNotices, type TextEncoding } from './lib/text-encoding'
import { TextEncodingSelect } from './components/TextEncodingSelect'
import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, FileUp, Image, LoaderCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { validateQueueFiles } from './lib/file-queue'
import { convertFileText, markdownTables, type TextConversion } from './lib/file-text'
import {
  convertImage,
  outputName,
  pdfToWord,
  wordToPdf,
  type OutputFile,
  type PdfToWordResult,
  type WordToPdfResult,
} from './lib/file-convert'
import {
  pdfToWordReport,
  previewFailureIssue,
  verifyDocxBlob,
  verifyPdfBlob,
  wordToPdfReport,
  type ConvertReport,
} from './lib/convert-report'
import {
  csvFileToExcel,
  loadWorkbook,
  parseCsvMatrix,
  sheetToCsv,
  sheetToJson,
  sheetToMarkdown,
  type WorkbookData,
} from './lib/file-excel'

import { imagesToPdf, packOutputs, pdfToImages } from './lib/file-media'
import { compressImageFile } from './lib/image-compress'
import { Textarea } from '@/components/ui/textarea'
import { categories, modeKeys, modes, type Mode } from './file-tool/modes'
import { sizeLabel, type Row } from './file-tool/types'

import { FileQueue } from './file-tool/FileQueue'
import { CsvExcelPreview, ExcelPreview } from './file-tool/ExcelPreview'

// 首页任务入口通过 #/files?mode=xxx 直达具体转换方式；非法值回退默认图片互转
const modeFromHash = (): Mode | null => {
  const param = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('mode')
  return param && modeKeys.includes(param as Mode) ? (param as Mode) : null
}

export default function FileTool({ active = true }: { active?: boolean }) {
  const transfers = useToolTransfer()
  const [incomingTransfer, setIncomingTransfer] = useState<ToolTransfer | null>(null)
  useEffect(() => {
    if (!active) setIncomingTransfer(null)
  }, [active])
  const [mode, setMode] = useState<Mode>(() => modeFromHash() ?? 'image')
  const isExcelRead = mode === 'excel-csv' || mode === 'excel-json' || mode === 'excel-md'
  const [excel, setExcel] = useState<{ file: File; workbook: WorkbookData } | null>(null)
  const [sheetName, setSheetName] = useState('')
  const [csvPreview, setCsvPreview] = useState<{
    file: File
    rows: string[][]
    notices: string[]
  } | null>(null)
  const [fileOptions, setFileOptions] = useFileOptions()
  const {
    format,
    imageSize,
    quality,
    compressTarget,
    compressFormat,
    pdfFormat,
    pdfLayout,
    mergeSize,
    mergeOrientation,
    mergeFit,
    pages,
    detectNumbers,
  } = fileOptions
  const [readEncoding, setReadEncoding] = useState<TextEncoding>('auto')
  const [tablePaste, setTablePaste] = useState('')
  const [merged, setMerged] = useState<(OutputFile & { url: string }) | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [packing, setPacking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    const current = urls.current
    return () => {
      mounted.current = false
      for (const url of current) URL.revokeObjectURL(url)
      current.clear()
    }
  }, [])
  const reset = () => {
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current.clear()
    setRows([])
    setMerged(null)
    setTablePaste('')
    setExcel(null)
    setSheetName('')
    setCsvPreview(null)
  }
  const chooseMode = (next: Mode) => {
    if (next !== mode && !running.current && !packing) {
      reset()
      setMode(next)
      window.history.replaceState(null, '', `#/files?mode=${next}`)
    }
  }
  const clearOutputs = () => {
    setMerged(null)
    for (const url of urls.current) URL.revokeObjectURL(url)
    urls.current.clear()
    setRows((previous) =>
      previous.map((row) => ({ id: row.id, file: row.file, status: 'waiting' })),
    )
  }
  const markPreviewError = (id: string) => {
    setRows((previous) =>
      previous.map((row) =>
        row.id === id && row.report && row.report.status !== 'preview-error'
          ? {
              ...row,
              report: {
                status: 'preview-error',
                issues: [...row.report.issues, previewFailureIssue],
                metrics: row.report.metrics,
              },
            }
          : row,
      ),
    )
  }
  const toggleDetail = (id: string) =>
    setRows((previous) =>
      previous.map((item) => (item.id === id ? { ...item, showDetail: !item.showDetail } : item)),
    )
  const removeRow = (row: Row) => {
    if (running.current || packing) return
    if (row.output) {
      URL.revokeObjectURL(row.output.url)
      urls.current.delete(row.output.url)
    }
    if (mode === 'image-pdf' || isExcelRead) clearOutputs()
    setRows((previous) => previous.filter((item) => item.id !== row.id))
  }
  const addFiles = (files: File[]) => {
    if (running.current || packing || !files.length) return
    if (isExcelRead && rows.length + files.length > 1) {
      toast.error('一次转换一个工作簿，请先移除当前文件')
      return
    }
    const limit = modes[mode].category === 'image' ? 20 : modes[mode].category === 'office' ? 10 : 2
    try {
      validateQueueFiles(
        rows.map((row) => row.file),
        files,
        modes[mode].accept,
        limit,
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法添加')
      return
    }
    if (mode === 'image-pdf') clearOutputs()
    setRows((previous) => [
      ...previous,
      ...files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting' as const })),
    ])
  }
  const applyTransfer = (request: ToolTransfer) => {
    const next = request.mode ?? mode,
      files = request.files ?? []
    if (next === mode) {
      addFiles(files)
      return
    }
    try {
      const limit =
        modes[next].category === 'image' ? 20 : modes[next].category === 'office' ? 10 : 2
      validateQueueFiles([], files, modes[next].accept, limit)
      if (next.startsWith('excel-') && files.length > 1) throw new Error('一次转换一个工作簿。')
      reset()
      setMode(next)
      setRows(files.map((file) => ({ id: crypto.randomUUID(), file, status: 'waiting' })))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件无法导入')
    }
  }
  useTransferReceiver('files', active && !busy && !packing && !incomingTransfer, (request) => {
    if (request.mode && request.mode !== mode && rows.length) setIncomingTransfer(request)
    else applyTransfer(request)
  })
  useEffect(() => {
    const changed = () => {
      if (
        !active ||
        !/^#\/?files(?:\?|$)/.test(window.location.hash) ||
        transfers?.pending?.target === 'files' ||
        incomingTransfer
      )
        return
      const next = modeFromHash()
      if (!next || next === mode) return
      if (running.current || packing) {
        toast.info('正在处理，请完成后再切换转换方式')
        window.history.replaceState(null, '', `#/files?mode=${mode}`)
        return
      }
      const request: ToolTransfer = {
        id: crypto.randomUUID(),
        target: 'files',
        mode: next,
        files: [],
      }
      if (rows.length) setIncomingTransfer(request)
      else applyTransfer(request)
    }
    changed()
    window.addEventListener('hashchange', changed)
    return () => window.removeEventListener('hashchange', changed)
    // Re-check URL intent on route/readiness changes, not on unrelated queue previews.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, mode, rows.length, busy, packing, transfers?.pending?.id, incomingTransfer])
  useEffect(() => {
    if (!active || (mode !== 'image' && mode !== 'image-pdf' && mode !== 'image-compress')) return
    const pasted = (event: ClipboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable || event.target.closest('input,textarea'))
      )
        return
      const images = Array.from(event.clipboardData?.items || [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => !!file)
      if (!images.length) return
      event.preventDefault()
      addFiles(
        images.map(
          (file, index) =>
            new File(
              [file],
              `截图-${Date.now()}-${index + 1}.${file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/webp' ? 'webp' : 'png'}`,
              { type: file.type },
            ),
        ),
      )
    }
    window.addEventListener('paste', pasted)
    return () => window.removeEventListener('paste', pasted)
  })
  // Excel 读取模式：工作簿只解析一次，结果缓存；失败时保留文件并显示原因
  useEffect(() => {
    if (!isExcelRead) return
    const row = rows[0]
    if (rows.length !== 1 || !row || row.status === 'error') {
      setExcel(null)
      setSheetName('')
      return
    }
    if (excel?.file === row.file) return
    let cancelled = false
    setExcel(null)
    setSheetName('')
    loadWorkbook(row.file)
      .then((workbook) => {
        if (cancelled) return
        setExcel({ file: row.file, workbook })
        setSheetName(workbook.sheets[0]?.name ?? '')
      })
      .catch((error) => {
        if (cancelled) return
        setRows((previous) =>
          previous.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: 'error',
                  message: error instanceof Error ? error.message : '无法读取工作簿',
                }
              : item,
          ),
        )
      })
    return () => {
      cancelled = true
    }
  }, [rows, mode, excel, isExcelRead])
  // CSV → Excel：解析第一个文件用于预览（数字识别在渲染时应用）
  useEffect(() => {
    if (mode !== 'csv-excel') return
    const row = rows[0]
    if (!row || row.status === 'error') {
      setCsvPreview(null)
      return
    }
    if (csvPreview?.file === row.file) return
    let cancelled = false
    ;(async () => {
      try {
        const decoded = await readTextFile(row.file, readEncoding)
        const parsed = parseCsvMatrix(decoded.text)
        if (!cancelled)
          setCsvPreview({
            file: row.file,
            rows: parsed.rows,
            notices: [...encodingNotices(decoded.encoding), ...parsed.notices],
          })
      } catch (error) {
        if (cancelled) return
        setCsvPreview(null)
        setRows((previous) =>
          previous.map((item) =>
            item.id === row.id
              ? {
                  ...item,
                  status: 'error',
                  message: error instanceof Error ? error.message : '读取失败，请检查文件与编码。',
                }
              : item,
          ),
        )
      }
    })()
    return () => {
      cancelled = true
    }
  }, [rows, mode, csvPreview, readEncoding])
  const moveRow = (id: string, to: number) => {
    if (running.current || packing || to < 0 || to >= rows.length) return
    clearOutputs()
    setRows((previous) => {
      const next = [...previous]
      const from = next.findIndex((row) => row.id === id)
      if (from < 0) return previous
      next.splice(to, 0, next.splice(from, 1)[0])
      return next
    })
  }
  const run = async () => {
    if (running.current || !rows.length) return
    running.current = true
    setBusy(true)
    let bytes = 0
    try {
      if (mode === 'image-pdf') {
        setRows((previous) =>
          previous.map((row) => ({ ...row, status: 'working', message: '正在合并' })),
        )
        try {
          const output = await imagesToPdf(
            rows.map((row) => row.file),
            (message) => {
              if (mounted.current)
                setRows((previous) => previous.map((row) => ({ ...row, message })))
            },
            { size: mergeSize, orientation: mergeOrientation, fit: mergeFit },
          )
          if (output.blob.size > 100 * 1024 * 1024)
            throw new Error('输出超过 100 MB，请减少图片数量。')
          if (!mounted.current) return
          const url = URL.createObjectURL(output.blob)
          urls.current.add(url)
          setMerged({ ...output, url })
          setRows((previous) =>
            previous.map((row) => ({ ...row, status: 'done', message: '已合并' })),
          )
        } catch (error) {
          if (mounted.current)
            setRows((previous) =>
              previous.map((row) => ({
                ...row,
                status: 'error',
                message: error instanceof Error ? error.message : '合并失败，请检查图片。',
              })),
            )
        }
        return
      }
      for (const row of rows) {
        if (!mounted.current) break
        if (row.output) {
          bytes += row.output.blob.size
          continue
        }
        const update = (patch: Partial<Row>) => {
          if (mounted.current)
            setRows((previous) =>
              previous.map((item) => (item.id === row.id ? { ...item, ...patch } : item)),
            )
        }
        update({ status: 'working', message: '正在转换' })
        try {
          const progress = (message: string) => update({ message })
          let output: OutputFile
          let rowNotices: string[] | undefined
          if (mode === 'image')
            output = await convertImage(row.file, format, quality / 100, imageSize)
          else if (mode === 'image-compress') {
            const compressed = await compressImageFile(row.file, {
              targetBytes: Number(compressTarget) * 1024,
              format: compressFormat,
              size: imageSize,
            })
            output = compressed
            rowNotices = [
              `${sizeLabel(compressed.originalBytes)} → ${sizeLabel(compressed.blob.size)} · ${compressed.width}×${compressed.height} · 质量 ${Math.round(compressed.quality * 100)}%` +
                (compressed.metTarget
                  ? ''
                  : `；未能压到 ${compressTarget} KB，以上为可达成的最小结果`),
            ]
          } else if (mode === 'pdf-image')
            output = await pdfToImages(
              row.file,
              { pages, format: pdfFormat, layout: pdfLayout },
              progress,
            )
          else if (mode === 'pdf-word') output = await pdfToWord(row.file, progress)
          else if (mode === 'word-pdf') output = await wordToPdf(row.file, progress)
          else if (isExcelRead) {
            if (!excel) throw new Error('工作簿尚未读取完成，请稍候再试。')
            const sheet = excel.workbook.sheet(sheetName)
            const base = `${excel.file.name.replace(/\.[^.]+$/, '')}-${sheet.name.replace(/[/\\?%*:|"<>]/g, ' ')}`
            if (mode === 'excel-csv')
              output = {
                blob: new Blob(['\uFEFF', sheetToCsv(sheet)], { type: 'text/csv;charset=utf-8' }),
                name: outputName(base, 'csv'),
              }
            else if (mode === 'excel-json')
              output = {
                blob: new Blob([sheetToJson(sheet).text], {
                  type: 'application/json;charset=utf-8',
                }),
                name: outputName(base, 'json'),
              }
            else
              output = {
                blob: new Blob([sheetToMarkdown(sheet)], { type: 'text/markdown;charset=utf-8' }),
                name: outputName(base, 'md'),
              }
          } else if (mode === 'csv-excel') {
            const converted = await csvFileToExcel(row.file, {
              detectNumbers,
              encoding: readEncoding,
            })
            output = converted
            rowNotices = encodingNotices(converted.encoding)
          } else {
            const decoded = await readTextFile(row.file, readEncoding)
            const source = decoded.text
            rowNotices = encodingNotices(decoded.encoding)
            if (mode === 'markdown-csv') {
              const outputs = markdownTables(source).map((text, index) => ({
                name: outputName(row.file.name, `table-${index + 1}.csv`),
                blob: new Blob(['\uFEFF', text], { type: 'text/csv;charset=utf-8' }),
              }))
              output =
                outputs.length === 1
                  ? outputs[0]
                  : await packOutputs(outputs, outputName(row.file.name, 'tables.zip'))
            } else {
              const converted = convertFileText(
                source,
                mode as TextConversion,
                row.file.name.toLowerCase().endsWith('.tsv') ? '\t' : ',',
                /\.(jsonl|ndjson)$/i.test(row.file.name),
              )
              const extension =
                mode === 'markdown'
                  ? 'txt'
                  : mode === 'csv-json'
                    ? 'json'
                    : mode === 'csv-markdown'
                      ? 'md'
                      : 'csv'
              output = {
                name: outputName(row.file.name, extension),
                blob: new Blob(
                  [extension === 'json' || extension === 'md' ? '' : '\uFEFF', converted.text],
                  {
                    type: `${extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv' : extension === 'md' ? 'text/markdown' : 'text/plain'};charset=utf-8`,
                  },
                ),
              }
              rowNotices = [...rowNotices, ...converted.notices]
            }
          }
          if (bytes + output.blob.size > 100 * 1024 * 1024)
            throw new Error('输出总大小超过 100 MB，请减少文件数量。')
          bytes += output.blob.size
          if (!mounted.current) break
          let report: ConvertReport | undefined
          let detail: Row['detail']
          if (mode === 'word-pdf' && 'pages' in output) {
            progress('正在校验输出')
            const result = output as WordToPdfResult
            report = wordToPdfReport({
              pages: result.pages,
              sections: result.sections,
              failedSections: result.failedSections,
              bytes: result.blob.size,
              verify: await verifyPdfBlob(result.blob),
            })
            detail = {
              kind: 'pdf',
              file: new File([result.blob], result.name, { type: 'application/pdf' }),
            }
          } else if (mode === 'pdf-word' && 'chars' in output) {
            progress('正在校验输出')
            const result = output as PdfToWordResult
            report = pdfToWordReport({
              pages: result.pages,
              chars: result.chars,
              paragraphs: result.paragraphs,
              bytes: result.blob.size,
              docxValid: await verifyDocxBlob(result.blob),
            })
            detail = { kind: 'text', text: result.text }
          }
          const url = URL.createObjectURL(output.blob)
          urls.current.add(url)
          update({
            status: 'done',
            message: undefined,
            output: { ...output, url },
            report,
            detail,
            notices: rowNotices,
          })
        } catch (error) {
          update({
            status: 'error',
            message:
              error instanceof TypeError
                ? '读取失败，请检查文件是否损坏或切换读取编码。'
                : error instanceof Error
                  ? error.message
                  : '转换失败，请检查文件格式。',
          })
        }
      }
    } finally {
      running.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const zip = async () => {
    setPacking(true)
    try {
      const output = await packOutputs(
        rows.flatMap((row, i) =>
          row.output ? [{ ...row.output, name: `${i + 1}-${row.output.name}` }] : [],
        ),
        '转换结果.zip',
      )
      const url = URL.createObjectURL(output.blob)
      urls.current.add(url)
      const link = document.createElement('a')
      link.href = url
      link.download = '转换结果.zip'
      link.click()
      setTimeout(() => {
        URL.revokeObjectURL(url)
        urls.current.delete(url)
      }, 1000)
    } catch {
      toast.error('打包失败，请逐个下载文件。')
    } finally {
      setPacking(false)
    }
  }
  const excelPending = isExcelRead && !!rows.length && !excel
  const optionControls = (
    <ConversionOptions
      mode={mode}
      options={fileOptions}
      disabled={busy || packing}
      onChange={(patch) => {
        clearOutputs()
        setFileOptions((previous) => ({ ...previous, ...patch }))
      }}
    />
  )
  const done = rows.filter((row) => row.status === 'done').length
  return (
    <main className="main-content file-tool">
      <ConfirmImport
        open={active && !!incomingTransfer}
        description="切换转换方式会替换当前文件队列和未下载结果。"
        onCancel={() => {
          setIncomingTransfer(null)
          window.location.hash = `#/files?mode=${mode}`
        }}
        onAccept={() => {
          if (incomingTransfer) applyTransfer(incomingTransfer)
          setIncomingTransfer(null)
        }}
      />
      <section className="intro">
        <h1>文件格式转换</h1>
      </section>
      <Tabs
        value={modes[mode].category}
        onValueChange={(value) => {
          const first = modeKeys.find((key) => modes[key].category === value)
          if (first) chooseMode(first)
        }}
        className="conversion-groups"
      >
        <TabsList className="conversion-categories" aria-label="文件类别">
          {categories.map(({ id, title, icon: Icon }) => (
            <TabsTrigger key={id} value={id} disabled={busy || packing}>
              <Icon size={15} />
              {title}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={modes[mode].category} className="conversion-content">
          <div
            className="conversion-modes"
            role="group"
            aria-label={`${categories.find((category) => category.id === modes[mode].category)?.title}转换方式`}
          >
            {modeKeys
              .filter((key) => modes[key].category === modes[mode].category)
              .map((key) => (
                <button
                  key={key}
                  disabled={busy || packing}
                  aria-pressed={mode === key}
                  onClick={() => chooseMode(key)}
                >
                  {modes[key].title}
                </button>
              ))}
          </div>
          <section className="conversion-panel" aria-label={modes[mode].title}>
            <div className="conversion-toolbar">
              <div>
                <strong>{modes[mode].title}</strong>
                <span>
                  {mode === 'image-pdf'
                    ? '按队列顺序合并'
                    : modes[mode].category === 'image'
                      ? '支持直接粘贴截图'
                      : '支持多文件依次转换'}
                </span>
              </div>
              {mode === 'image' && optionControls}
            </div>
            {mode !== 'image' && optionControls}
            {!isExcelRead &&
              (modes[mode].category === 'text' || modes[mode].category === 'table') && (
                <TextEncodingSelect
                  value={readEncoding}
                  disabled={busy || packing}
                  onChange={(value) => {
                    clearOutputs()
                    setCsvPreview(null)
                    setReadEncoding(value)
                  }}
                />
              )}
            <button
              type="button"
              className={`file-drop ${dragging ? 'is-dragging' : ''}`}
              disabled={busy || packing}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setDragging(true)
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                if (!packing) addFiles(Array.from(event.dataTransfer.files))
              }}
            >
              <span className="file-drop-icon">
                {mode === 'image' ? <Image size={25} /> : <FileUp size={25} />}
              </span>
              <strong>
                {rows.length ? '继续添加文件，或拖到这里' : '点击选择文件，或拖到这里'}
              </strong>
              <span>{modes[mode].hint}</span>
            </button>
            <input
              ref={input}
              type="file"
              multiple
              accept={modes[mode].accept}
              className="sr-only"
              aria-label="选择待转换文件"
              onChange={(event) => {
                addFiles(Array.from(event.target.files || []))
                event.target.value = ''
              }}
            />
            {mode === 'csv-markdown' && (
              <div className="table-paste">
                <Textarea
                  aria-label="粘贴表格内容"
                  placeholder="在此粘贴从 Excel 复制的表格（首行作为表头）"
                  value={tablePaste}
                  disabled={busy || packing}
                  onChange={(event) => setTablePaste(event.target.value)}
                />
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!tablePaste.trim() || busy || packing}
                  onClick={() => {
                    addFiles([
                      new File([tablePaste], `粘贴表格-${Date.now()}.tsv`, {
                        type: 'text/tab-separated-values',
                      }),
                    ])
                  }}
                >
                  加入队列
                </Button>
              </div>
            )}
            <p className="conversion-note">{modes[mode].note}</p>
            {!!rows.length && (
              <FileQueue
                rows={rows}
                mode={mode}
                busy={busy}
                packing={packing}
                onMove={moveRow}
                onRemove={removeRow}
                onToggleDetail={toggleDetail}
                onMarkPreviewError={markPreviewError}
              />
            )}
            {mode === 'csv-excel' && csvPreview && (
              <CsvExcelPreview
                file={csvPreview.file}
                rows={csvPreview.rows}
                notices={csvPreview.notices}
                detectNumbers={detectNumbers}
              />
            )}
            {isExcelRead && excel && (
              <ExcelPreview
                excel={excel}
                sheetName={sheetName}
                onSheetChange={(value) => {
                  clearOutputs()
                  setSheetName(value)
                }}
                mode={mode}
                disabled={busy || packing}
              />
            )}
            {merged && (
              <div className="merged-result">
                <span>
                  <Check size={16} />
                  {merged.name} · {sizeLabel(merged.blob.size)}
                </span>
                <Button size="sm" variant="outline" asChild>
                  <a href={merged.url} download={merged.name}>
                    <ArrowDownToLine size={14} />
                    下载 PDF
                  </a>
                </Button>
                <ContinueWith outputs={[merged]} disabled={busy || packing} />
                <OutputActions outputs={[merged]} disabled={busy || packing} />
              </div>
            )}
            <div className="conversion-actions">
              <Button variant="ghost" disabled={!rows.length || busy || packing} onClick={reset}>
                <Trash2 size={14} />
                清空
              </Button>
              <div>
                {done > 1 && mode !== 'image-pdf' && (
                  <OutputActions
                    outputs={rows.flatMap((row) => (row.output ? [row.output] : []))}
                    disabled={busy || packing}
                  />
                )}
                {done > 1 && mode !== 'image-pdf' && (
                  <ContinueWith
                    outputs={rows.flatMap((row) => (row.output ? [row.output] : []))}
                    disabled={busy || packing}
                  />
                )}
                {done > 1 && mode !== 'image-pdf' && (
                  <Button variant="outline" disabled={busy || packing} onClick={zip}>
                    {packing ? (
                      <LoaderCircle className="animate-spin" size={14} />
                    ) : (
                      <ArrowDownToLine size={14} />
                    )}
                    打包下载 ({done})
                  </Button>
                )}
                <Button
                  disabled={!rows.length || busy || packing || done === rows.length || excelPending}
                  onClick={run}
                >
                  {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}
                  {busy ? '正在转换' : mode === 'image-pdf' ? '合并 PDF' : '开始转换'}
                </Button>
              </div>
            </div>
          </section>
        </TabsContent>
      </Tabs>
    </main>
  )
}
