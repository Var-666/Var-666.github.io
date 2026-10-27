import { Button } from './ui/button'
import { useToolTransfer } from '@/lib/tool-transfer'
import type { OutputFile } from '@/lib/file-convert'
export function ContinueWith({
  outputs,
  text,
  disabled = false,
}: {
  outputs: OutputFile[]
  text?: string
  disabled?: boolean
}) {
  const context = useToolTransfer()
  if (!context || !outputs.length) return null
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      onClick={() =>
        context.openIntake({
          files: outputs.map(
            (output) => new File([output.blob], output.name, { type: output.blob.type }),
          ),
          text,
        })
      }
    >
      继续处理
    </Button>
  )
}
