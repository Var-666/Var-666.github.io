export const themeStorageKey = 'var-theme'

export function readThemePreference(read: () => string | null): boolean | null {
  try {
    const value = read()
    return value === 'dark' ? true : value === 'light' ? false : null
  } catch {
    return null
  }
}

// Runs before first paint; the export builder includes its hash in the CSP.
export const themeScript = `(()=>{let value;try{value=localStorage.getItem('var-theme')??localStorage.getItem('liwen-theme')}catch{}const dark=value==='dark'||(value!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',dark)})()`
