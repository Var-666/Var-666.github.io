<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useNeteaseAuth } from '@/composables/useNeteaseAuth'
import { RECOMMENDED_VERCEL_DEPLOY_URL } from '@/services/neteaseApi'
import type { Track } from '@/data/playlist'

const {
  playlist,
  currentTrackIndex,
  currentTrack,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  volume,
  isMuted,
  isExpanded,
  searchResults,
  isSearching,
  searchError,
  getAnalyser,
  togglePlay,
  selectTrack,
  nextTrack,
  prevTrack,
  seek,
  setVolume,
  toggleMute,
  toggleExpand,
  searchMusic,
  playSearchResult,
  setPlaylist,
} = useAudioPlayer()

const {
  isLoggedIn,
  isAuthLoading,
  userInfo,
  userPlaylists,
  currentLoadingPlaylistId,
  apiUrl,
  isApiConnected,
  qrImg,
  qrStatusText,
  qrStatusCode,
  isQrLoading,
  startQrLogin,
  stopQrPolling,
  refreshQr,
  syncOwnerData,
  loadPlaylistTracks,
  resetToStationMode,
} = useNeteaseAuth()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId: number | null = null

// 模式切换: 'player' 唱机 | 'search' 搜歌 | 'playlist' 歌单曲目 | 'user-playlists' 用户歌单列表
const activeTab = ref<'player' | 'search' | 'playlist' | 'user-playlists'>('player')
const searchKeyword = ref('')
const hotTags = ['夏天的风', '起风了', '坂本龙一', '千与千寻', '周杰伦', 'Lofi']

// 弹窗状态
const showNeteaseModal = ref(false)
const showQrAuth = ref(false)

// 监听弹窗开启和关闭
watch(showNeteaseModal, (isOpen) => {
  if (!isOpen) {
    showQrAuth.value = false
    stopQrPolling()
  }
})

watch(showQrAuth, (isQr) => {
  if (isQr) {
    startQrLogin()
  } else {
    stopQrPolling()
  }
})

function handleStartAuth() {
  showQrAuth.value = true
}

function handleBackToStation() {
  showQrAuth.value = false
  stopQrPolling()
}

async function handleSelectNeteasePlaylist(playlistId: number) {
  const tracks = await loadPlaylistTracks(playlistId)
  if (tracks.length > 0) {
    setPlaylist(tracks, true)
    activeTab.value = 'player'
  }
}

function handleSearch(keyword?: string) {
  const query = keyword || searchKeyword.value
  if (keyword) searchKeyword.value = keyword
  searchMusic(query)
  activeTab.value = 'search'
}

function handleSelectSearchResult(track: Track) {
  playSearchResult(track)
  activeTab.value = 'player'
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function handleProgressClick(e: MouseEvent) {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const pct = Math.max(0, Math.min(1, clickX / rect.width))
  seek(pct * (duration.value || 180))
}

function handleVolumeChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  setVolume(val / 100)
}

// ── 真实声波频谱 Canvas 绘制 ──
function drawSpectrum() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const analyser = getAnalyser()
  const bufferLength = analyser ? analyser.frequencyBinCount : 32
  const dataArray = new Uint8Array(bufferLength)

  const render = () => {
    animId = requestAnimationFrame(render)

    const width = canvas.width
    const height = canvas.height
    ctx.clearRect(0, 0, width, height)

    if (analyser && isPlaying.value) {
      analyser.getByteFrequencyData(dataArray)
    } else {
      for (let i = 0; i < dataArray.length; i++) {
        dataArray[i] = Math.sin(i * 0.4 + Date.now() * 0.0025) * 6 + 10
      }
    }

    const barCount = 30
    const barWidth = (width / barCount) * 0.65
    const gap = (width - barWidth * barCount) / (barCount - 1)

    for (let i = 0; i < barCount; i++) {
      const dataIdx = Math.floor((i / barCount) * (bufferLength * 0.65))
      const value = dataArray[dataIdx] || 0
      const barHeight = Math.max(3, (value / 255) * (height * 0.9))

      const x = i * (barWidth + gap)
      const y = height - barHeight

      const gradient = ctx.createLinearGradient(0, y, 0, height)
      gradient.addColorStop(0, 'rgba(124, 140, 110, 0.9)')
      gradient.addColorStop(1, 'rgba(196, 168, 130, 0.3)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0])
      ctx.fill()
    }
  }

  render()
}

onMounted(() => {
  if (canvasRef.value) {
    canvasRef.value.width = canvasRef.value.offsetWidth * 2
    canvasRef.value.height = canvasRef.value.offsetHeight * 2
    const ctx = canvasRef.value.getContext('2d')
    if (ctx) ctx.scale(2, 2)
  }
  drawSpectrum()
})

onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId)
})

watch(isExpanded, (val) => {
  if (val) {
    setTimeout(() => {
      if (canvasRef.value) {
        canvasRef.value.width = canvasRef.value.offsetWidth * 2
        canvasRef.value.height = canvasRef.value.offsetHeight * 2
        const ctx = canvasRef.value.getContext('2d')
        if (ctx) ctx.scale(2, 2)
      }
    }, 60)
  }
})
</script>

<template>
  <div class="music-player-container">
    <!-- 1. 悬浮微胶囊态 (Collapsed Capsule Dock) -->
    <Transition name="capsule-fade">
      <div
        v-if="!isExpanded"
        class="player-capsule"
        @click="toggleExpand"
        title="点击展开黑胶唱机与网易云歌单"
      >
        <div class="capsule-vinyl" :class="{ spinning: isPlaying }">
          <img :src="currentTrack.coverUrl" alt="cover" class="capsule-cover-img" />
          <div class="vinyl-center-dot"></div>
        </div>

        <div class="capsule-info">
          <div class="title-with-badge">
            <span class="capsule-title">{{ currentTrack.title }}</span>
            <span v-if="currentTrack.isFull" class="capsule-full-pill">全曲</span>
          </div>
          <span class="capsule-artist">{{ currentTrack.artist }}</span>
        </div>

        <div class="capsule-wave">
          <span class="c-bar cb-1" :class="{ active: isPlaying }"></span>
          <span class="c-bar cb-2" :class="{ active: isPlaying }"></span>
          <span class="c-bar cb-3" :class="{ active: isPlaying }"></span>
          <span class="c-bar cb-4" :class="{ active: isPlaying }"></span>
        </div>

        <button
          class="capsule-play-btn"
          @click.stop="togglePlay"
          :aria-label="isPlaying ? '暂停' : '播放'"
        >
          <span v-if="isLoading" class="btn-spinner"></span>
          <svg v-else-if="!isPlaying" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- 2. 展开态拟物唱机大卡片 (Expanded Modal Card) -->
    <Transition name="modal-pop">
      <div v-if="isExpanded" class="player-overlay" @click.self="toggleExpand">
        <div class="player-card glass-card">
          <!-- 卡片顶部 Tab 栏与用户登录态 -->
          <div class="card-top-bar">
            <div class="nav-tabs">
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'player' }"
                @click="activeTab = 'player'"
              >
                唱机
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'search' }"
                @click="activeTab = 'search'"
              >
                搜歌 🔍
              </button>
              <button
                class="tab-btn"
                :class="{ active: activeTab === 'playlist' }"
                @click="activeTab = 'playlist'"
              >
                当前 ({{ playlist.length }})
              </button>
              <button
                v-if="userPlaylists.length > 0"
                class="tab-btn highlight"
                :class="{ active: activeTab === 'user-playlists' }"
                @click="activeTab = 'user-playlists'"
              >
                精选歌单 ({{ userPlaylists.length }})
              </button>
            </div>

            <div class="top-bar-right">
              <!-- 站长专属黑胶电台徽章（全体访客与移动端免登录） -->
              <div
                class="user-profile-badge"
                @click="showNeteaseModal = true"
                title="站长专属黑胶电台 · 全天候免登录畅听"
              >
                <img :src="userInfo?.avatarUrl" alt="avatar" class="user-avatar-mini" />
                <span class="user-nickname-mini">{{ userInfo?.nickname || 'var' }}</span>
                <span class="vip-mini-tag">VIP</span>
              </div>

              <button class="icon-btn-close" @click="toggleExpand" aria-label="收起播放器">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- TAB 1: 唱机主视角 (Player View) -->
          <div v-show="activeTab === 'player'" class="tab-view-player">
            <div class="turntable-deck">
              <!-- 唱臂 -->
              <div class="turntable-arm" :class="{ playing: isPlaying }">
                <div class="arm-base"></div>
                <div class="arm-rod"></div>
                <div class="arm-head"></div>
              </div>

              <!-- 黑胶唱片 -->
              <div class="vinyl-record" :class="{ spinning: isPlaying }">
                <div class="vinyl-groove g-1"></div>
                <div class="vinyl-groove g-2"></div>
                <div class="vinyl-groove g-3"></div>
                <div class="vinyl-light-reflection"></div>
                <!-- 唱片中心真实封面轮盘 -->
                <div class="vinyl-label">
                  <img :src="currentTrack.coverUrl" alt="cover" class="label-img" />
                  <div class="label-spindle"></div>
                </div>
              </div>
            </div>

            <!-- 曲目信息 -->
            <div class="track-meta">
              <div class="title-row">
                <h3 class="track-title">{{ currentTrack.title }}</h3>
                <span class="full-song-tag" :class="{ full: currentTrack.isFull }">
                  {{ currentTrack.isFull ? '● 完整全曲' : '○ 试听采样 30s' }}
                </span>
              </div>
              <p class="track-subtitle">{{ currentTrack.artist }} · {{ currentTrack.album }}</p>
            </div>

            <!-- 实时声波频谱 Canvas (Web Audio) -->
            <div class="visualizer-wrap">
              <canvas ref="canvasRef" class="spectrum-canvas"></canvas>
            </div>

            <!-- 进度条 -->
            <div class="progress-section">
              <div class="progress-bar-container" @click="handleProgressClick">
                <div
                  class="progress-fill-bar"
                  :style="{ width: `${(currentTime / (duration || 1)) * 100}%` }"
                >
                  <div class="progress-thumb"></div>
                </div>
              </div>
              <div class="time-labels">
                <span>{{ formatTime(currentTime) }}</span>
                <span>{{ formatTime(duration) }}</span>
              </div>
            </div>
          </div>

          <!-- TAB 2: 在线搜歌视角 (Search View) -->
          <div v-show="activeTab === 'search'" class="tab-view-search">
            <div class="search-input-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                v-model="searchKeyword"
                type="text"
                class="search-input"
                placeholder="搜歌名/歌手，或输入网易云单曲ID（如 1436709403）"
                @keyup.enter="handleSearch()"
              />
              <button class="search-submit-btn" @click="handleSearch()">搜索</button>
            </div>

            <!-- 灵感热门标签 -->
            <div class="hot-tags-row">
              <span class="hot-tag-label">快捷检索:</span>
              <button
                v-for="tag in hotTags"
                :key="tag"
                class="hot-tag-chip"
                @click="handleSearch(tag)"
              >
                {{ tag }}
              </button>
            </div>

            <!-- 检索结果列表 -->
            <div class="search-results-list">
              <div v-if="isSearching" class="search-loading">
                <span class="loading-spinner"></span>
                <span>正在全网曲库检索中...</span>
              </div>

              <div v-else-if="searchError" class="search-empty">
                {{ searchError }}
              </div>

              <div v-else-if="searchResults.length === 0" class="search-intro">
                <div class="search-intro-card">
                  <span class="intro-title">🎵 全网音乐检索说明</span>
                  <p class="intro-desc">
                    受数字版权法限制，全球公开音乐 API 默认提供 <strong>30秒官方试听片段</strong>。
                  </p>
                  <p class="intro-action">
                    👉 想要聆听 <strong>3~5分钟完整长版</strong>？请点击顶部的 <strong>「网易云登录」</strong> 同步个人完整歌单，或使用内置的 <strong>「当前歌单」</strong> 畅听经典长曲！
                  </p>
                </div>
              </div>

              <div
                v-for="item in searchResults"
                :key="item.id"
                class="search-item"
                @click="handleSelectSearchResult(item)"
              >
                <img :src="item.coverUrl" alt="art" class="item-thumb" />
                <div class="item-info">
                  <div class="item-title-row">
                    <span class="item-title">{{ item.title }}</span>
                    <span class="item-badge" :class="{ full: item.isFull }">
                      {{ item.isFull ? '完整全曲' : '试听 30s' }}
                    </span>
                  </div>
                  <span class="item-meta">{{ item.artist }} · {{ item.album }}</span>
                </div>
                <button class="item-play-action">▶ 播放</button>
              </div>
            </div>
          </div>

          <!-- TAB 3: 当前播放列表视角 (Playlist View) -->
          <div v-show="activeTab === 'playlist'" class="tab-view-playlist">
            <div class="playlist-header">
              <span>当前播放列表 ({{ playlist.length }} 首)</span>
              <span class="playlist-hint">支持自动顺次连播</span>
            </div>
            <div class="playlist-items-scroll">
              <div
                v-for="(item, idx) in playlist"
                :key="item.id"
                class="playlist-row"
                :class="{ active: idx === currentTrackIndex }"
                @click="selectTrack(idx); activeTab = 'player'"
              >
                <img :src="item.coverUrl" alt="art" class="row-cover" />
                <div class="row-info">
                  <div class="row-title-row">
                    <span class="row-title">{{ item.title }}</span>
                    <span v-if="item.isFull" class="badge-full">全曲</span>
                  </div>
                  <span class="row-artist">{{ item.artist }}</span>
                </div>
                <span v-if="idx === currentTrackIndex && isPlaying" class="row-playing-icon">♫ 正在播</span>
                <span v-else class="row-duration">{{ formatTime(item.duration) }}</span>
              </div>
            </div>
          </div>

          <!-- TAB 4: 网易云用户私人歌单 (User Playlists View) -->
          <div v-show="activeTab === 'user-playlists'" class="tab-view-user-playlists">
            <div class="playlist-header">
              <span>{{ userInfo?.nickname }} 的网易云歌单 ({{ userPlaylists.length }})</span>
              <span class="playlist-hint">点击载入整张歌单播放</span>
            </div>
            <div class="user-playlists-grid">
              <div
                v-for="pl in userPlaylists"
                :key="pl.id"
                class="user-playlist-card"
                :class="{ loading: currentLoadingPlaylistId === pl.id }"
                @click="handleSelectNeteasePlaylist(pl.id)"
              >
                <div class="card-cover-wrap">
                  <img :src="pl.coverImgUrl" alt="cover" class="pl-cover" />
                  <span v-if="currentLoadingPlaylistId === pl.id" class="pl-loading-tag">载入中...</span>
                </div>
                <div class="pl-info">
                  <span class="pl-name">{{ pl.name }}</span>
                  <span class="pl-count">{{ pl.trackCount }} 首歌曲</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部控制栏 (在所有 Tab 下常驻) -->
          <div class="controls-deck">
            <!-- 上一首 -->
            <button class="control-icon-btn" @click="prevTrack" title="上一首">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 主播放/暂停按钮 (Uiverse 水滴触感) -->
            <button class="main-play-btn" @click="togglePlay" :aria-label="isPlaying ? '暂停' : '播放'">
              <span v-if="isLoading" class="btn-spinner large"></span>
              <svg v-else-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>

            <!-- 下一首 -->
            <button class="control-icon-btn" @click="nextTrack" title="下一首">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 音量控制 -->
            <div class="volume-box">
              <button class="control-icon-btn" @click="toggleMute" title="静音切换">
                <svg v-if="isMuted || volume === 0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="100"
                :value="isMuted ? 0 : volume * 100"
                class="volume-slider"
                @input="handleVolumeChange"
                title="音量调节"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 3. 网易云登录与歌单同步弹窗 (NetEase Login Modal) -->
    <Transition name="modal-pop">
      <div v-if="showNeteaseModal" class="login-modal-overlay" @click.self="showNeteaseModal = false">
        <div class="login-card glass-card">
          <div class="login-header">
            <div class="header-left">
              <span class="cloud-icon">☁️</span>
              <span class="login-title">{{ isLoggedIn ? '网易云音乐中心' : '网易云音乐连接中心' }}</span>
            </div>
            <button class="icon-btn-close" @click="showNeteaseModal = false">×</button>
          </div>

          <!-- 模式 1：站长专属电台展示 -->
          <div v-if="!showQrAuth" class="logged-in-profile">
            <div class="profile-main">
              <img :src="userInfo?.avatarUrl" alt="avatar" class="profile-avatar" />
              <div class="profile-info">
                <div class="name-row">
                  <span class="profile-name">{{ userInfo?.nickname || 'var' }}</span>
                  <span class="vip-tag">黑胶VIP</span>
                </div>
                <span class="profile-uid">UID: {{ userInfo?.userId }} · 站长音乐电台</span>
                <span class="profile-playlists-count">已同步 {{ userPlaylists.length }} 个精选歌单 · 全曲免登录</span>
              </div>
            </div>

            <div class="station-desc-box">
              <span class="station-icon">📻</span>
              <div class="station-text">
                <strong>站长专属免登录电台已激活</strong>
                <p>已接入 Vercel 专属云解析节点，全网所有访客及移动设备均可直接畅享完整无损全曲，无需任何账号登录。</p>
              </div>
            </div>

            <div class="profile-actions">
              <button class="action-btn-sync" @click="syncOwnerData">🔄 刷新歌单</button>
              <button class="action-btn-auth" @click="handleStartAuth" title="使用手机扫码更新账号或切换歌单">
                📲 扫码授权 / 换号
              </button>
            </div>
          </div>

          <!-- 模式 2：扫码授权/切换账号 -->
          <div v-else class="login-body">
            <div class="qr-box">
              <div class="qr-frame-wrap" :class="{ expired: qrStatusCode === 800 }">
                <div v-if="isQrLoading" class="qr-loading-layer">
                  <span class="btn-spinner large"></span>
                  <span class="loading-sub">生成授权码中...</span>
                </div>
                <img v-else-if="qrImg" :src="qrImg" alt="QR Code" class="qr-image" />

                <!-- 二维码失效遮罩 -->
                <div v-if="qrStatusCode === 800" class="qr-expired-overlay" @click="refreshQr">
                  <span>⚠️ 二维码已失效</span>
                  <button class="btn-refresh-qr">点击刷新</button>
                </div>
              </div>

              <div class="qr-status-pill" :class="[`status-${qrStatusCode}`]">
                <span class="status-pulse-dot" v-if="qrStatusCode === 801 || qrStatusCode === 802"></span>
                <span>{{ qrStatusText || '请打开网易云音乐手机 App 扫码' }}</span>
              </div>

              <p class="qr-app-tip">
                使用手机【网易云音乐】App 扫码可更新站长 VIP 凭证或同步新歌单
              </p>

              <div class="qr-bottom-actions">
                <button class="btn-qr-action" @click="handleBackToStation">
                  ← 返回电台
                </button>
                <button class="btn-qr-action" @click="refreshQr" title="刷新二维码">
                  🔄 刷新二维码
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.music-player-container {
  position: relative;
  z-index: 950;
}

/* ── 1. 悬浮微胶囊态 ── */
.player-capsule {
  position: fixed;
  bottom: 32px;
  left: 32px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 14px 6px 6px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.35s var(--ease-spring);
  user-select: none;
}

.player-capsule:hover {
  transform: translateY(-2px);
  border-color: rgba(124, 140, 110, 0.4);
  box-shadow: 0 12px 36px var(--color-accent-glow);
}

.capsule-vinyl {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.capsule-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.vinyl-center-dot {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #181513;
  border: 2px solid white;
}

.capsule-vinyl.spinning {
  animation: vinyl-spin 6s linear infinite;
}

.capsule-info {
  display: flex;
  flex-direction: column;
  max-width: 130px;
  overflow: hidden;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 4px;
}

.capsule-title {
  font-family: var(--font-serif);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.capsule-full-pill {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  padding: 0 4px;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-radius: 3px;
  flex-shrink: 0;
}

.capsule-artist {
  font-size: 0.7rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
}

.capsule-wave {
  display: flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 14px;
  padding: 0 4px;
}

.c-bar {
  width: 2px;
  height: 4px;
  background: var(--color-accent);
  border-radius: 1px;
  transition: height 0.2s;
}

.c-bar.active {
  animation: wave-bounce 1.1s ease-in-out infinite alternate;
}

.cb-1 { animation-delay: 0.1s; }
.cb-2 { animation-delay: 0.35s; }
.cb-3 { animation-delay: 0.2s; }
.cb-4 { animation-delay: 0.45s; }

@keyframes wave-bounce {
  0% { height: 3px; }
  100% { height: 13px; }
}

.capsule-play-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.2s var(--ease-spring), background 0.2s;
}

.capsule-play-btn:hover {
  transform: scale(1.1);
  background: var(--color-accent-dark);
}

.btn-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.btn-spinner.large {
  width: 18px;
  height: 18px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 2. 展开态大卡片 ── */
.player-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 38, 33, 0.45);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1000;
}

.player-card {
  width: 100%;
  max-width: 460px;
  padding: 22px;
  position: relative;
  background: var(--color-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 64px -12px rgba(44, 38, 33, 0.25);
  display: flex;
  flex-direction: column;
}

/* 顶栏 Tab 与用户登录态 */
.card-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.nav-tabs {
  display: flex;
  gap: 4px;
  background: var(--color-bg-alt);
  padding: 3px;
  border-radius: var(--radius-full);
}

.tab-btn {
  padding: 5px 10px;
  font-size: 0.72rem;
  border-radius: var(--radius-full);
  color: var(--color-text-lighter);
  transition: all 0.2s;
  font-weight: 500;
}

.tab-btn.active {
  background: white;
  color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tab-btn.highlight {
  color: var(--color-accent);
}

.top-bar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.netease-pill-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: rgba(220, 38, 38, 0.08);
  border: 1px solid rgba(220, 38, 38, 0.2);
  color: #DC2626;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 500;
  transition: all 0.2s;
}

.netease-pill-btn:hover {
  background: rgba(220, 38, 38, 0.15);
  transform: translateY(-1px);
}

.user-profile-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 4px;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all 0.2s;
}

.user-profile-badge:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.user-avatar-mini {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.user-nickname-mini {
  font-size: 0.72rem;
  font-weight: 500;
  color: var(--color-text);
  max-width: 70px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vip-mini-tag {
  font-size: 0.58rem;
  font-weight: 700;
  color: #DC2626;
  background: rgba(220, 38, 38, 0.1);
  padding: 0 3px;
  border-radius: 2px;
}

.icon-btn-close {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-lighter);
  background: var(--color-bg-alt);
  transition: all 0.2s;
}

.icon-btn-close:hover {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  transform: rotate(90deg);
}

/* ── 拟物黑胶唱机 ── */
.turntable-deck {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-record {
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: #141210;
  position: relative;
  box-shadow:
    0 12px 32px rgba(0, 0, 0, 0.35),
    inset 0 0 0 2px rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.vinyl-record.spinning {
  animation: vinyl-spin 10s linear infinite;
}

@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.vinyl-groove {
  position: absolute;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.05);
}

.g-1 { width: 155px; height: 155px; }
.g-2 { width: 125px; height: 125px; }
.g-3 { width: 95px; height: 95px; }

.vinyl-light-reflection {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.08) 0%, transparent 40%, rgba(255, 255, 255, 0.08) 100%);
  pointer-events: none;
  z-index: 3;
}

.vinyl-label {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 0 4px #141210, 0 0 16px rgba(0, 0, 0, 0.5);
  z-index: 2;
}

.label-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.label-spindle {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #141210;
  border: 3px solid #E5DFD7;
}

/* 唱臂 */
.turntable-arm {
  position: absolute;
  top: 4px;
  right: 10px;
  width: 50px;
  height: 90px;
  pointer-events: none;
  z-index: 5;
  transform-origin: top right;
  transform: rotate(-25deg);
  transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.turntable-arm.playing {
  transform: rotate(0deg);
}

.arm-base {
  position: absolute;
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #7C8C6E;
  border: 3px solid #E5DFD7;
}

.arm-rod {
  position: absolute;
  top: 10px;
  right: 7px;
  width: 3px;
  height: 68px;
  background: linear-gradient(to bottom, #A8A097, #5C554E);
  border-radius: 2px;
  transform: rotate(18deg);
  transform-origin: top center;
}

.arm-head {
  position: absolute;
  bottom: 12px;
  left: 16px;
  width: 10px;
  height: 14px;
  background: #C4A882;
  border-radius: 2px;
  transform: rotate(15deg);
}

/* 曲目信息 */
.track-meta {
  text-align: center;
  margin-bottom: 6px;
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
}

.track-title {
  font-family: var(--font-serif);
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.full-song-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 1px 6px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-lighter);
}

.full-song-tag.full {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.2);
  font-weight: 500;
}

.track-subtitle {
  font-size: 0.78rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.visualizer-wrap {
  width: 100%;
  height: 28px;
  margin-bottom: 8px;
}

.spectrum-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.progress-section {
  margin-bottom: 14px;
}

.progress-bar-container {
  width: 100%;
  height: 6px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-full);
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.progress-fill-bar {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  position: relative;
  transition: width 0.1s linear;
}

.time-labels {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  margin-top: 6px;
}

/* ── TAB 2: 在线搜歌界面 ── */
.tab-view-search {
  display: flex;
  flex-direction: column;
  height: 330px;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  padding: 4px 6px 4px 14px;
  margin-bottom: 8px;
}

.search-icon {
  color: var(--color-text-lighter);
  margin-right: 8px;
  flex-shrink: 0;
}

.search-input {
  border: none;
  background: transparent;
  outline: none;
  font-size: 0.82rem;
  color: var(--color-text);
  width: 100%;
}

.search-submit-btn {
  padding: 5px 12px;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  font-weight: 500;
  flex-shrink: 0;
  transition: background 0.2s;
}

.search-submit-btn:hover {
  background: var(--color-accent-dark);
}

.hot-tags-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.hot-tag-label {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.hot-tag-chip {
  padding: 2px 8px;
  font-size: 0.72rem;
  border-radius: var(--radius-sm);
  background: var(--color-bg-alt);
  color: var(--color-text-light);
  border: 1px solid var(--border-light);
  transition: all 0.2s;
}

.hot-tag-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.search-results-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 4px;
}

.search-intro-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: var(--color-bg-alt);
  border: 1px dashed var(--border-medium);
  padding: 16px;
  border-radius: var(--radius-sm);
  text-align: left;
}

.intro-title {
  font-family: var(--font-serif);
  font-weight: 600;
  color: var(--color-text);
  font-size: 0.88rem;
}

.intro-desc {
  font-size: 0.76rem;
  color: var(--color-text-lighter);
  line-height: 1.6;
}

.intro-action {
  font-size: 0.76rem;
  color: var(--color-accent);
  line-height: 1.6;
  font-weight: 500;
}

.search-loading,
.search-empty,
.search-intro {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 180px;
  font-size: 0.8rem;
  color: var(--color-text-lighter);
  gap: 10px;
  text-align: center;
}

.loading-spinner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-accent-soft);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.search-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-alt);
  cursor: pointer;
  transition: all 0.2s;
}

.search-item:hover {
  background: var(--color-accent-soft);
  transform: translateX(3px);
}

.item-thumb {
  width: 38px;
  height: 38px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.item-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.item-title {
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-badge {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  padding: 1px 5px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-lighter);
  flex-shrink: 0;
}

.item-badge.full {
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
}

.item-meta {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-play-action {
  padding: 4px 10px;
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  color: var(--color-accent);
  background: white;
  border: 1px solid var(--border-medium);
  flex-shrink: 0;
}

/* ── TAB 3: 当前歌单曲目 ── */
.tab-view-playlist {
  display: flex;
  flex-direction: column;
  height: 330px;
}

.playlist-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.76rem;
  color: var(--color-text-lighter);
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--border-light);
}

.playlist-hint {
  color: var(--color-accent);
  font-family: var(--font-mono);
}

.playlist-items-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.playlist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-alt);
  cursor: pointer;
  transition: all 0.2s;
}

.playlist-row:hover {
  background: var(--color-accent-soft);
}

.playlist-row.active {
  background: var(--color-accent-soft);
  border-left: 3px solid var(--color-accent);
}

.row-cover {
  width: 34px;
  height: 34px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.row-info {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

.row-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.row-title {
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-full {
  font-family: var(--font-mono);
  font-size: 0.62rem;
  padding: 0 4px;
  background: rgba(16, 185, 129, 0.15);
  color: #059669;
  border-radius: 2px;
  flex-shrink: 0;
}

.row-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.row-playing-icon {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-accent);
  font-weight: 600;
}

.row-duration {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

/* ── TAB 4: 网易云用户歌单卡片网格 ── */
.tab-view-user-playlists {
  display: flex;
  flex-direction: column;
  height: 330px;
}

.user-playlists-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  padding-right: 4px;
}

.user-playlist-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.user-playlist-card:hover {
  background: var(--color-accent-soft);
  border-color: rgba(124, 140, 110, 0.3);
  transform: translateY(-2px);
}

.card-cover-wrap {
  position: relative;
  width: 44px;
  height: 44px;
  flex-shrink: 0;
}

.pl-cover {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  object-fit: cover;
}

.pl-loading-tag {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
}

.pl-info {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.pl-name {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-count {
  font-size: 0.7rem;
  color: var(--color-text-lighter);
}

/* ── 底部控制栏 ── */
.controls-deck {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid var(--border-light);
}

.control-icon-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: var(--color-text-light);
  transition: all 0.25s var(--ease-spring);
}

.control-icon-btn:hover {
  color: var(--color-accent);
  background: var(--color-accent-soft);
  transform: scale(1.12);
}

.main-play-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px var(--color-accent-glow-strong);
  transition: all 0.3s var(--ease-spring);
}

.main-play-btn:hover {
  transform: scale(1.08);
  background: var(--color-accent-dark);
}

.volume-box {
  display: flex;
  align-items: center;
  gap: 6px;
}

.volume-slider {
  width: 65px;
  height: 4px;
  -webkit-appearance: none;
  background: var(--color-bg-alt);
  border-radius: 2px;
  outline: none;
}

.volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  transition: transform 0.2s;
}

.volume-slider::-webkit-slider-thumb:hover {
  transform: scale(1.25);
}

/* ── 3. 网易云登录弹窗 ── */
.login-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44, 38, 33, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 1100;
}

.login-card {
  width: 100%;
  max-width: 400px;
  background: var(--color-bg);
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  padding: 22px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
}

.login-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cloud-icon {
  font-size: 1.2rem;
}

.login-title {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
}

.login-mode-tabs {
  display: flex;
  gap: 6px;
  background: var(--color-bg-alt);
  padding: 3px;
  border-radius: var(--radius-sm);
  margin-bottom: 14px;
}

.qr-app-tip {
  font-size: 0.74rem;
  color: var(--color-text-lighter);
  text-align: center;
  line-height: 1.5;
  margin: 4px 0 6px 0;
}

/* ── 扫码视图与状态 ── */
.tab-pane-qr {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 0;
}

.qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.qr-no-api-notice {
  background: var(--color-bg-alt);
  border: 1px dashed var(--border-medium);
  border-radius: var(--radius-sm);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 10px;
}

.notice-icon {
  font-size: 1.8rem;
}

.notice-text strong {
  display: block;
  font-size: 0.9rem;
  color: var(--color-text);
  margin-bottom: 4px;
}

.notice-text p {
  font-size: 0.76rem;
  color: var(--color-text-light);
  line-height: 1.5;
}

.btn-goto-config {
  width: 100%;
  padding: 9px;
  background: #DC2626;
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-goto-config:hover {
  background: #B91C1C;
}

.or-separator {
  font-size: 0.7rem;
  color: var(--color-text-lighter);
}

.btn-use-uid-instead {
  font-size: 0.75rem;
  color: var(--color-accent);
  text-decoration: underline;
  background: transparent;
  cursor: pointer;
}

.qr-frame-wrap {
  position: relative;
  width: 156px;
  height: 156px;
  padding: 8px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.qr-frame-wrap.expired .qr-image {
  filter: blur(2px) grayscale(80%);
  opacity: 0.5;
}

.qr-image {
  width: 140px;
  height: 140px;
  display: block;
}

.qr-loading-layer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--color-text-lighter);
}

.loading-sub {
  font-size: 0.72rem;
}

.qr-expired-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
}

.qr-expired-overlay span {
  font-size: 0.75rem;
  font-weight: 600;
  color: #DC2626;
}

.btn-refresh-qr {
  padding: 4px 10px;
  background: var(--color-text);
  color: white;
  border-radius: 4px;
  font-size: 0.7rem;
}

.qr-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  border-radius: 20px;
  font-size: 0.75rem;
  color: var(--color-text);
  font-weight: 500;
  max-width: 90%;
  text-align: center;
}

.status-pulse-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.25);
  animation: liveDotPulse 1.6s infinite ease-in-out;
  flex-shrink: 0;
}

.qr-bottom-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  justify-content: center;
}

.btn-qr-action {
  padding: 5px 10px;
  background: var(--color-bg-alt);
  color: var(--color-text-light);
  border-radius: var(--radius-sm);
  font-size: 0.7rem;
  transition: all 0.2s;
}

.btn-qr-action:hover {
  background: rgba(124, 140, 110, 0.15);
  color: var(--color-accent);
}

/* ── 专属 API 配置模式 ── */
.tab-pane-config {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.config-desc-box {
  background: rgba(124, 140, 110, 0.08);
  border-left: 3px solid var(--color-accent);
  padding: 10px 12px;
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
}

.config-desc-title {
  display: block;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: 2px;
}

.config-desc-p {
  font-size: 0.74rem;
  color: var(--color-text-light);
  line-height: 1.5;
  margin: 0;
}

.api-input-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.input-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text);
}

.api-input-wrap {
  display: flex;
  gap: 8px;
}

.api-input {
  flex: 1;
  padding: 8px 12px;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-family: var(--font-mono);
  color: var(--color-text);
  outline: none;
  transition: border-color 0.2s;
}

.api-input:focus {
  border-color: var(--color-accent);
}

.btn-save-api {
  padding: 8px 14px;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
  white-space: nowrap;
  transition: background 0.2s;
}

.btn-save-api:hover:not(:disabled) {
  background: var(--color-accent-dark);
}

.api-test-feedback {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-family: var(--font-mono);
  padding: 4px 8px;
  border-radius: 4px;
}

.api-test-feedback.success {
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
}

.api-test-feedback.error {
  background: rgba(220, 38, 38, 0.1);
  color: #DC2626;
}

/* 一键部署 Vercel 引导卡片 */
.vercel-deploy-card {
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.deploy-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.deploy-card-title {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-text);
}

.deploy-card-tag {
  font-size: 0.65rem;
  padding: 2px 6px;
  border-radius: 10px;
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
  font-weight: 600;
}

.deploy-card-tip {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  line-height: 1.4;
  margin: 0;
}

.btn-one-click-vercel {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px;
  background: #000;
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.2s;
}

.btn-one-click-vercel:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.deploy-steps-mini {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  padding-top: 6px;
  border-top: 1px dashed var(--border-light);
}

.step-mini-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.68rem;
  color: var(--color-text-light);
}

.step-num {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--border-medium);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.6rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* API 状态微标 */
.api-status-badge-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
  font-size: 0.72rem;
}

.badge-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9CA3AF;
}

.badge-dot.active {
  background: #10B981;
}

.badge-text {
  flex: 1;
  color: var(--color-text-light);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--font-mono);
}

.btn-text-edit {
  background: transparent;
  color: var(--color-accent);
  font-size: 0.7rem;
  cursor: pointer;
}

.tab-dot-online {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  margin-left: 3px;
  vertical-align: middle;
}

/* 已登录个人卡片 */
.logged-in-profile {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.profile-main {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-sm);
}

.profile-avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid white;
}

.profile-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.profile-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.vip-tag {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: 3px;
  background: #DC2626;
  color: white;
  font-weight: 700;
}

.profile-uid {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.profile-playlists-count {
  font-size: 0.72rem;
  color: var(--color-accent);
}

.station-desc-box {
  display: flex;
  gap: 10px;
  background: var(--color-bg-alt);
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-accent);
  align-items: center;
}

.station-icon {
  font-size: 1.4rem;
  line-height: 1;
  flex-shrink: 0;
}

.station-text strong {
  display: block;
  font-size: 0.78rem;
  color: var(--color-text);
  margin-bottom: 2px;
}

.station-text p {
  font-size: 0.7rem;
  color: var(--color-text-light);
  line-height: 1.4;
  margin: 0;
}

.profile-actions {
  display: flex;
  gap: 10px;
}

.action-btn-sync {
  flex: 1;
  padding: 9px;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 500;
  transition: background 0.2s;
}

.action-btn-sync:hover {
  background: var(--color-accent-dark);
}

.action-btn-auth {
  padding: 9px 14px;
  background: var(--color-bg-alt);
  color: var(--color-text-light);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  transition: all 0.2s;
  cursor: pointer;
  white-space: nowrap;
}

.action-btn-auth:hover {
  color: var(--color-accent);
  border-color: var(--color-accent);
}

/* 进出过渡 */
.capsule-fade-enter-active,
.capsule-fade-leave-active {
  transition: all 0.3s var(--ease);
}
.capsule-fade-enter-from,
.capsule-fade-leave-to {
  opacity: 0;
  transform: translateY(20px) scale(0.9);
}

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: all 0.35s var(--ease-spring);
}
.modal-pop-enter-from,
.modal-pop-leave-to {
  opacity: 0;
  transform: scale(0.92);
}

@media (max-width: 600px) {
  .player-capsule {
    left: 16px;
    bottom: 24px;
    padding: 6px 10px 6px 6px;
  }
  .capsule-info { max-width: 85px; }
  .player-card { padding: 18px; }
  .turntable-deck { width: 170px; height: 170px; }
  .vinyl-record { width: 160px; height: 160px; }
  .volume-slider { width: 45px; }
  .user-playlists-grid { grid-template-columns: 1fr; }
}
</style>
