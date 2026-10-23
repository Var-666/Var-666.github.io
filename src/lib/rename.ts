export type RenameOptions = {
  base: string
  find: string
  replace: string
  prefix: string
  suffix: string
  numbered: boolean
  start: number
  digits: number
}

export function renamePreview(names: string[], options: RenameOptions) {
  const rows = names.map((original, index) => {
    const dot = original.lastIndexOf('.')
    const extension = dot > 0 ? original.slice(dot) : ''
    let base = options.base || (dot > 0 ? original.slice(0, dot) : original)
    if (options.find) base = base.split(options.find).join(options.replace)
    const number = options.numbered
      ? `_${String(options.start + index).padStart(options.digits, '0')}`
      : ''
    const stem = `${options.prefix}${base}${number}${options.suffix}`
    const name = `${stem}${extension}`
    let error = ''
    if (
      options.numbered &&
      (!Number.isSafeInteger(options.start) ||
        options.start < 0 ||
        options.start > 1_000_000 ||
        ![1, 2, 3, 4].includes(options.digits))
    )
      error = '起始编号需为 0–1000000 的整数。'
    else if (
      !stem.trim() ||
      name === '__proto__' ||
      /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
      /[. ]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)
    )
      error = '文件名为空或含有系统不支持的字符。'
    else if (new TextEncoder().encode(name).length > 255) error = '文件名过长，请缩短名称或前后缀。'
    return { name, error }
  })
  const counts = new Map<string, number>()
  const key = (name: string) => name.normalize('NFC').toLowerCase()
  for (const row of rows) counts.set(key(row.name), (counts.get(key(row.name)) || 0) + 1)
  return rows.map((row) => ({
    ...row,
    error:
      row.error ||
      ((counts.get(key(row.name)) || 0) > 1 ? '存在同名文件，请开启编号或调整规则。' : ''),
  }))
}

export function validateRenameFiles(
  existing: Pick<File, 'name' | 'size'>[],
  incoming: Pick<File, 'name' | 'size'>[],
) {
  const all = [...existing, ...incoming]
  if (all.length > 100 || all.reduce((sum, file) => sum + file.size, 0) > 100 * 1024 * 1024)
    throw new Error('最多 100 个文件，总大小不超过 100 MB。')
}
