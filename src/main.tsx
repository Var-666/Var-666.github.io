import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { migrateStorage } from './lib/storage'
import './index.css'

migrateStorage(window.localStorage)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 仅生产构建注册离线缓存；开发服务器的热更新与 Service Worker 会互相干扰
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* 注册失败不影响在线使用 */
    })
  })
}
