import { useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, Check, FileUp, Image, LoaderCircle, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { convertFileText, type TextConversion } from './lib/file-text'
import { convertImage, outputName, pdfToWord, wordToPdf, type OutputFile } from './lib/file-convert'

const modes = {
  image: { title: '图片互转', accept: '.png,.jpg,.jpeg,.webp', hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素', note: 'JPG 透明区域填充白色；动画只转换第一帧，导出不保留原始元数据。' },
  markdown: { title: 'Markdown → TXT', accept: '.md,.markdown', hint: 'Markdown 文件 · 单个 2 MB · UTF-8 编码', note: '去除格式标记，保留正文、代码和链接。' },
  'csv-json': { title: 'CSV → JSON', accept: '.csv', hint: '逗号分隔 CSV · 单个 2 MB · UTF-8 编码', note: '第一行作为列名，单元格保留为字符串，避免丢失编号中的前导零。' },
  'json-csv': { title: 'JSON → CSV', accept: '.json', hint: 'JSON 文件 · 单个 2 MB · UTF-8 编码', note: '支持对象数组，不含嵌套字段。疑似表格公式的文本会添加单引号保护。' },
  'word-pdf': { title: 'Word → PDF', accept: '.docx', hint: 'DOCX 文档 · 单个 10 MB · 最多输出 50 页', note: '导出图片版 A4 PDF，文字无法选中。复杂分页、字体和表格可能变化，建议核对结果；不支持旧版 .doc。' },
  'pdf-word': { title: 'PDF → Word', accept: '.pdf', hint: '文字型 PDF · 单个 10 MB · 最多 50 页', note: '提取文字生成可编辑 DOCX，不保留图片、表格和原排版。不支持扫描件或加密 PDF。' },
}
type Mode = keyof typeof modes
type Row = { id: string; file: File; status: 'waiting' | 'working' | 'done' | 'error'; message?: string; output?: OutputFile & { url: string } }
const sizeLabel = (size: number) => size < 1024 * 1024 ? `${Math.max(1, Math.round(size / 1024))} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`

export default function FileTool() {
  const [mode, setMode] = useState<Mode>('image')
  const [format, setFormat] = useState<'png' | 'jpeg' | 'webp'>('png')
  const [quality, setQuality] = useState(90)
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [packing, setPacking] = useState(false)
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const urls = useRef(new Set<string>())
  const running = useRef(false)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; const current = urls.current; return () => { mounted.current = false; for (const url of current) URL.revokeObjectURL(url); current.clear() } }, [])
  const reset = () => { for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); setRows([]) }
  const clearOutputs = () => { for (const url of urls.current) URL.revokeObjectURL(url); urls.current.clear(); setRows(previous => previous.map(row => ({ id: row.id, file: row.file, status: 'waiting' }))) }
  const addFiles = (files: File[]) => {
    if (running.current) return
    if (files.length > 10 || files.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024) { toast.error('一次最多选择 10 个文件，总大小不超过 50 MB'); return }
    const extensions = modes[mode].accept.split(',')
    const limit = mode === 'image' ? 20 : mode === 'pdf-word' || mode === 'word-pdf' ? 10 : 2
    if (files.some(file => !extensions.some(extension => file.name.toLowerCase().endsWith(extension)))) { toast.error(`请选择 ${modes[mode].accept} 文件`); return }
    if (files.some(file => !file.size || file.size > limit * 1024 * 1024)) { toast.error(`文件不能为空，且单个不超过 ${limit} MB`); return }
    if (!files.length) return
    reset(); setRows(files.map(file => ({ id: crypto.randomUUID(), file, status: 'waiting' })))
  }
  const run = async () => {
    if (running.current || !rows.length) return
    running.current = true; setBusy(true)
    let bytes = 0
    try {
      for (const row of rows) {
        if (!mounted.current) break
        if (row.output) { bytes += row.output.blob.size; continue }
        const update = (patch: Partial<Row>) => { if (mounted.current) setRows(previous => previous.map(item => item.id === row.id ? { ...item, ...patch } : item)) }
        update({ status: 'working', message: '正在转换' })
        try {
          const progress = (message: string) => update({ message })
          let output: OutputFile
          if (mode === 'image') output = await convertImage(row.file, format, quality / 100)
          else if (mode === 'pdf-word') output = await pdfToWord(row.file, progress)
          else if (mode === 'word-pdf') output = await wordToPdf(row.file, progress)
          else {
            const source = new TextDecoder('utf-8', { fatal: true }).decode(await row.file.arrayBuffer())
            const text = convertFileText(source, mode as TextConversion)
            const extension = mode === 'markdown' ? 'txt' : mode === 'csv-json' ? 'json' : 'csv'
            output = { name: outputName(row.file.name, extension), blob: new Blob([extension === 'json' ? '' : '\uFEFF', text], { type: `${extension === 'json' ? 'application/json' : extension === 'csv' ? 'text/csv' : 'text/plain'};charset=utf-8` }) }
          }
          bytes += output.blob.size
          if (bytes > 100 * 1024 * 1024) throw new Error('输出总大小超过 100 MB，请减少文件数量。')
          if (!mounted.current) break
          const url = URL.createObjectURL(output.blob); urls.current.add(url)
          update({ status: 'done', message: undefined, output: { ...output, url } })
        } catch (error) { update({ status: 'error', message: error instanceof TypeError ? '读取失败，请检查文件是否损坏；文本请使用 UTF-8 编码。' : error instanceof Error ? error.message : '转换失败，请检查文件格式。' }) }
      }
    } finally { running.current = false; if (mounted.current) setBusy(false) }
  }
  const zip = async () => {
    setPacking(true)
    try {
      const { zipSync } = await import('fflate')
      const files: Record<string, Uint8Array> = {}
      for (const [i, row] of rows.entries()) if (row.output) files[`${i + 1}-${row.output.name}`] = new Uint8Array(await row.output.blob.arrayBuffer())
      const data = zipSync(files, { level: 0 })
      const url = URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer>], { type: 'application/zip' })); urls.current.add(url)
      const link = document.createElement('a'); link.href = url; link.download = '转换结果.zip'; link.click()
      setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url) }, 1000)
    } catch { toast.error('打包失败，请逐个下载文件。') } finally { setPacking(false) }
  }
  const done = rows.filter(row => row.status === 'done').length
  return <main className="main-content file-tool"><section className="intro"><h1>文件格式转换</h1></section>
    <div className="conversion-modes" aria-label="转换类型">{Object.entries(modes).map(([key, value]) => <button key={key} disabled={busy || packing} aria-pressed={mode === key} onClick={() => { reset(); setMode(key as Mode) }}>{value.title}</button>)}</div>
    <section className="conversion-panel" aria-label={modes[mode].title}>
      <div className="conversion-toolbar"><div><strong>{modes[mode].title}</strong><span>{mode === 'image' ? '批量转换' : '支持多文件依次转换'}</span></div>{mode === 'image' && <div className="image-options"><label>输出格式<Select disabled={busy || packing} value={format} onValueChange={value => { clearOutputs(); setFormat(value as typeof format) }}><SelectTrigger aria-label="输出格式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="png">PNG</SelectItem><SelectItem value="jpeg">JPG</SelectItem><SelectItem value="webp">WebP</SelectItem></SelectContent></Select></label>{format !== 'png' && <label>质量 {quality}%<input type="range" aria-label="图片质量" min="10" max="100" disabled={busy || packing} value={quality} onChange={event => { clearOutputs(); setQuality(Number(event.target.value)) }} /></label>}</div>}</div>
      <button type="button" className={`file-drop ${dragging ? 'is-dragging' : ''}`} disabled={busy || packing} onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); if (!packing) addFiles(Array.from(event.dataTransfer.files)) }}><span className="file-drop-icon">{mode === 'image' ? <Image size={25} /> : <FileUp size={25} />}</span><strong>点击选择文件，或拖到这里</strong><span>{modes[mode].hint}</span></button>
      <input ref={input} type="file" multiple accept={modes[mode].accept} className="sr-only" aria-label="选择待转换文件" onChange={event => { addFiles(Array.from(event.target.files || [])); event.target.value = '' }} />
      <p className="conversion-note">{modes[mode].note}</p>
      {!!rows.length && <div className="file-queue">{rows.map(row => <div key={row.id} className="file-row"><div className={`file-state state-${row.status}`}>{row.status === 'working' ? <LoaderCircle className="animate-spin" size={18} /> : row.status === 'done' ? <Check size={18} /> : row.status === 'error' ? <X size={18} /> : <FileUp size={18} />}</div><div className="file-details"><strong>{row.file.name}</strong><span className={row.status === 'error' ? 'file-error' : ''} role={row.status === 'error' ? 'alert' : 'status'}>{row.message || (row.output ? `${row.output.name} · ${sizeLabel(row.output.blob.size)}` : sizeLabel(row.file.size))}</span></div>{row.output && <Button variant="outline" size="sm" asChild><a href={row.output.url} download={row.output.name}><ArrowDownToLine size={14} />下载</a></Button>}</div>)}</div>}
      <div className="conversion-actions"><Button variant="ghost" disabled={!rows.length || busy || packing} onClick={reset}><Trash2 size={14} />清空</Button><div>{done > 1 && <Button variant="outline" disabled={busy || packing} onClick={zip}>{packing ? <LoaderCircle className="animate-spin" size={14} /> : <ArrowDownToLine size={14} />}打包下载 ({done})</Button>}<Button disabled={!rows.length || busy || packing || done === rows.length} onClick={run}>{busy ? <LoaderCircle className="animate-spin" size={14} /> : <Check size={14} />}{busy ? '正在转换' : '开始转换'}</Button></div></div>
    </section>
  </main>
}
