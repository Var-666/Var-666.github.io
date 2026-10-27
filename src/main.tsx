import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { migrateStorage } from './lib/storage'
import './index.css'
import { installPreloadRecovery } from './lib/preload-recovery'
import { registerOffline } from './lib/offline'

installPreloadRecovery()
migrateStorage(window.localStorage)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// 开发服务器的热更新与 Service Worker 会互相干扰。
registerOffline()
