export async function processPdfLocal(file: Blob, mode: 'decrypt' | 'compress', password = '') {
  const limit = mode === 'decrypt' ? 20 : 100
  if (!file.size || file.size > limit * 1024 * 1024)
    throw new Error(`PDF 不能为空，且不超过 ${limit} MB。`)
  if (password.length > 1024 || /[\r\n\0]/.test(password))
    throw new Error('密码最多 1024 字符，不支持换行或空字符。')
  const bytes = await file.arrayBuffer()
  return new Promise<Blob>((resolve, reject) => {
    const worker = new Worker(new URL('../pdf-tool/qpdf.worker.ts', import.meta.url), {
      type: 'module',
    })
    const stop = () => {
      clearTimeout(timeout)
      worker.terminate()
    }
    const timeout = setTimeout(() => {
      stop()
      reject(new Error('PDF 处理超过 30 秒，已停止，请减少页面或文件大小。'))
    }, 30_000)
    worker.onerror = () => {
      stop()
      reject(new Error('PDF 处理器加载失败，请刷新或完成离线准备后重试。'))
    }
    worker.onmessage = ({ data }: MessageEvent<{ error?: string; bytes: ArrayBuffer }>) => {
      stop()
      if (data.error) reject(new Error(data.error))
      else resolve(new Blob([data.bytes], { type: 'application/pdf' }))
    }
    try {
      worker.postMessage({ bytes, mode, password }, [bytes])
    } catch {
      stop()
      reject(new Error('无法传递 PDF，请重试。'))
    }
  })
}
