export type RenameOptions = {
  base: string
  find: string
  replace: string
  prefix: string
  suffix: string
  numbered: boolean
  start: number
  digits: number
  /** 生成名称的清理开关：只作用于主名（不含扩展名），顺序为 特殊字符 → 空格 → 重复分隔符 */
  cleanup: {
    specialChars: boolean
    spaces: boolean
    duplicateSeparators: boolean
  }
}

export const defaultRenameOptions: RenameOptions = {
  base: '',
  find: '',
  replace: '',
  prefix: '',
  suffix: '',
  numbered: true,
  start: 1,
  digits: 3,
  cleanup: { specialChars: false, spaces: false, duplicateSeparators: false },
}

/** 文件系统非法字符（含控制字符）→ 空格 */
// eslint-disable-next-line no-control-regex -- 该正则的用途就是匹配文件名中的控制字符
const illegalChars = /[<>:"/\\|?*\u0000-\u001f]/g
const separatorRun = /([-_. ])\1+/g

function cleanupStem(stem: string, cleanup: RenameOptions['cleanup']): string {
  let value = stem
  if (cleanup.specialChars) value = value.replace(illegalChars, ' ').trim()
  if (cleanup.spaces) value = value.replace(/\s+/g, ' ').trim()
  if (cleanup.duplicateSeparators) value = value.replace(separatorRun, '$1')
  return value
}

export function renamePreview(
  names: string[],
  options: RenameOptions,
  overrides: (string | undefined)[] = [],
) {
  const rows = names.map((original, index) => {
    const dot = original.lastIndexOf('.')
    const extension = dot > 0 ? original.slice(dot) : ''
    let base = options.base || (dot > 0 ? original.slice(0, dot) : original)
    if (options.find) base = base.split(options.find).join(options.replace)
    const number = options.numbered
      ? `_${String(options.start + index).padStart(options.digits, '0')}`
      : ''
    const stem = cleanupStem(`${options.prefix}${base}${number}${options.suffix}`, options.cleanup)
    const override = overrides[index]?.trim()
    // 覆盖名是完整文件名（含扩展名）；未覆盖时用生成名
    const name = override || `${stem}${extension}`
    let error = ''
    if (
      !override &&
      options.numbered &&
      (!Number.isSafeInteger(options.start) ||
        options.start < 0 ||
        options.start > 1_000_000 ||
        ![1, 2, 3, 4].includes(options.digits))
    )
      error = '起始编号需为 0–1000000 的整数。'
    else if (
      !name.trim() ||
      name === '__proto__' ||
      // eslint-disable-next-line no-control-regex -- 该正则的用途就是检测文件名中的控制字符
      /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
      /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
      error = '文件名为空或含有系统不支持的字符。'
    else if (new TextEncoder().encode(name).length > 255) error = '文件名过长，请缩短名称或前后缀。'
    return { name, error, overridden: Boolean(override) }
  })
  const counts = new Map<string, number>()
  const key = (name: string) => name.normalize('NFC').toLowerCase()
  for (const row of rows) counts.set(key(row.name), (counts.get(key(row.name)) || 0) + 1)
  return rows.map((row) => ({
    ...row,
    error:
      row.error ||
      ((counts.get(key(row.name)) || 0) > 1 ? '存在同名文件，请调整名称或开启编号。' : ''),
  }))
}

/** 从文本列表导入目标名称：逐行一个（忽略空白行），数量必须与文件数一致 */
export function parseNameList(
  text: string,
  count: number,
): { names: string[] } | { error: string } {
  const names = text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
  if (!names.length) return { error: '请先粘贴名称列表（每行一个）。' }
  if (names.length !== count)
    return {
      error: `名称数量与文件数不一致：${names.length} 个名称 vs ${count} 个文件，请补齐后再导入。`,
    }
  return { names }
}

export function validateRenameFiles(
  existing: Pick<File, 'name' | 'size'>[],
  incoming: Pick<File, 'name' | 'size'>[],
) {
  const all = [...existing, ...incoming]
  if (all.length > 100 || all.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
    throw new Error('最多 100 个文件，总大小不超过 100 MB。')
}
