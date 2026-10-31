'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react'
import { preferenceStorage } from '@/lib/storage'
import { readThemePreference, themeStorageKey } from '@/lib/theme'

const ThemeContext = createContext<{ dark: boolean; setDark: (dark: boolean) => void }>({
  dark: false,
  setDark: () => {},
})

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, updateDark] = useState(false)
  const apply = useCallback((next: boolean) => {
    document.documentElement.classList.toggle('dark', next)
    // 工具箱路由随重设计版令牌（浅 #f5f5f7 / 深 #000），首页保持原配色
    const toolbox = document.querySelector('.app-shell') !== null
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        next ? (toolbox ? '#000000' : '#131722') : toolbox ? '#f5f5f7' : '#f7f8fa',
      )
    updateDark(next)
  }, [])
  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () =>
      apply(
        readThemePreference(
          () =>
            preferenceStorage.getItem(themeStorageKey) ?? preferenceStorage.getItem('liwen-theme'),
        ) ?? media.matches,
      )
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [apply])
  const setDark = (next: boolean) => {
    preferenceStorage.setItem(themeStorageKey, next ? 'dark' : 'light')
    apply(next)
  }
  return <ThemeContext.Provider value={{ dark, setDark }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
