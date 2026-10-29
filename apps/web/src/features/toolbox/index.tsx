'use client'

import { useEffect, useState } from 'react'
import App from './App'
import { migrateStorage } from '@/features/toolbox/lib/storage'
import { installPreloadRecovery } from '@/features/toolbox/lib/preload-recovery'
import { registerOffline } from '@/features/toolbox/lib/offline'
import { ToolTransferProvider } from '@/features/toolbox/ToolTransferProvider'
import { ToolPlaceholder } from '@/features/toolbox/components/ToolPlaceholder'
import { DraftGuard } from './DraftGuard'
import { preferenceStorage } from '@/lib/storage'

let initialized = false

export default function ClientToolbox() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!initialized) {
      installPreloadRecovery()
      migrateStorage(preferenceStorage)
      registerOffline()
      initialized = true
    }
    // Browser-only state starts after hydration; the shell needs no second code download.
    setReady(true)
  }, [])
  return (
    <div id="main-content" tabIndex={-1}>
      <DraftGuard>
        <ToolTransferProvider>
          {ready ? <App /> : <ToolPlaceholder label="正在加载工具箱" />}
        </ToolTransferProvider>
      </DraftGuard>
    </div>
  )
}
