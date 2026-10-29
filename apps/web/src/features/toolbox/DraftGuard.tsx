import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react'

const DraftContext = createContext<(id: string, dirty: boolean) => void>(() => {})

export function useUnsavedWork(dirty: boolean) {
  const id = useId()
  const update = useContext(DraftContext)
  useEffect(() => {
    update(id, dirty)
    return () => update(id, false)
  }, [id, dirty, update])
}

export function DraftGuard({ children }: { children: ReactNode }) {
  const drafts = useRef(new Set<string>())
  const update = useCallback((id: string, dirty: boolean) => {
    if (dirty) drafts.current.add(id)
    else drafts.current.delete(id)
  }, [])
  useEffect(() => {
    const leaving = (event: MouseEvent) => {
      if (
        !drafts.current.size ||
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(link instanceof HTMLAnchorElement) ||
        link.hasAttribute('download') ||
        (link.target && link.target !== '_self')
      )
        return
      const url = new URL(link.href)
      if (url.origin === location.origin && url.pathname.startsWith('/tools/')) return
      if (
        !window.confirm(
          '离开工具箱会清空当前标签页内的输入和处理结果。请先下载需要的内容。确定离开吗？',
        )
      ) {
        event.preventDefault()
        event.stopPropagation()
      }
    }
    const unloading = (event: BeforeUnloadEvent) => {
      if (!drafts.current.size) return
      event.preventDefault()
      event.returnValue = ''
    }
    document.addEventListener('click', leaving, true)
    window.addEventListener('beforeunload', unloading)
    return () => {
      document.removeEventListener('click', leaving, true)
      window.removeEventListener('beforeunload', unloading)
    }
  }, [])
  return <DraftContext.Provider value={update}>{children}</DraftContext.Provider>
}
