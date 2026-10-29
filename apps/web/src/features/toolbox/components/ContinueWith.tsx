import { outputParts } from '@/features/toolbox/lib/output-save'
import { Button } from '../../../components/ui/button'
import { useToolTransfer } from '@/features/toolbox/tool-transfer'
import type { OutputFile } from '@/features/toolbox/files/file-convert'
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
          files: outputParts(outputs).map(
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
