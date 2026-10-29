const reloadKey = 'var-preload-reload'
let interacted = false

export function claimPreloadReload(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  online: boolean,
  interacted: boolean,
) {
  if (!online || interacted) return false
  try {
    if (storage.getItem(reloadKey)) return false
    storage.setItem(reloadKey, '1')
    return true
  } catch {
    return false // Without a persistent guard, automatic reload could loop.
  }
}

export function installPreloadRecovery() {
  const protectDrafts = () => {
    interacted = true
  }
  for (const type of ['pointerdown', 'keydown', 'input', 'change', 'drop', 'paste']) {
    window.addEventListener(type, protectDrafts, { capture: true, once: true })
  }
}

export function recoverPreloadError(error: Error) {
  if (error.name !== 'ChunkLoadError') return
  try {
    if (claimPreloadReload(sessionStorage, navigator.onLine, interacted)) window.location.reload()
  } catch {
    // Storage itself may be unavailable; keep the tool's recovery actions visible.
  }
}
