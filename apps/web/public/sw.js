// Retire the old site-wide worker; tools now use /tools/sw.js.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.registration.unregister()))
