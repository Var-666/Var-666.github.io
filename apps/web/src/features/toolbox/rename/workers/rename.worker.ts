import { renamePreview } from '@/features/toolbox/rename/rename'
self.onmessage = (event: MessageEvent<Parameters<typeof renamePreview>>) => {
  try {
    self.postMessage({ rows: renamePreview(...event.data) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '重命名预览失败。' })
  }
}
