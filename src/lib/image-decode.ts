export function imageContainer(head: Uint8Array): 'heic' | 'avif' | null {
  if (head.length < 16 || String.fromCharCode(...head.slice(4, 8)) !== 'ftyp') return null
  const size = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0)
  if (size < 16 || size % 4 !== 0) return null
  const brands = [String.fromCharCode(...head.slice(8, 12))]
  for (let offset = 16; offset + 4 <= Math.min(size, head.length); offset += 4)
    brands.push(String.fromCharCode(...head.slice(offset, offset + 4)))
  if (brands.some((brand) => ['avif', 'avis'].includes(brand))) return 'avif'
  return brands.some((brand) =>
    ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(
      brand,
    ),
  )
    ? 'heic'
    : null
}
async function decodeHeic(file: File) {
  const bytes = await file.arrayBuffer()
  return new Promise<ImageBitmap>((resolve, reject) => {
    const worker = new Worker(new URL('../file-tool/heic.worker.ts', import.meta.url), {
      type: 'module',
    })
    const timeout = setTimeout(() => {
      worker.terminate()
      reject(new Error('HEIC 解码超过 20 秒，已停止，请减少图片尺寸。'))
    }, 20_000)
    const stop = () => {
      clearTimeout(timeout)
      worker.terminate()
    }
    worker.onerror = () => {
      stop()
      reject(new Error('无法加载 HEIC 解码器，请刷新或等待离线准备完成。'))
    }
    worker.onmessage = async ({
      data,
    }: MessageEvent<{ error?: string; data: ArrayBuffer; width: number; height: number }>) => {
      stop()
      if (data.error) {
        reject(new Error(data.error))
        return
      }
      try {
        resolve(
          await createImageBitmap(
            new ImageData(new Uint8ClampedArray(data.data), data.width, data.height),
          ),
        )
      } catch {
        reject(new Error('无法读取 HEIC 解码结果。'))
      }
    }
    try {
      worker.postMessage(bytes, [bytes])
    } catch {
      stop()
      reject(new Error('无法向 HEIC 解码器传递文件，请重试。'))
    }
  })
}
export async function decodeImage(file: File): Promise<ImageBitmap> {
  if (!file.size || file.size > 20 * 1024 * 1024)
    throw new Error('图片不能为空，且单张不超过 20 MB。')
  const container = imageContainer(new Uint8Array(await file.slice(0, 256).arrayBuffer()))
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    if (container !== 'heic') throw new Error('无法读取图片，请检查文件或使用浏览器支持的格式。')
    bitmap = await decodeHeic(file)
  }
  if (bitmap.width * bitmap.height > 24_000_000 || bitmap.width > 16384 || bitmap.height > 16384) {
    bitmap.close()
    throw new Error('图片超过 2400 万像素或边长 16384，请先缩小尺寸。')
  }
  return bitmap
}
export function supportsImageEncoding(format: string) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  try {
    return canvas.toDataURL(`image/${format}`).startsWith(`data:image/${format};`)
  } catch {
    return false
  } finally {
    canvas.width = canvas.height = 0
  }
}
