import { useState } from 'react'
import { FolderDown, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../../../components/ui/button'
import {
  directoryPicker,
  filesToShare,
  outputParts,
  saveToDirectory,
} from '@/features/toolbox/lib/output-save'
import type { OutputFile } from '@/features/toolbox/files/file-convert'

export function OutputActions({
  outputs,
  disabled = false,
  shareOnly = false,
}: {
  outputs: OutputFile[]
  disabled?: boolean
  shareOnly?: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const shareFiles = filesToShare(outputs)
  const picker = directoryPicker()
  const parts = outputParts(outputs)
  if (!shareFiles && (!picker || shareOnly || parts.length < 2)) return null
  const handleError = (error: unknown) => {
    if ((error as DOMException)?.name !== 'AbortError')
      toast.error(error instanceof Error ? error.message : '操作失败，请使用下载按钮。')
  }
  return (
    <span className="output-actions" aria-busy={busy}>
      {shareFiles && (
        <Button
          size="sm"
          variant="outline"
          aria-label={`分享 ${outputs.length === 1 ? outputs[0].name : `${outputs.length} 个结果文件`}`}
          disabled={disabled || busy}
          onClick={async () => {
            setBusy(true)
            try {
              await navigator.share({ files: shareFiles })
            } catch (error) {
              handleError(error)
            } finally {
              setBusy(false)
            }
          }}
        >
          <Share2 size={14} /> 分享
        </Button>
      )}
      {picker && !shareOnly && parts.length > 1 && (
        <Button
          size="sm"
          variant="outline"
          disabled={disabled || busy}
          title="重名自动加序号，保留已有文件"
          onClick={async () => {
            setBusy(true)
            try {
              const directory = await picker({ mode: 'readwrite' })
              const saved = await saveToDirectory(directory, outputs, (done, total) =>
                setProgress(`${done}/${total}`),
              )
              toast.success(`已保存 ${saved.length} 个文件；重名已自动加序号。`)
            } catch (error) {
              handleError(error)
            } finally {
              setBusy(false)
              setProgress('')
            }
          }}
        >
          <FolderDown size={14} /> {progress ? `正在保存 ${progress}` : '保存到文件夹'}
        </Button>
      )}
    </span>
  )
}
