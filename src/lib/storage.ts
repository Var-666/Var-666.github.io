// localStorage 键名统一以 var- 开头；旧版 liwen- 键在启动时迁移一次。
// 只保存设置与主题偏好，正文内容从不持久化。
export const storageKeys = {
  theme: 'var-theme',
  settings: 'var-settings',
} as const

const legacyKeys: Partial<Record<string, string>> = {
  [storageKeys.theme]: 'liwen-theme',
  [storageKeys.settings]: 'liwen-settings',
}

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
