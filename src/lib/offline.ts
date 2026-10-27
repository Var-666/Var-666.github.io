export function registerOffline() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
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
  })
}
