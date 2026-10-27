import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
export function ConfirmImport({
  open,
  onAccept,
  onCancel,
  description,
}: {
  open: boolean
  onAccept: () => void
  onCancel: () => void
  description: string
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onCancel()
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>导入新任务</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="import-decision">
          <Button variant="outline" onClick={onCancel}>
            保留当前内容
          </Button>
          <Button onClick={onAccept}>切换并导入</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
