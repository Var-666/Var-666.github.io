import { useEffect, useState } from 'react'
import { renamePreview, type RenameOptions } from '@/lib/rename'
import type { RenameFileMeta } from '@/lib/rename-metadata'

export function useRenamePreview(
  names: string[],
  options: RenameOptions,
  overrides: (string | undefined)[],
  metadata: RenameFileMeta[],
) {
  const key = JSON.stringify([names, options, overrides, metadata])
  const [computed, setComputed] = useState<{
    key: string
    rows?: ReturnType<typeof renamePreview>
    error?: string
  } | null>(null)
  const normal = options.regex ? [] : renamePreview(names, options, overrides, metadata)
  useEffect(() => {
    const values: Parameters<typeof renamePreview> = JSON.parse(key)
    if (!values[1].regex || !values[0].length) return
    let worker: Worker | undefined, timeout: ReturnType<typeof setTimeout> | undefined
    const delay = setTimeout(() => {
      try {
        worker = new Worker(new URL('./rename.worker.ts', import.meta.url), { type: 'module' })
        const failed = (error: string) => {
          worker?.terminate()
          clearTimeout(timeout)
          setComputed({ key, error })
        }
        worker.onmessage = (
          event: MessageEvent<{ rows?: ReturnType<typeof renamePreview>; error?: string }>,
        ) => {
          worker?.terminate()
          clearTimeout(timeout)
          setComputed({ key, ...event.data })
        }
        worker.onerror = () => failed('正则预览失败，请关闭正则或重试。')
        timeout = setTimeout(() => failed('正则处理超时，已停止；请简化表达式。'), 1500)
        worker.postMessage(values)
      } catch {
        setComputed({ key, error: '无法加载正则预览，请关闭正则或重试。' })
      }
    }, 120)
    return () => {
      clearTimeout(delay)
      clearTimeout(timeout)
      worker?.terminate()
    }
  }, [key])
  const waiting = options.regex && names.length > 0 && computed?.key !== key
  const error = options.regex && computed?.key === key ? computed.error : undefined
  return {
    rows: options.regex
      ? computed?.key === key && computed.rows
        ? computed.rows
        : names.map((name) => ({ name, error: error ?? '', overridden: false }))
      : normal,
    pending: waiting,
    error,
  }
}
