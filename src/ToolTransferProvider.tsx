import { toast } from 'sonner'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ToolTransferContext,
  type IntakeInput,
  type NewTransfer,
  type ToolTransfer,
  type TransferTarget,
} from './lib/tool-transfer'
import { FileIntakeDialog } from './FileIntakeDialog'

export function ToolTransferProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ToolTransfer | null>(null)
  const pendingRef = useRef<ToolTransfer | null>(null)
  const [intake, setIntake] = useState<IntakeInput | null>(null)
  const deliver = useCallback((value: NewTransfer) => {
    if (pendingRef.current) {
      toast.info('有文件任务等待读取，请稍后再试。')
      return false
    }
    const request = { ...value, id: crypto.randomUUID() }
    pendingRef.current = request
    setPending(request)
    const route = value.target === 'text-batch' ? 'text' : value.target
    window.location.hash = `#/${route}${value.mode ? `?mode=${value.mode}` : ''}`
    return true
  }, [])
  const take = useCallback((target: TransferTarget) => {
    if (pendingRef.current?.target !== target) return null
    const request = pendingRef.current
    pendingRef.current = null
    setPending(null)
    return request
  }, [])
  useEffect(() => {
    const cancelAbandoned = () => {
      const request = pendingRef.current
      if (!request) return
      const target = request.target === 'text-batch' ? 'text' : request.target
      const route = window.location.hash.replace(/^#\/?/, '').split(/[/?]/)[0]
      if (route !== target) {
        pendingRef.current = null
        setPending(null)
      }
    }
    window.addEventListener('hashchange', cancelAbandoned)
    return () => window.removeEventListener('hashchange', cancelAbandoned)
  }, [])
  const context = useMemo(
    () => ({ pending, take, deliver, openIntake: setIntake }),
    [pending, take, deliver],
  )
  return (
    <ToolTransferContext.Provider value={context}>
      {children}
      <FileIntakeDialog
        input={intake}
        onClose={() => setIntake(null)}
        onChoose={(value) => {
          if (deliver(value)) setIntake(null)
        }}
      />
    </ToolTransferContext.Provider>
  )
}
