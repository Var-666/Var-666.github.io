import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  identifyFile,
  intakeTasks,
  prepareTransfer,
  taskLimit,
  fileKindLabel,
  validateIntakeFiles,
  type IdentifiedFile,
} from './lib/file-intake'
import type { IntakeInput, NewTransfer } from './lib/tool-transfer'

export function FileIntakeDialog({
  input,
  onClose,
  onChoose,
}: {
  input: IntakeInput | null
  onClose: () => void
  onChoose: (value: NewTransfer) => void
}) {
  const [identified, setIdentified] = useState<IdentifiedFile[]>([])
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!input) return
    let cancelled = false
    setIdentified([])
    setError('')
    setWorking(true)
    ;(async () => {
      try {
        validateIntakeFiles(input.files)
        const values = await Promise.all(input.files.map(identifyFile))
        if (!cancelled) setIdentified(values)
      } catch (error) {
        if (!cancelled) setError(error instanceof Error ? error.message : '无法识别文件。')
      } finally {
        if (!cancelled) setWorking(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [input])
  return (
    <Dialog
      open={!!input}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent className="intake-dialog">
        <DialogHeader>
          <DialogTitle>你想做什么？</DialogTitle>
          <DialogDescription>
            {working ? input?.files.length : identified.length} 个文件 · 全程本地处理
          </DialogDescription>
        </DialogHeader>
        <div className="intake-scroll">
          {working && <p role="status">正在识别文件…</p>}
          {error && <p role="alert">{error}</p>}
          <ul className="intake-file-list">
            {identified.map((entry, index) => (
              <li key={index}>
                <span>
                  {entry.file.name}
                  <small>
                    {fileKindLabel(entry.kind)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </small>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`移除待处理文件 ${entry.file.name}`}
                  onClick={() =>
                    setIdentified((previous) => previous.filter((_, i) => i !== index))
                  }
                >
                  移除
                </Button>
              </li>
            ))}
          </ul>
          <div className="intake-tasks">
            {input?.text !== undefined && (
              <Button
                variant="outline"
                onClick={() => onChoose({ target: 'text', text: input.text, preset: 'pdf' })}
              >
                整理提取的文字
              </Button>
            )}
            {intakeTasks(identified).map((task) => {
              const limit = taskLimit(task, identified)
              return (
                <Button
                  key={task.id}
                  variant="outline"
                  disabled={!!limit}
                  title={limit || undefined}
                  onClick={() => onChoose(prepareTransfer(task, identified))}
                >
                  {task.title}
                  {limit && <small>{limit}</small>}
                </Button>
              )
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
