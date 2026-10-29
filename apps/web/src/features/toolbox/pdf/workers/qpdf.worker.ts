import createModule from '@neslinesli93/qpdf-wasm'

type Filesystem = {
  writeFile(path: string, bytes: Uint8Array): void
  readFile(path: string): Uint8Array
  unlink(path: string): void
}
self.onmessage = async (
  event: MessageEvent<{ bytes: ArrayBuffer; mode: 'decrypt' | 'compress'; password: string }>,
) => {
  let invalidPassword = false
  // qpdf's factory binds console directly; keep document diagnostics inside this one-use worker.
  console.log = () => {}
  console.error = (...values: unknown[]) => {
    invalidPassword ||= values.some(
      (value) => typeof value === 'string' && /invalid password/i.test(value),
    )
  }
  try {
    const module = await createModule({ locateFile: () => '/pdf-assets/qpdf.wasm' })
    const fs = module.FS as unknown as Filesystem
    try {
      fs.writeFile('/input.pdf', new Uint8Array(event.data.bytes))
      const flags =
        event.data.mode === 'decrypt'
          ? ['--password-file=/password.txt', '--decrypt', '--stream-data=preserve']
          : [
              '--compress-streams=y',
              '--recompress-flate',
              '--compression-level=9',
              '--object-streams=generate',
            ]
      if (event.data.mode === 'decrypt')
        fs.writeFile('/password.txt', new TextEncoder().encode(event.data.password))
      let code = -1
      try {
        code = module.callMain([...flags, '/input.pdf', '/output.pdf'])
      } catch (error) {
        code = (error as { status?: number })?.status ?? -1
      }
      if (code !== 0)
        throw new Error(
          invalidPassword
            ? '密码不正确，请重新输入文件的打开密码。'
            : 'PDF 处理失败或存在结构警告，请检查文件后重试。',
        )
      const bytes = fs.readFile('/output.pdf')
      if (!bytes.length || bytes.length > 100 * 1024 * 1024)
        throw new Error('处理结果为空或超过 100 MB，请减少文件大小。')
      const result = Uint8Array.from(bytes)
      self.postMessage({ bytes: result.buffer }, { transfer: [result.buffer] })
    } finally {
      for (const path of ['/password.txt', '/input.pdf', '/output.pdf']) {
        try {
          fs.unlink(path)
        } catch {
          /* Not all files exist after a failed operation. */
        }
      }
    }
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error && /密码不正确|结构警告|100 MB/.test(error.message)
          ? error.message
          : '无法加载或运行 PDF 处理器，请刷新后重试。',
    })
  }
}
