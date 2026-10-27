import { createContext, useContext, useEffect } from 'react'
import type { Mode } from '@/file-tool/modes'

export type TransferTarget =
  'files' | 'text' | 'text-batch' | 'pdf' | 'rename' | 'compare' | 'table'
export type ToolTransfer = {
  id: string
  target: TransferTarget
  files?: File[]
  text?: string
  mode?: Mode
  preset?: 'clean' | 'pdf' | 'markdown'
}
export type NewTransfer = Omit<ToolTransfer, 'id'>
export type IntakeInput = { files: File[]; text?: string }
export const ToolTransferContext = createContext<{
  pending: ToolTransfer | null
  take: (target: TransferTarget) => ToolTransfer | null
  deliver: (transfer: NewTransfer) => boolean
  openIntake: (input: IntakeInput) => void
} | null>(null)

export const useToolTransfer = () => useContext(ToolTransferContext)

export function useTransferReceiver(
  target: TransferTarget,
  ready: boolean,
  receive: (request: ToolTransfer) => void,
) {
  const context = useToolTransfer()
  useEffect(() => {
    if (!ready || context?.pending?.target !== target) return
    const request = context.take(target)
    if (request) receive(request)
  }, [context, target, ready, receive])
}
