import { useUnsavedWork } from '../DraftGuard'
import { RenameRules } from './components/RenameRules'
import { useRenamePreview } from './hooks/useRenamePreview'
import { readPhotoDate, sortRenameFiles, type RenameSort } from './rename-metadata'
import { OutputActions } from '../components/OutputActions'
import { useTransferReceiver } from '../tool-transfer'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ClipboardPaste,
  FileUp,
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
import {
  defaultRenameOptions,
  parseNameList,
  validateRenameFiles,
  type RenameOptions,
} from './rename'

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
      <ToolHead toolId="rename" />
      <section className="conversion-panel" aria-label="重命名文件">
        <button
          className={`file-drop ${files.length ? 'has-files' : ''} ${dragging ? 'is-dragging' : ''}`}
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
          <span className="file-drop-icon">
            <FileUp size={25} />
          </span>
          <strong>{files.length ? '继续添加文件，或拖到这里' : '选择文件，或拖到这里'}</strong>
          <span>任意格式</span>
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
        <details className="tool-advanced">
          <summary>使用说明与限制</summary>
          <p className="conversion-note">
            最多 100 个文件、总计 100
            MB，支持空文件。按列表顺序编号，仅导出副本，原文件不变。扩展名规则只改名称，不转换内容。
          </p>
        </details>
        <RenameRules options={options} update={update} busy={packing || readingDates}>
          <div className="name-import">
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
                setOverrides(Object.fromEntries(parsed.names.map((name, index) => [index, name])))
                toast.success(`已导入 ${parsed.names.length} 个目标名称，可在表格中继续逐项修改。`)
              }}
            >
              <ClipboardPaste size={14} />
              导入名称
            </Button>
          </div>
        </RenameRules>
        {!!files.length && (
          <div className="rename-sorting">
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
              <SelectTrigger aria-label="文件排序">
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
                    disabled={key.startsWith('shot') && !files.some((entry) => entry.shotAt)}
                  >
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                          item.id === entry.id ? { ...item, shotAt, shotError: undefined } : item,
                        ),
                      )
                    } catch (error) {
                      setFiles((previous) =>
                        previous.map((item) =>
                          item.id === entry.id
                            ? {
                                ...item,
                                shotError:
                                  error instanceof Error ? error.message : '拍摄时间读取失败。',
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
        )}
        {previewPending && <p role="status">正在预览正则规则…</p>}
        {previewState.error && (
          <p role="alert" className="file-error">
            {previewState.error}
          </p>
        )}

        {!!files.length && (
          <div className="rename-table-wrap">
            <table className="rename-table">
              <thead>
                <tr>
                  <th>顺序</th>
                  <th>原文件名</th>
                  <th>新文件名</th>
                  <th>
                    <span className="sr-only">移除</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {files.map((entry, index) => (
                  <tr key={entry.id}>
                    <td>
                      <div className="rename-order">
                        <span>{index + 1}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`上移 ${entry.file.name}`}
                          disabled={packing || readingDates || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`下移 ${entry.file.name}`}
                          disabled={packing || readingDates || index === files.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={13} />
                        </Button>
                      </div>
                    </td>
                    <td>
                      {entry.file.name}
                      {(entry.shotAt || entry.shotError) && (
                        <small className="rename-date-note">
                          {entry.shotAt ? `拍摄 ${entry.shotAt}` : entry.shotError}
                        </small>
                      )}
                    </td>
                    <td className={preview[index].error ? 'rename-error' : 'rename-new'}>
                      <div className="rename-name-cell">
                        <input
                          aria-label={`新文件名 ${entry.file.name}`}
                          aria-invalid={!!preview[index].error}
                          aria-describedby={
                            preview[index].error ? `rename-error-${entry.id}` : undefined
                          }
                          value={preview[index].name}
                          disabled={packing || readingDates}
                          onChange={(event) => {
                            invalidate()
                            setOverrides((previous) => ({
                              ...previous,
                              [index]: event.target.value,
                            }))
                          }}
                        />
                        {overrides[index] !== undefined && (
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`还原 ${entry.file.name} 的生成名`}
                            disabled={packing || readingDates}
                            onClick={() =>
                              setOverrides((previous) => {
                                const next = { ...previous }
                                delete next[index]
                                return next
                              })
                            }
                          >
                            <RotateCcw size={13} />
                          </Button>
                        )}
                      </div>
                      {preview[index].error && (
                        <small id={`rename-error-${entry.id}`}>{preview[index].error}</small>
                      )}
                    </td>
                    <td>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`移除 ${entry.file.name}`}
                        disabled={packing || readingDates}
                        onClick={() => {
                          if (running.current) return
                          invalidate()
                          setFiles((previous) => previous.filter((item) => item.id !== entry.id))
                        }}
                      >
                        <X size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {errors > 0 && (
          <p className="tool-error" role="alert">
            有 {errors} 个文件名需要调整，修正后即可打包。
          </p>
        )}
        <div className="conversion-actions">
          <Button
            variant="ghost"
            disabled={!files.length || packing || readingDates}
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
          <div>
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
      </section>
    </main>
  )
}
