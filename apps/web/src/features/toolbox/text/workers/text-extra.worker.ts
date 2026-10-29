import { runTextExtra, type TextExtraJob } from '@/features/toolbox/text/text-extra'
self.onmessage = async (event: MessageEvent<TextExtraJob>) => {
  try {
    self.postMessage({ result: await runTextExtra(event.data) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : '文本处理失败，请重试。' })
  }
}
