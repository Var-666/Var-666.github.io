const reloadKey = 'var-preload-reload'

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
  let interacted = false
  const protectDrafts = () => {
    interacted = true
  }
  for (const type of ['pointerdown', 'keydown', 'input', 'change', 'drop', 'paste']) {
    window.addEventListener(type, protectDrafts, { capture: true, once: true })
  }
  window.addEventListener('vite:preloadError', (event) => {
    try {
      if (claimPreloadReload(sessionStorage, navigator.onLine, interacted)) {
        event.preventDefault()
        window.location.reload()
      }
    } catch {
      // Storage itself may be unavailable; let the tool boundary show recovery actions.
    }
  })
}
