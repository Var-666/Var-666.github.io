import { processText, type Options } from './text'
self.onmessage = (event: MessageEvent<{ id: number; text: string; options: Options }>) => {
  const { id, text, options } = event.data
  try {
    self.postMessage({ id, result: processText(text, options) })
  } catch {
    self.postMessage({ id, error: '文字处理失败，请减少文本长度后重试。' })
  }
}
