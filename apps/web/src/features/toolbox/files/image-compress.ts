// 图片压缩到指定大小：先在当前尺寸对编码质量降档试探，仍超限再逐级缩小尺寸；
// 无法达标时返回可达成的最小结果并如实标注，绝不假装压缩成功。
import { outputName, type OutputFile } from './file-convert'
import type { ImageSize } from './media-options'
import { prepareImage, type ImageEditOptions } from './image-edit'

export type ImageCompressFormat = 'jpeg' | 'webp'

/** 以指定质量与缩放比例编码当前图片；scale 变化时由实现负责重绘画布 */
export type QualityEncoder = (quality: number, scale: number) => Promise<Blob>

export type TargetCompressResult = {
  blob: Blob
  quality: number
  scale: number
  metTarget: boolean
  attempts: number
}

const QUALITY_FLOOR = 0.3
const QUALITY_LADDER = [0.92, 0.75, 0.6, 0.45]
const SCALES = [1, 0.85, 0.7, 0.55, 0.4, 0.25]

/** 压缩策略（可注入编码器，便于单测）：每档尺寸先用最低质量探底判断可行性，
 *  可行再从高质量降档找到不超过目标的最高质量；全部尺寸超限则返回最小结果 */
export async function compressToTarget(
  encode: QualityEncoder,
  targetBytes: number,
  maxAttempts = 16,
): Promise<TargetCompressResult> {
  type Candidate = { blob: Blob; quality: number; scale: number }
  let smallest: Candidate | null = null
  let attempts = 0
  const better = (current: Candidate | null, candidate: Candidate): Candidate =>
    !current || candidate.blob.size < current.blob.size ? candidate : current
  for (const scale of SCALES) {
    if (attempts >= maxAttempts) break
    attempts++
    const floorBlob = await encode(QUALITY_FLOOR, scale)
    const floorCandidate: Candidate = { blob: floorBlob, quality: QUALITY_FLOOR, scale }
    smallest = better(smallest, floorCandidate)
    // 最低质量仍超限：本档尺寸无望，直接缩小
    if (floorBlob.size > targetBytes) continue
    for (const quality of QUALITY_LADDER) {
      if (attempts >= maxAttempts) break
      attempts++
      const blob = await encode(quality, scale)
      if (blob.size <= targetBytes) return { blob, quality, scale, metTarget: true, attempts }
      smallest = better(smallest, { blob, quality, scale })
    }
    // 高质量档全部超限：最低质量结果就是本档最优
    return { blob: floorBlob, quality: QUALITY_FLOOR, scale, metTarget: true, attempts }
  }
  if (smallest === null) throw new Error('压缩失败：编码器不可用。')
  return { ...smallest, metTarget: smallest.blob.size <= targetBytes, attempts }
}

export type ImageCompressResult = OutputFile & {
  quality: number
  scale: number
  metTarget: boolean
  attempts: number
  originalBytes: number
  width: number
  height: number
}

/** 浏览器端压缩入口：解码位图、按缩放比例重绘并交给 compressToTarget 搜索目标大小 */
export async function compressImageFile(
  file: File,
  options: {
    targetBytes: number
    format: ImageCompressFormat
    size?: ImageSize
    edit?: ImageEditOptions
  },
): Promise<ImageCompressResult> {
  const prepared = await prepareImage(file, options.size ?? 'original', options.edit)
  const canvas = document.createElement('canvas')
  try {
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建图片画布。')
    const base = { width: prepared.width, height: prepared.height }
    let drawnScale = -1
    const encode = async (quality: number, scale: number): Promise<Blob> => {
      if (scale !== drawnScale) {
        canvas.width = Math.max(1, Math.round(base.width * scale))
        canvas.height = Math.max(1, Math.round(base.height * scale))
        if (options.format === 'jpeg') {
          context.fillStyle = '#fff'
          context.fillRect(0, 0, canvas.width, canvas.height)
        }
        context.drawImage(prepared, 0, 0, canvas.width, canvas.height)
        drawnScale = scale
      }
      return new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) =>
            blob && blob.type === `image/${options.format}`
              ? resolve(blob)
              : reject(new Error('当前浏览器不支持该图片格式编码。')),
          `image/${options.format}`,
          quality,
        ),
      )
    }
    const result = await compressToTarget(encode, options.targetBytes)
    return {
      blob: result.blob,
      name: outputName(file.name, options.format === 'jpeg' ? 'jpg' : 'webp'),
      quality: result.quality,
      scale: result.scale,
      metTarget: result.metTarget,
      attempts: result.attempts,
      originalBytes: file.size,
      width: Math.max(1, Math.round(base.width * result.scale)),
      height: Math.max(1, Math.round(base.height * result.scale)),
    }
  } finally {
    prepared.width = prepared.height = 0
    canvas.width = canvas.height = 0
  }
}
