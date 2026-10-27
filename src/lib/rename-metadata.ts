export type RenameDateFormat = 'date' | 'datetime' | 'compact'
export type RenameFileMeta = { modified?: number; shotAt?: string; shotError?: string }
export type RenameSort =
  | 'name-asc'
  | 'name-desc'
  | 'modified-asc'
  | 'modified-desc'
  | 'size-asc'
  | 'size-desc'
  | 'shot-asc'
  | 'shot-desc'

export function formatRenameDate(value: number | string | undefined, format: RenameDateFormat) {
  let parts: number[]
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    parts = [
      date.getFullYear(),
      date.getMonth() + 1,
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
    ]
  } else if (typeof value === 'string' && /^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    parts = value.split(/[: ]/).map(Number)
    const [year, month, day, hour, minute, second] = parts
    const checked = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    if (
      year < 1900 ||
      checked.getUTCFullYear() !== year ||
      checked.getUTCMonth() !== month - 1 ||
      checked.getUTCDate() !== day ||
      hour > 23 ||
      minute > 59 ||
      second > 59
    )
      return ''
  } else return ''
  const [year, month, day, hour, minute, second] = parts.map((part, index) =>
    String(part).padStart(index === 0 ? 4 : 2, '0'),
  )
  return format === 'date'
    ? `${year}-${month}-${day}`
    : format === 'datetime'
      ? `${year}-${month}-${day}_${hour}-${minute}-${second}`
      : `${year}${month}${day}_${hour}${minute}${second}`
}

export async function readPhotoDate(file: File): Promise<string> {
  if (!/\.(jpe?g|png|tiff?|heic|heif|avif)$/i.test(file.name))
    throw new Error('此文件类型不读取 EXIF 拍摄时间。')
  const { parse } = await import('exifr')
  const tags = await parse(file, {
    pick: ['DateTimeOriginal'],
    reviveValues: false,
    gps: false,
    xmp: false,
    icc: false,
    iptc: false,
    jfif: false,
    ihdr: false,
    chunkLimit: 5,
  })
  const raw: unknown = tags?.DateTimeOriginal
  if (typeof raw !== 'string' || !formatRenameDate(raw, 'datetime'))
    throw new Error('没有有效的 EXIF 拍摄时间。')
  return raw
}

export function sortRenameFiles<
  T extends { file: Pick<File, 'name' | 'lastModified' | 'size'>; shotAt?: string },
>(files: T[], sort: RenameSort): T[] {
  const collator = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' })
  const direction = sort.endsWith('desc') ? -1 : 1
  const field = sort.split('-')[0]
  return [...files].sort((a, b) => {
    if (field === 'shot') {
      const left = formatRenameDate(a.shotAt, 'compact'),
        right = formatRenameDate(b.shotAt, 'compact')
      if (!left || !right) return !left && !right ? 0 : !left ? 1 : -1
      return direction * left.localeCompare(right)
    }
    return (
      direction *
      (field === 'name'
        ? collator.compare(a.file.name, b.file.name)
        : field === 'size'
          ? a.file.size - b.file.size
          : a.file.lastModified - b.file.lastModified)
    )
  })
}
