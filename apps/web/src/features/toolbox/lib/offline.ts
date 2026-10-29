export function registerOffline() {
  if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
  const register = () => {
    navigator.serviceWorker
      .register('/tools/sw.js', { scope: '/tools/' })
      .then(async () => {
        const registration = await navigator.serviceWorker.ready
        const prepare = () => {
          registration.active?.postMessage('OFFLINE_STATUS')
          if (navigator.onLine) registration.active?.postMessage('PREPARE_OFFLINE')
        }
        if ('requestIdleCallback' in window) window.requestIdleCallback(prepare, { timeout: 5000 })
        else setTimeout(prepare, 1500)
      })
      .catch(() => {
        /* Online tools remain available if caching is unavailable. */
      })
  }
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
}
