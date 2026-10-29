import createModule from 'libheif-js/libheif-wasm/libheif-bundle.mjs'
self.onmessage = (event: MessageEvent<ArrayBuffer>) => {
  try {
    const module = createModule()
    const frames = new module.HeifDecoder().decode(new Uint8Array(event.data))
    if (!frames.length) throw new Error('无法解码 HEIC，请检查文件是否损坏。')
    if (frames.length > 100) throw new Error('HEIC 包含过多图像，请先拆分文件。')
    const frame = frames.find((image) => image.is_primary()) ?? frames[0]
    const width = frame.get_width(),
      height = frame.get_height()
    if (
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width * height > 24_000_000 ||
      width > 16384 ||
      height > 16384
    )
      throw new Error('图片超过 2400 万像素或边长 16384，请先缩小尺寸。')
    const data = new Uint8ClampedArray(width * height * 4)
    frame.display({ data, width, height }, (decoded) => {
      for (const image of frames) image.free()
      if (!decoded) self.postMessage({ error: 'HEIC 像素解码失败，请检查文件。' })
      else self.postMessage({ width, height, data: data.buffer }, { transfer: [data.buffer] })
    })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'HEIC 解码失败。' })
  }
}

self.addEventListener('unhandledrejection', (event) => {
  event.preventDefault()
  self.postMessage({ error: 'HEIC 像素解码失败，请检查文件。' })
})
