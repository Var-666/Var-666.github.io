export type ImageSize = 'original' | '1920' | '1280' | 'half'

export function imageDimensions(width: number, height: number, size: ImageSize) {
  const scale = size === 'half' ? 0.5 : size === 'original' ? 1 : Math.min(1, Number(size) / width)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

export function pdfPageNumbers(value: string, total: number): number[] {
  if (!value.trim()) return Array.from({ length: total }, (_, i) => i + 1)
  const pages = new Set<number>()
  for (const part of value.split(/[,，]/)) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('页码格式示例：1,3-5；留空表示全部页。')
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > total)
      throw new Error(`页码超出范围，请填写 1–${total}。`)
    for (let page = start; page <= end; page++) pages.add(page)
  }
  return [...pages].sort((a, b) => a - b)
}
