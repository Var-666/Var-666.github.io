// localStorage 键名统一以 var- 开头；旧版 liwen- 键在启动时迁移一次。
// 只保存设置、主题偏好与工具使用记录（仅工具 id 与时间戳），正文内容与文件从不持久化。
export const storageKeys = {
  theme: 'var-theme',
  settings: 'var-settings',
  favoriteTools: 'var-favorite-tools',
  recentTools: 'var-recent-tools',
} as const

const legacyKeys: Partial<Record<string, string>> = {
  [storageKeys.theme]: 'liwen-theme',
  [storageKeys.settings]: 'liwen-settings',
}

const recentToolsLimit = 8

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
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && valid.has(id)))]
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
        valid.has((item as { id: string }).id),
    )
    .sort((a, b) => b.at - a.at)
    .map((item) => item.id)
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
