import { processText, type Options } from '../text'
import { textDiff } from '../text-diff'
self.onmessage = (event: MessageEvent<{ id: number; text: string; options: Options }>) => {
  const { id, text, options } = event.data
  try {
    const result = processText(text, options)
    self.postMessage({ id, result, diff: textDiff(text, result.text) })
  } catch {
    self.postMessage({ id, error: '文字处理失败，请减少文本长度后重试。' })
  }
}
