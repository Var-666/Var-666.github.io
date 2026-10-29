import { useEffect, useState } from 'react'

type Status = { state: 'idle' | 'preparing' | 'ready' | 'incomplete'; done: number; total: number }

export function OfflineStatus() {
  const [status, setStatus] = useState<Status | null>(null)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const update = (event: MessageEvent) => {
      if (event.data?.type === 'OFFLINE_STATUS') setStatus(event.data)
    }
    navigator.serviceWorker.addEventListener('message', update)
    navigator.serviceWorker.controller?.postMessage('OFFLINE_STATUS')
    return () => navigator.serviceWorker.removeEventListener('message', update)
  }, [])
  if (!status) return null
  const label =
    status.state === 'ready'
      ? '离线就绪'
      : status.state === 'preparing'
        ? `离线准备 ${status.done}/${status.total}`
        : status.state === 'incomplete'
          ? '重试离线准备'
          : '准备离线'
  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      <button
        type="button"
        className="offline-status"
        disabled={status.state === 'preparing' || status.state === 'ready'}
        onClick={() => navigator.serviceWorker.controller?.postMessage('PREPARE_OFFLINE')}
        title="缓存工具和本地字体后，可在断网时使用"
        aria-label={label}
      >
        {label}
      </button>
    </span>
  )
}
