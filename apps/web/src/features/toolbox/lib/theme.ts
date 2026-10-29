export function readThemePreference(read: () => string | null): boolean | null {
  try {
    const value = read()
    return value === 'dark' ? true : value === 'light' ? false : null
  } catch {
    return null
  }
}
