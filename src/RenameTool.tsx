import { useEffect, useMemo, useRef, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { packOutputs } from './lib/file-media'
import {
  defaultRenameOptions,
  parseNameList,
  renamePreview,
  validateRenameFiles,
  type RenameOptions,
} from './lib/rename'

export default function RenameTool({ active = true }: { active?: boolean }) {
  const [files, setFiles] = useState<{ id: string; file: File }[]>([])
  const [options, setOptions] = useState(defaultRenameOptions)
  const [overrides, setOverrides] = useState<Record<number, string>>({})
  const [nameList, setNameList] = useState('')
  const [packing, setPacking] = useState(false)
  const [dragging, setDragging] = useState(false)
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
  const preview = useMemo(
    () =>
      renamePreview(
        files.map((entry) => entry.file.name),
        options,
        files.map((_, index) => overrides[index]),
      ),
    [files, options, overrides],
  )
  const errors = preview.filter((row) => row.error).length
  const addFiles = (incoming: File[]) => {
    if (running.current || !incoming.length) return
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
  const move = (index: number, offset: number) => {
    if (running.current || index + offset < 0 || index + offset >= files.length) return
    invalidate()
    setOverrides({})
    setFiles((previous) => {
      const next = [...previous]
      next.splice(index + offset, 0, next.splice(index, 1)[0])
      return next
    })
  }
  const pack = async () => {
    if (running.current || !files.length || errors) return
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
      <section className="intro">
        <h1>批量重命名</h1>
      </section>
      <section className="conversion-panel" aria-label="重命名文件">
        <button
          className={`file-drop ${files.length ? 'has-files' : ''} ${dragging ? 'is-dragging' : ''}`}
          disabled={packing}
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
          <span>任意格式 · 最多 100 个文件 · 总计 100 MB</span>
        </button>
        <input
          ref={input}
          type="file"
          multiple
          className="sr-only"
          aria-label="选择需要重命名的文件"
          disabled={packing}
          onChange={(event) => {
            addFiles(Array.from(event.target.files || []))
            event.target.value = ''
          }}
        />
        <fieldset className="rename-rules" disabled={packing}>
          <legend className="sr-only">重命名规则</legend>
          <label>
            统一名称
            <input
              className="tool-input"
              maxLength={255}
              value={options.base}
              placeholder="留空保留原名"
              onChange={(event) => update({ base: event.target.value })}
            />
          </label>
          <label>
            查找文字
            <input
              className="tool-input"
              maxLength={255}
              value={options.find}
              placeholder="按原样匹配"
              onChange={(event) => update({ find: event.target.value })}
            />
          </label>
          <label>
            替换为
            <input
              className="tool-input"
              maxLength={255}
              value={options.replace}
              placeholder="留空即删除"
              onChange={(event) => update({ replace: event.target.value })}
            />
          </label>
          <label>
            前缀
            <input
              className="tool-input"
              maxLength={255}
              value={options.prefix}
              onChange={(event) => update({ prefix: event.target.value })}
            />
          </label>
          <label>
            后缀
            <input
              className="tool-input"
              maxLength={255}
              value={options.suffix}
              onChange={(event) => update({ suffix: event.target.value })}
            />
          </label>
          <div className="rename-cleanup">
            <span>清理生成名称：</span>
            {(
              [
                ['specialChars', '特殊字符换成空格'],
                ['spaces', '折叠空格'],
                ['duplicateSeparators', '合并重复分隔符'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="rename-cleanup-item">
                <Switch
                  aria-label={label}
                  checked={options.cleanup[key]}
                  disabled={packing}
                  onCheckedChange={(value) =>
                    update({ cleanup: { ...options.cleanup, [key]: value } })
                  }
                />
                {label}
              </label>
            ))}
          </div>
          <div className="rename-numbering">
            <label htmlFor="rename-numbering">
              添加编号
              <Switch
                id="rename-numbering"
                checked={options.numbered}
                disabled={packing}
                onCheckedChange={(value) => update({ numbered: value })}
              />
            </label>
            {options.numbered && (
              <div>
                <label>
                  起始编号
                  <input
                    className="tool-input"
                    type="number"
                    min="0"
                    max="1000000"
                    value={options.start}
                    onChange={(event) => update({ start: Number(event.target.value) })}
                  />
                </label>
                <label>
                  编号位数
                  <Select
                    value={String(options.digits)}
                    disabled={packing}
                    onValueChange={(value) => update({ digits: Number(value) })}
                  >
                    <SelectTrigger aria-label="编号位数">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {String(1).padStart(value, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>
            )}
          </div>
        </fieldset>
        <div className="name-import">
          <Textarea
            aria-label="粘贴目标名称列表"
            placeholder="从文本列表导入：每行一个目标文件名（含扩展名），数量需与文件数一致"
            value={nameList}
            disabled={packing || !files.length}
            onChange={(event) => setNameList(event.target.value)}
          />
          <Button
            size="sm"
            variant="outline"
            disabled={packing || !files.length || !nameList.trim()}
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
        <p className="conversion-note">保留原扩展名，按列表顺序编号。仅导出副本，原文件不变。</p>
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
                          disabled={packing || index === 0}
                          onClick={() => move(index, -1)}
                        >
                          <ArrowUp size={13} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`下移 ${entry.file.name}`}
                          disabled={packing || index === files.length - 1}
                          onClick={() => move(index, 1)}
                        >
                          <ArrowDown size={13} />
                        </Button>
                      </div>
                    </td>
                    <td>{entry.file.name}</td>
                    <td className={preview[index].error ? 'rename-error' : 'rename-new'}>
                      <div className="rename-name-cell">
                        <input
                          aria-label={`新文件名 ${entry.file.name}`}
                          value={preview[index].name}
                          disabled={packing}
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
                            disabled={packing}
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
                      {preview[index].error && <small>{preview[index].error}</small>}
                    </td>
                    <td>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`移除 ${entry.file.name}`}
                        disabled={packing}
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
            disabled={!files.length || packing}
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
            {result && (
              <Button variant="outline" asChild>
                <a href={result} download="重命名文件.zip">
                  <ArrowDownToLine size={14} />
                  下载 ZIP
                </a>
              </Button>
            )}
            <Button disabled={!files.length || errors > 0 || packing || !!result} onClick={pack}>
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
