// Only preferences belong here. If storage is blocked, keep them in this tab's memory.
const memory = new Map<string, string | null>()
export const preferenceStorage = {
  getItem(key: string): string | null {
    if (memory.has(key)) return memory.get(key) ?? null
    try {
      return window.localStorage.getItem(key)
    } catch {
      return null
    }
  },
  setItem(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value)
      memory.delete(key)
    } catch {
      memory.set(key, value)
    }
  },
  removeItem(key: string) {
    try {
      window.localStorage.removeItem(key)
      memory.delete(key)
    } catch {
      memory.set(key, null)
    }
  },
}
