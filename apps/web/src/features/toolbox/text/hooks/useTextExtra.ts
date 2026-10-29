import { useEffect, useState } from 'react'
import type { TextExtraJob, TextExtraResult } from '@/features/toolbox/text/text-extra'

export function useTextExtra(job: TextExtraJob | null, active: boolean) {
  const [completed, setCompleted] = useState<{
    job: TextExtraJob
    result?: TextExtraResult
    error?: string
  } | null>(null)
  useEffect(() => {
    if (!job || !active || completed?.job === job) return
    let cancelled = false
    let worker: Worker | undefined, timeout: ReturnType<typeof setTimeout> | undefined
    const finish = (value: { result?: TextExtraResult; error?: string }) => {
      if (cancelled) return
      worker?.terminate()
      clearTimeout(timeout)
      setCompleted({ job, ...value })
    }
    try {
      worker = new Worker(
        /* webpackChunkName: "text-extra.worker" */ new URL(
          '../workers/text-extra.worker.ts',
          import.meta.url,
        ),
        { type: 'module' },
      )
      worker.onmessage = ({ data }) => finish(data)
      worker.onerror = () => finish({ error: '处理线程加载失败，请重试或刷新页面。' })
      timeout = setTimeout(
        () => finish({ error: '处理超时，已停止；请缩短文本或简化表达式。' }),
        job.kind === 'convert' ? 10_000 : 1500,
      )
      worker.postMessage(job)
    } catch {
      finish({ error: '无法启动处理线程，请重试或刷新页面。' })
    }
    return () => {
      cancelled = true
      clearTimeout(timeout)
      worker?.terminate()
    }
  }, [job, active, completed])
  const current = completed?.job === job ? completed : null
  return { result: current?.result, error: current?.error, pending: !!job && active && !current }
}
