// localStorage 键名统一以 var- 开头；旧版 liwen- 键在启动时迁移一次。
// 只保存设置、主题偏好与工具使用记录（仅工具 id 与时间戳），正文内容与文件从不持久化。
export const storageKeys = {
  theme: 'var-theme',
  settings: 'var-settings',
  favoriteTools: 'var-favorite-tools',
  recentTools: 'var-recent-tools',
  userPresets: 'var-user-presets',
  fileOptions: 'var-file-options',
} as const

const legacyKeys: Partial<Record<string, string>> = {
  [storageKeys.theme]: 'liwen-theme',
  [storageKeys.settings]: 'liwen-settings',
}

const canonicalToolId = (id: string) => (id === 'compare' ? 'table' : id)
const recentToolsLimit = 8
const userPresetLimit = 12

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function migrateStorage(storage: StorageLike) {
  for (const [key, legacy] of Object.entries(legacyKeys)) {
    try {
      const value = storage.getItem(key) ?? storage.getItem(legacy ?? '')
      if (value !== null) {
        storage.setItem(key, value)
        storage.removeItem(legacy ?? '')
      }
    } catch {
      /* 隐私模式等存储不可用的场景直接跳过 */
    }
  }
}

const parseJson = (storage: StorageLike, key: string): unknown => {
  try {
    return JSON.parse(storage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

const writeJson = (storage: StorageLike, key: string, value: unknown) => {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* 存储不可用时收藏/最近使用仅停留在当前页面 */
  }
}

/** 收藏的工具 id；坏数据（非数组、未知 id）一律忽略 */
export function readFavoriteTools(storage: StorageLike, validIds: readonly string[]): string[] {
  const value = parseJson(storage, storageKeys.favoriteTools)
  if (!Array.isArray(value)) return []
  const valid = new Set(validIds)
  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === 'string')
        .map(canonicalToolId)
        .filter((id) => valid.has(id)),
    ),
  ]
}

export function toggleFavoriteTool(
  storage: StorageLike,
  id: string,
  validIds: readonly string[],
): string[] {
  if (!validIds.includes(id)) return readFavoriteTools(storage, validIds)
  const current = readFavoriteTools(storage, validIds)
  const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
  writeJson(storage, storageKeys.favoriteTools, next)
  return next
}

/** 最近使用的工具 id（新→旧，最多 4 个展示位；内部保留 8 条） */
export function readRecentTools(storage: StorageLike, validIds: readonly string[]): string[] {
  const value = parseJson(storage, storageKeys.recentTools)
  if (!Array.isArray(value)) return []
  const valid = new Set(validIds)
  const ids = value
    .filter(
      (item): item is { id: string; at: number } =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as { id?: unknown }).id === 'string' &&
        typeof (item as { at?: unknown }).at === 'number' &&
        valid.has(canonicalToolId((item as { id: string }).id)),
    )
    .sort((a, b) => b.at - a.at)
    .map((item) => canonicalToolId(item.id))
  return [...new Set(ids)].slice(0, 4)
}

export function recordRecentTool(
  storage: StorageLike,
  id: string,
  validIds: readonly string[],
): void {
  if (!validIds.includes(id)) return
  const value = parseJson(storage, storageKeys.recentTools)
  const entries = Array.isArray(value)
    ? value.filter(
        (item): item is { id: string; at: number } =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as { id?: unknown }).id === 'string' &&
          typeof (item as { at?: unknown }).at === 'number',
      )
    : []
  const next = [{ id, at: Date.now() }, ...entries.filter((item) => item.id !== id)].slice(
    0,
    recentToolsLimit,
  )
  writeJson(storage, storageKeys.recentTools, next)
}

// ---------- 文本工具的自定义预设（只存规则，不存正文） ----------

export type StoredUserPreset = {
  id: string
  name: string
  preset: string
  options: Record<string, unknown>
}

/** 读取自定义预设；结构不合法的条目丢弃，超出上限截断 */
export function readUserPresets(
  storage: StorageLike,
  validPresetIds: readonly string[],
  sanitizeOptions: (value: unknown) => Record<string, unknown>,
): StoredUserPreset[] {
  const value = parseJson(storage, storageKeys.userPresets)
  if (!Array.isArray(value)) return []
  const valid = new Set(validPresetIds)
  const presets: StoredUserPreset[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as Record<string, unknown>
    const { id, name, preset, options } = candidate
    if (
      typeof id !== 'string' ||
      !id ||
      typeof name !== 'string' ||
      !name.trim() ||
      name.length > 30 ||
      typeof preset !== 'string' ||
      !valid.has(preset) ||
      !options ||
      typeof options !== 'object'
    )
      continue
    presets.push({
      id,
      name: name.trim(),
      preset,
      options: sanitizeOptions(options),
    })
    if (presets.length >= userPresetLimit) break
  }
  return presets
}

function writeUserPresets(storage: StorageLike, presets: StoredUserPreset[]) {
  writeJson(storage, storageKeys.userPresets, presets.slice(0, userPresetLimit))
}

/** 保存一份自定义预设：同名覆盖，其余按保存时间倒序，超过上限淘汰最旧 */
export function saveUserPreset(
  storage: StorageLike,
  entry: { name: string; preset: string; options: Record<string, unknown> },
  validPresetIds: readonly string[],
  sanitizeOptions: (value: unknown) => Record<string, unknown>,
): StoredUserPreset[] {
  const current = readUserPresets(storage, validPresetIds, sanitizeOptions)
  const kept = current.filter((item) => item.name !== entry.name.trim())
  const saved: StoredUserPreset = {
    id: crypto.randomUUID(),
    name: entry.name.trim(),
    preset: entry.preset,
    options: sanitizeOptions(entry.options),
  }
  const next = [saved, ...kept].slice(0, userPresetLimit)
  writeUserPresets(storage, next)
  return next
}

export function deleteUserPreset(
  storage: StorageLike,
  id: string,
  validPresetIds: readonly string[],
  sanitizeOptions: (value: unknown) => Record<string, unknown>,
): StoredUserPreset[] {
  const next = readUserPresets(storage, validPresetIds, sanitizeOptions).filter(
    (item) => item.id !== id,
  )
  writeUserPresets(storage, next)
  return next
}

// ---------- 文件工具的参数记忆（只存选项值，不存文件内容） ----------

export type FileOptionSchema = Record<string, (value: unknown) => boolean>

export function readFileOptions(
  storage: StorageLike,
  schema: FileOptionSchema,
): Record<string, string | number | boolean> {
  const value = parseJson(storage, storageKeys.fileOptions)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, string | number | boolean> = {}
  for (const [key, isValid] of Object.entries(schema)) {
    const candidate = (value as Record<string, unknown>)[key]
    if (isValid(candidate)) result[key] = candidate as string | number | boolean
  }
  return result
}

export function saveFileOptions(
  storage: StorageLike,
  values: Record<string, string | number | boolean>,
  schema: FileOptionSchema,
) {
  // 只合并通过 schema 的值：非法写入不落盘，已存的合法旧值保留
  const incoming: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(values)) if (schema[key]?.(value)) incoming[key] = value
  const merged = { ...readFileOptions(storage, schema), ...incoming }
  writeJson(storage, storageKeys.fileOptions, merged)
}
