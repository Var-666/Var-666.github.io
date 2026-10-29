'use client'

import dynamic from 'next/dynamic'
import { migrateStorage } from '@/features/toolbox/lib/storage'
import { installPreloadRecovery } from '@/features/toolbox/lib/preload-recovery'
import { registerOffline } from '@/features/toolbox/lib/offline'
import { ToolTransferProvider } from '@/features/toolbox/ToolTransferProvider'
import { ToolPlaceholder } from '@/features/toolbox/components/ToolPlaceholder'
import { DraftGuard } from './DraftGuard'

// Tool drafts and file APIs belong to the browser, including their initial state.
const Toolbox = dynamic(
  async () => {
    installPreloadRecovery()
    try {
      migrateStorage(window.localStorage)
    } catch {
      // Browser policy can reject access to the storage object itself.
    }
    registerOffline()
    return import('@/features/toolbox/App')
  },
  { ssr: false, loading: () => <ToolPlaceholder label="正在加载工具箱" /> },
)

export default function ClientToolbox() {
  return (
    <div id="main-content" tabIndex={-1}>
      <DraftGuard>
        <ToolTransferProvider>
          <Toolbox />
        </ToolTransferProvider>
      </DraftGuard>
    </div>
  )
}
