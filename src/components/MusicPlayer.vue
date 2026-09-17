<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { useNeteaseAuth } from '@/composables/useNeteaseAuth'
import { useLyrics } from '@/composables/useLyrics'
import type { Track } from '@/data/playlist'

const {
  playlist,
  currentTrackIndex,
  currentTrack,
  isPlaying,
  isLoading,
  playbackStatus,
  playbackError,
  currentTime,
  duration,
  volume,
  isMuted,
  isExpanded,
  searchResults,
  isSearching,
  searchError,
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
  playMode,
  togglePlayMode,
} = useAudioPlayer()

const {
  stationUser,
  userPlaylists,
  currentLoadingPlaylistId,
  apiUrl,
  isApiConnected,
  apiLatency,
  apiTesting,
  apiTestMessage,
  testCurrentApi,
  syncOwnerData,
  loadPlaylistTracks,
} = useNeteaseAuth()

const {
  currentLyrics,
  currentLineIndex,
  isLoadingLyrics,
  hasLyrics,
  isInstrumental,
} = useLyrics()

// ── 播放器导航标签 ──
// 'player' 唱机 | 'lyrics' 歌词 | 'search' 搜歌 | 'playlist' 队列 | 'user-playlists' 歌单
export type ConsoleTab = 'player' | 'lyrics' | 'search' | 'playlist' | 'user-playlists'
const activeTab = ref<ConsoleTab>('player')

const searchKeyword = ref('')
const hotTags = ['夏天的风', '起风了', '坂本龙一', '千与千寻', '周杰伦', 'Lofi']
const showNeteaseModal = ref(false)

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

// ── 交互式进度条 (拖拽拖动 + 悬停时间预览) ──
const isScrubbing = ref(false)
const scrubTime = ref(0)
const hoverPct = ref(0)
const showHoverTooltip = ref(false)
const hoverTooltipX = ref(0)

const displayCurrentTime = computed(() => {
  return isScrubbing.value ? scrubTime.value : currentTime.value
})

const progressPercent = computed(() => {
  const dur = duration.value || 1
  const t = displayCurrentTime.value
  return Math.min(100, Math.max(0, (t / dur) * 100))
})

function updateScrubFromEvent(e: PointerEvent, container: HTMLElement) {
  const rect = container.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const pct = Math.max(0, Math.min(1, clickX / rect.width))
  scrubTime.value = pct * (duration.value || 180)
  hoverTooltipX.value = Math.max(0, Math.min(rect.width, clickX))
  hoverPct.value = pct
}

function handleProgressPointerDown(e: PointerEvent) {
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture(e.pointerId)
  isScrubbing.value = true
  showHoverTooltip.value = true
  updateScrubFromEvent(e, target)

  const onPointerMove = (ev: PointerEvent) => {
    if (!isScrubbing.value) return
    updateScrubFromEvent(ev, target)
  }

  const onPointerUp = (ev: PointerEvent) => {
    if (isScrubbing.value) {
      seek(scrubTime.value)
      isScrubbing.value = false
    }
    showHoverTooltip.value = false
    target.removeEventListener('pointermove', onPointerMove)
    target.removeEventListener('pointerup', onPointerUp)
  }

  target.addEventListener('pointermove', onPointerMove)
  target.addEventListener('pointerup', onPointerUp)
}

function handleProgressMouseMove(e: MouseEvent) {
  if (isScrubbing.value) return
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const x = e.clientX - rect.left
  hoverTooltipX.value = Math.max(0, Math.min(rect.width, x))
  hoverPct.value = Math.max(0, Math.min(1, x / rect.width))
  showHoverTooltip.value = true
}

function handleProgressMouseLeave() {
  if (!isScrubbing.value) {
    showHoverTooltip.value = false
  }
}

function handleVolumeChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  setVolume(val / 100)
}

const playModeTitle = computed(() => {
  if (playMode.value === 'sequence') return '列表循环'
  if (playMode.value === 'loop-one') return '单曲循环'
  return '随机播放'
})

// ── 自然流体声波 Canvas (Morandi Organic Wave Visualizer) ──
const canvasRef = ref<HTMLCanvasElement | null>(null)
let animId: number | null = null

function initCanvasDpr() {
  const canvas = canvasRef.value
  if (!canvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const rect = canvas.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) {
    canvas.width = Math.round(rect.width * dpr)
    canvas.height = Math.round(rect.height * dpr)
  }
}

function drawSpectrum() {
  if (animId !== null) cancelAnimationFrame(animId)

  const barCount = 28
  const dataArray = new Float32Array(barCount)

  const render = () => {
    animId = requestAnimationFrame(render)
    const canvas = canvasRef.value
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    if (w <= 0 || h <= 0) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.scale(dpr, dpr)

    const t = Date.now() * 0.003
    if (isPlaying.value) {
      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2)
        const bellCurve = 1 - centerDist * 0.45
        const wave1 = Math.sin(t * 2.5 + i * 0.42) * 0.4 + 0.45
        const wave2 = Math.cos(t * 1.6 - i * 0.28) * 0.25
        const wave3 = Math.sin(t * 4.2 + i * 0.75) * 0.15
        const targetVal = Math.max(0.12, Math.min(0.96, (wave1 + wave2 + wave3) * bellCurve))
        dataArray[i] += (targetVal - dataArray[i]) * 0.22
      }
    } else {
      for (let i = 0; i < barCount; i++) {
        const targetVal = Math.sin(i * 0.35 + t * 0.8) * 0.03 + 0.07
        dataArray[i] += (targetVal - dataArray[i]) * 0.08
      }
    }

    const barWidth = Math.max(2.5, (w / barCount) * 0.52)
    const totalBarsWidth = barWidth * barCount
    const gap = Math.max(1.8, (w - totalBarsWidth) / (barCount - 1))

    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i] || 0.06
      const barHeight = Math.max(3.5, val * (h * 0.88))
      const x = i * (barWidth + gap)
      const y = (h - barHeight) / 2

      // 莫兰迪绿与大地暖金柔和渐变
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
      gradient.addColorStop(0, '#7C8C6E')
      gradient.addColorStop(0.5, '#9AAB8B')
      gradient.addColorStop(1, '#C4A882')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, [barWidth / 2, barWidth / 2, barWidth / 2, barWidth / 2])
      ctx.fill()
    }
  }

  render()
}

// ── 歌词滚动与点击寻轨 ──
const lyricsScrollContainer = ref<HTMLElement | null>(null)
const lyricLineRefs = ref<HTMLElement[]>([])
let isUserScrollingLyrics = false
let userScrollTimer: number | null = null

function setLyricLineRef(el: any, idx: number) {
  if (el) {
    lyricLineRefs.value[idx] = el as HTMLElement
  }
}

function handleUserLyricScroll() {
  isUserScrollingLyrics = true
  if (userScrollTimer) clearTimeout(userScrollTimer)
  userScrollTimer = window.setTimeout(() => {
    isUserScrollingLyrics = false
    scrollToActiveLyric(true)
  }, 2500)
}

function scrollToActiveLyric(smooth = true) {
  if (isUserScrollingLyrics) return
  if (!lyricsScrollContainer.value) return
  const activeIdx = currentLineIndex.value
  if (activeIdx < 0) return
  const el = lyricLineRefs.value[activeIdx]
  if (!el) return

  const container = lyricsScrollContainer.value
  const targetTop = el.offsetTop - container.clientHeight / 2 + el.clientHeight / 2

  container.scrollTo({
    top: Math.max(0, targetTop),
    behavior: smooth ? 'smooth' : 'auto',
  })
}

function handleLyricClick(time: number) {
  seek(time)
  isUserScrollingLyrics = false
  if (userScrollTimer) clearTimeout(userScrollTimer)
}

watch(currentLineIndex, () => {
  if (activeTab.value === 'lyrics') {
    scrollToActiveLyric(true)
  }
})

watch(activeTab, (tab) => {
  if (tab === 'player') {
    nextTick(() => {
      initCanvasDpr()
      drawSpectrum()
    })
  } else if (tab === 'lyrics') {
    nextTick(() => {
      scrollToActiveLyric(false)
    })
  }
})

watch(isExpanded, (val) => {
  if (val && activeTab.value === 'player') {
    setTimeout(() => {
      initCanvasDpr()
      drawSpectrum()
    }, 100)
  }
})

watch(currentLyrics, () => {
  lyricLineRefs.value = []
  if (activeTab.value === 'lyrics') {
    nextTick(() => {
      scrollToActiveLyric(false)
    })
  }
})

onMounted(() => {
  initCanvasDpr()
  drawSpectrum()
})

onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId)
  if (userScrollTimer) clearTimeout(userScrollTimer)
})
</script>

<template>
  <div class="morandi-player-wrapper">
    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 1. 悬浮微胶囊态 (Floating Porcelain Capsule Dock)       -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="capsule-fade">
      <div
        v-if="!isExpanded"
        class="porcelain-capsule"
        @click="toggleExpand"
        title="点击展开专属音乐电台"
      >
        <!-- 黑胶小唱片微盘 -->
        <div class="capsule-vinyl-disk" :class="{ spinning: isPlaying }">
          <img :src="currentTrack.coverUrl" alt="cover" class="capsule-thumb" />
          <div class="vinyl-core-dot"></div>
        </div>

        <div class="capsule-meta">
          <div class="capsule-title-row">
            <span class="capsule-title">{{ currentTrack.title }}</span>
            <span v-if="currentTrack.isTrial" class="capsule-badge trial">试听</span>
            <span v-else-if="currentTrack.isFull" class="capsule-badge full">全曲</span>
          </div>
          <span class="capsule-artist">{{ currentTrack.artist }}</span>
        </div>

        <!-- 莫兰迪绿律动微波 -->
        <div class="capsule-wave-bars">
          <span class="w-bar wb-1" :class="{ active: isPlaying }"></span>
          <span class="w-bar wb-2" :class="{ active: isPlaying }"></span>
          <span class="w-bar wb-3" :class="{ active: isPlaying }"></span>
        </div>

        <!-- 播放/暂停轻触微键 -->
        <button
          class="capsule-toggle-btn"
          @click.stop="togglePlay"
          :aria-label="isPlaying ? '暂停' : '播放'"
        >
          <span v-if="isLoading" class="capsule-spinner"></span>
          <svg v-else-if="!isPlaying" width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 2. 展开态温润瓷白大卡片 (Expanded Porcelain Player)    -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="player-modal-fade">
      <div v-if="isExpanded" class="player-scrim" @click.self="toggleExpand">
        <div class="player-porcelain-card">
          <!-- ── 顶栏：电台身份与分段导航 ── -->
          <div class="card-header-suite">
            <div class="station-identity-row">
              <div
                class="station-badge"
                @click="showNeteaseModal = true"
                title="点击查看电台节点与服务状态"
              >
                <div class="avatar-ring">
                  <img :src="stationUser.avatarUrl" alt="avatar" class="station-avatar-img" />
                  <span class="station-pulse-dot" :class="{ connected: isApiConnected }"></span>
                </div>
                <div class="station-label-bay">
                  <div class="station-title-line">
                    <span class="station-nick">{{ stationUser.nickname }}</span>
                    <span class="station-pill">精选电台</span>
                  </div>
                  <span class="station-caption">{{ userPlaylists.length }} 张精选歌单 · 沉浸聆听</span>
                </div>
              </div>

              <button class="player-close-btn" @click="toggleExpand" aria-label="收起播放器">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- 扁平优雅的分段切换栏 (Segmented Nav Tabs) -->
            <div class="segmented-nav-bar">
              <button
                class="nav-tab-pill"
                :class="{ active: activeTab === 'player' }"
                @click="activeTab = 'player'"
              >
                唱盘
              </button>
              <button
                class="nav-tab-pill"
                :class="{ active: activeTab === 'lyrics' }"
                @click="activeTab = 'lyrics'"
              >
                歌词
                <span v-if="hasLyrics" class="lyrics-dot-indicator"></span>
              </button>
              <button
                class="nav-tab-pill"
                :class="{ active: activeTab === 'search' }"
                @click="activeTab = 'search'"
              >
                搜歌
              </button>
              <button
                class="nav-tab-pill"
                :class="{ active: activeTab === 'playlist' }"
                @click="activeTab = 'playlist'"
              >
                当前 ({{ playlist.length }})
              </button>
              <button
                class="nav-tab-pill highlight"
                :class="{ active: activeTab === 'user-playlists' }"
                @click="activeTab = 'user-playlists'"
              >
                精选 ({{ userPlaylists.length }})
              </button>
            </div>
          </div>

          <!-- ── 中部内容区 (Main Content Bay) ── -->
          <div class="card-body-viewport">
            <!-- TAB 1: 黑胶唱片主视角 (Turntable View) -->
            <div v-if="activeTab === 'player'" class="tab-page-player">
              <!-- 拟物黑胶唱片 (点击唱片直接翻转至歌词) -->
              <div
                class="vinyl-stage"
                @click="activeTab = 'lyrics'"
                title="点击唱片切换至歌词视图"
              >
                <div class="vinyl-record-platter" :class="{ spinning: isPlaying }">
                  <div class="vinyl-groove g-1"></div>
                  <div class="vinyl-groove g-2"></div>
                  <div class="vinyl-groove g-3"></div>
                  <div class="vinyl-soft-reflection"></div>

                  <!-- 唱片中心封面与黄铜锁轴 -->
                  <div class="vinyl-center-label">
                    <img :src="currentTrack.coverUrl" alt="cover" class="label-artwork" />
                    <div class="spindle-brass-pin"></div>
                  </div>
                </div>

                <div class="turntable-hover-tag">
                  <span>查看歌词 ⇄</span>
                </div>
              </div>

              <!-- 曲目信息 -->
              <div class="track-meta-section">
                <div class="title-flex-row">
                  <h3 class="track-main-title" :title="currentTrack.title">{{ currentTrack.title }}</h3>
                  <span v-if="playbackStatus === 'resolving'" class="morandi-tag resolving">
                    ● 解析直链中
                  </span>
                  <span v-else-if="playbackStatus === 'error'" class="morandi-tag error" :title="playbackError">
                    ⚠️ 播放受阻
                  </span>
                  <span v-else class="morandi-tag" :class="{ full: currentTrack.isFull, trial: currentTrack.isTrial }">
                    {{ currentTrack.isTrial ? '◐ 试听采样 (30秒)' : (currentTrack.isFull ? '● 完整全曲' : '○ 试听采样') }}
                  </span>
                </div>
                <p class="track-sub-artist">
                  <span v-if="playbackStatus === 'error' && playbackError" class="err-hint">{{ playbackError }}</span>
                  <span v-else>{{ currentTrack.artist }} · {{ currentTrack.album }}</span>
                </p>
              </div>

              <!-- 实时声波频谱 (Morandi Organic Waveform) -->
              <div class="visualizer-container">
                <canvas ref="canvasRef" class="wave-canvas"></canvas>
              </div>

              <!-- 交互式细线进度条 (Interactive Timeline) -->
              <div class="timeline-section">
                <div
                  class="timeline-track-wrap"
                  @pointerdown="handleProgressPointerDown"
                  @mousemove="handleProgressMouseMove"
                  @mouseleave="handleProgressMouseLeave"
                >
                  <div
                    v-if="showHoverTooltip"
                    class="timeline-tooltip"
                    :style="{ left: `${hoverTooltipX}px` }"
                  >
                    {{ formatTime(hoverPct * (duration || 180)) }}
                  </div>

                  <div class="timeline-track-rail"></div>
                  <div class="timeline-fill-rail" :style="{ width: `${progressPercent}%` }">
                    <div class="timeline-thumb" :class="{ dragging: isScrubbing, pulse: isPlaying }"></div>
                  </div>
                </div>

                <div class="timeline-time-labels">
                  <span>{{ formatTime(displayCurrentTime) }}</span>
                  <span>{{ formatTime(duration) }}</span>
                </div>
              </div>
            </div>

            <!-- TAB 2: 诗集式实时同步歌词 (Poetic Live Lyrics) -->
            <div v-else-if="activeTab === 'lyrics'" class="tab-page-lyrics">
              <div class="lyrics-header-strip">
                <div class="lyrics-status-indicator">
                  <span class="status-pulse-dot" :class="{ active: isPlaying }"></span>
                  <span class="status-text">{{ isPlaying ? '实时同步' : '已暂停' }}</span>
                </div>
                <span v-if="currentTrack.isTrial" class="lyrics-trial-tip">试听片段 · 歌词将随音轨同步</span>
              </div>

              <div
                ref="lyricsScrollContainer"
                class="lyrics-scroll-viewport"
                @wheel="handleUserLyricScroll"
                @touchstart="handleUserLyricScroll"
              >
                <!-- 加载状态 -->
                <div v-if="isLoadingLyrics" class="lyrics-empty-state">
                  <span class="morandi-spinner"></span>
                  <p>正在寻找歌词灵感...</p>
                </div>

                <!-- 纯音乐或未收录 -->
                <div
                  v-else-if="isInstrumental || currentLyrics.length === 0"
                  class="lyrics-empty-state instrumental"
                >
                  <div class="note-floating-icon">♪</div>
                  <p class="inst-headline">纯音乐 · 请沉浸欣赏</p>
                  <p class="inst-subtitle">无歌词收录，静心聆听音符流淌</p>
                </div>

                <!-- 歌词行列表 -->
                <div v-else class="lyrics-verse-list">
                  <div class="verse-spacer"></div>
                  <div
                    v-for="(line, idx) in currentLyrics"
                    :key="line.id"
                    :ref="(el) => setLyricLineRef(el, idx)"
                    class="lyric-verse-item"
                    :class="{
                      active: idx === currentLineIndex,
                      passed: idx < currentLineIndex,
                      future: idx > currentLineIndex
                    }"
                    @click="handleLyricClick(line.time)"
                    :title="`点击跳转至 ${formatTime(line.time)}`"
                  >
                    <p class="verse-text">{{ line.text }}</p>
                    <p v-if="line.translation" class="verse-trans">{{ line.translation }}</p>
                  </div>
                  <div class="verse-spacer"></div>
                </div>
              </div>
            </div>

            <!-- TAB 3: 云端搜歌 (Search View) -->
            <div v-else-if="activeTab === 'search'" class="tab-page-search">
              <div class="search-bar-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-svg">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="morandi-search-input"
                  placeholder="搜索曲名、艺术家，或网易云单曲 ID"
                  @keyup.enter="handleSearch()"
                />
                <button class="search-confirm-btn" @click="handleSearch()">搜索</button>
              </div>

              <!-- 热门风格标签 -->
              <div class="hot-chips-row">
                <span class="chips-label">常听风格:</span>
                <button
                  v-for="tag in hotTags"
                  :key="tag"
                  class="hot-chip-btn"
                  @click="handleSearch(tag)"
                >
                  {{ tag }}
                </button>
              </div>

              <!-- 搜索结果列表 -->
              <div class="search-list-scroll">
                <div v-if="isSearching" class="search-state-msg">
                  <span class="morandi-spinner"></span>
                  <span>正在全网曲库检索中...</span>
                </div>

                <div v-else-if="searchError" class="search-state-msg error">
                  {{ searchError }}
                </div>

                <div v-else-if="searchResults.length === 0" class="search-intro-card">
                  <span class="intro-leaf-icon">🍃</span>
                  <span class="intro-card-title">在旋律中漫步</span>
                  <p class="intro-card-desc">输入喜欢的曲目或歌手，为当下的思绪配一首背景音。</p>
                </div>

                <div v-else class="results-flow">
                  <div
                    v-for="item in searchResults"
                    :key="item.id"
                    class="song-card-row"
                    @click="handleSelectSearchResult(item)"
                  >
                    <img :src="item.coverUrl" alt="cover" class="row-cover-thumb" />
                    <div class="row-meta-col">
                      <span class="row-title">{{ item.title }}</span>
                      <span class="row-artist">{{ item.artist }} · {{ item.album }}</span>
                    </div>
                    <button class="row-play-btn" title="立即播放">播放</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 4: 当前播放队列 (Queue View) -->
            <div v-else-if="activeTab === 'playlist'" class="tab-page-queue">
              <div class="queue-header-row">
                <span>当前播放队列 ({{ playlist.length }})</span>
                <span class="queue-mode-hint">{{ playModeTitle }}</span>
              </div>

              <div class="queue-list-scroll">
                <div
                  v-for="(item, idx) in playlist"
                  :key="item.id"
                  class="queue-track-item"
                  :class="{ playing: idx === currentTrackIndex }"
                  @click="selectTrack(idx)"
                >
                  <span class="queue-index-num">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <img :src="item.coverUrl" alt="cover" class="queue-thumb-img" />
                  <div class="queue-info-col">
                    <span class="queue-song-title">{{ item.title }}</span>
                    <span class="queue-song-artist">{{ item.artist }}</span>
                  </div>
                  <span v-if="idx === currentTrackIndex && isPlaying" class="queue-status-pill">播放中</span>
                  <span v-else class="queue-time">{{ formatTime(item.duration) }}</span>
                </div>
              </div>
            </div>

            <!-- TAB 5: 站长精选公开歌单 (Curated Playlists View) -->
            <div v-else-if="activeTab === 'user-playlists'" class="tab-page-playlists">
              <div class="playlists-header-row">
                <span>{{ stationUser.nickname }} 的日常精选歌单 ({{ userPlaylists.length }})</span>
                <span class="playlists-hint">点击载入整张歌单</span>
              </div>

              <div class="playlists-cards-scroll">
                <div
                  v-for="pl in userPlaylists"
                  :key="pl.id"
                  class="playlist-item-card"
                  :class="{ loading: currentLoadingPlaylistId === pl.id }"
                  @click="handleSelectNeteasePlaylist(pl.id)"
                >
                  <div class="pl-cover-box">
                    <img :src="pl.coverImgUrl" alt="cover" class="pl-cover-img" />
                    <span v-if="currentLoadingPlaylistId === pl.id" class="pl-loading-cover">
                      <span class="morandi-spinner-sm"></span>
                    </span>
                  </div>
                  <div class="pl-info-col">
                    <span class="pl-card-title" :title="pl.name">{{ pl.name }}</span>
                    <span class="pl-card-meta">{{ pl.trackCount }} 首歌曲 · 灵感歌单</span>
                  </div>
                  <button class="pl-mount-btn" :disabled="currentLoadingPlaylistId === pl.id">
                    {{ currentLoadingPlaylistId === pl.id ? '载入中...' : '载入歌单' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── 底部控制栏：陶瓷触感按键组 (Controls Deck) ── -->
          <div class="player-controls-deck">
            <!-- 播放模式切换 -->
            <button
              class="control-btn mode-btn"
              @click="togglePlayMode"
              :title="`播放模式: ${playModeTitle} (点击切换)`"
              :aria-label="`播放模式: ${playModeTitle}`"
            >
              <!-- 顺序播放 -->
              <svg v-if="playMode === 'sequence'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <!-- 单曲循环 -->
              <svg v-else-if="playMode === 'loop-one'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <text x="12" y="15" font-size="8" font-family="monospace" font-weight="bold" fill="currentColor" text-anchor="middle">1</text>
              </svg>
              <!-- 随机播放 -->
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </button>

            <!-- 上一首 -->
            <button class="control-btn" @click="prevTrack" title="上一首">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 主播放/暂停 (莫兰迪绿核心按键) -->
            <button class="primary-play-btn" @click="togglePlay" :aria-label="isPlaying ? '暂停' : '播放'">
              <span v-if="isLoading" class="primary-spinner"></span>
              <svg v-else-if="!isPlaying" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>

            <!-- 下一首 -->
            <button class="control-btn" @click="nextTrack" title="下一首">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 音量调节推子 -->
            <div class="volume-slider-bay">
              <button class="control-btn vol-icon-btn" @click="toggleMute" title="静音切换">
                <svg v-if="isMuted || volume === 0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
                <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
              <input
                type="range"
                min="0"
                max="100"
                :value="isMuted ? 0 : volume * 100"
                class="morandi-vol-range"
                @input="handleVolumeChange"
                title="音量调节"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 3. 云端电台与节点状态弹窗 (Station Diagnostic Modal)    -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="modal-pop">
      <div v-if="showNeteaseModal" class="station-modal-scrim" @click.self="showNeteaseModal = false">
        <div class="station-modal-card">
          <div class="station-modal-header">
            <div class="modal-header-left">
              <span class="tea-icon">☕</span>
              <span class="modal-title">var 的专属音乐电台</span>
            </div>
            <button class="modal-close-btn" @click="showNeteaseModal = false">✕</button>
          </div>

          <div class="station-modal-body">
            <!-- 站长信息 -->
            <div class="owner-profile-card">
              <img :src="stationUser.avatarUrl" alt="avatar" class="owner-avatar" />
              <div class="owner-meta">
                <span class="owner-name">{{ stationUser.nickname }}</span>
                <span class="owner-desc">站长个人电台 · 免登录畅听精选歌单</span>
              </div>
            </div>

            <!-- API 节点连接信息 -->
            <div class="node-status-card">
              <span class="node-label">云端曲库接口节点</span>
              <div class="node-url-row">
                <code>{{ apiUrl }}</code>
                <span class="node-badge" :class="{ ok: isApiConnected }">
                  {{ isApiConnected ? `已连接 (${apiLatency}ms)` : '未连通' }}
                </span>
              </div>
              <p v-if="apiTestMessage" class="node-hint">{{ apiTestMessage }}</p>
              <button
                class="node-test-btn"
                :disabled="apiTesting"
                @click="testCurrentApi()"
              >
                {{ apiTesting ? '测试中...' : '测试节点延迟' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* ═══════════════════════════════════════════════════════════════
   莫兰迪自然与侘寂美学音乐系统 (MORANDI WABI-SABI MUSIC SYSTEM)
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. 悬浮瓷白微胶囊 (Porcelain Capsule Dock) ── */
.porcelain-capsule {
  position: fixed;
  left: 24px;
  bottom: 28px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px 8px 8px;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  box-shadow:
    0 14px 36px -4px rgba(44, 38, 33, 0.16),
    0 4px 12px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  cursor: pointer;
  transition: all 0.28s var(--ease);
  user-select: none;
}

.porcelain-capsule:hover {
  transform: translateY(-2px);
  box-shadow:
    0 18px 42px -4px rgba(44, 38, 33, 0.22),
    0 6px 16px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 1);
  border-color: rgba(124, 140, 110, 0.4);
}

/* 微型黑胶旋转小圆盘 */
.capsule-vinyl-disk {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: radial-gradient(circle, #2C2825 0%, #151312 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow:
    0 4px 10px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1.5px rgba(255, 255, 255, 0.15);
}

.capsule-vinyl-disk.spinning {
  animation: vinyl-turn 10s linear infinite;
}

@keyframes vinyl-turn {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.capsule-thumb {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  object-fit: cover;
}

.vinyl-core-dot {
  position: absolute;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-warm);
  border: 1px solid #FAF7F2;
}

/* 胶囊信息 */
.capsule-meta {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
  max-width: 140px;
}

.capsule-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.capsule-title {
  font-family: var(--font-serif);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.capsule-badge {
  font-size: 0.6rem;
  padding: 1px 5px;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  white-space: nowrap;
}

.capsule-badge.full {
  background: rgba(124, 140, 110, 0.15);
  color: var(--color-accent-dark);
}

.capsule-badge.trial {
  background: rgba(196, 168, 130, 0.2);
  color: #A67B48;
}

.capsule-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 律动微波 */
.capsule-wave-bars {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.w-bar {
  width: 2.5px;
  background: var(--border-medium);
  border-radius: 1px;
}
.w-bar.wb-1 { height: 5px; }
.w-bar.wb-2 { height: 10px; }
.w-bar.wb-3 { height: 7px; }

.w-bar.active {
  background: var(--color-accent);
  animation: bar-flow 1.2s ease-in-out infinite alternate;
}
.w-bar.wb-1.active { animation-delay: 0.1s; }
.w-bar.wb-2.active { animation-delay: 0.3s; }
.w-bar.wb-3.active { animation-delay: 0.2s; }

@keyframes bar-flow {
  0% { height: 4px; }
  100% { height: 14px; }
}

/* 播放轻触按钮 */
.capsule-toggle-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 8px var(--color-accent-glow);
  transition: all 0.2s var(--ease);
  flex-shrink: 0;
}

.capsule-toggle-btn:hover {
  background: var(--color-accent-dark);
  transform: scale(1.08);
}

.capsule-spinner {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── 2. 展开态温润瓷白大卡片 (Expanded Porcelain Player) ── */
.player-scrim {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(36, 32, 28, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.player-porcelain-card {
  width: 100%;
  max-width: 460px;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  border-radius: 24px;
  box-shadow:
    0 32px 80px -12px rgba(28, 22, 18, 0.45),
    0 8px 24px rgba(0, 0, 0, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* 顶栏与标签 */
.card-header-suite {
  padding: 20px 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.station-identity-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.station-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 4px 12px 4px 4px;
  border-radius: var(--radius-full);
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  transition: all 0.25s var(--ease);
}

.station-badge:hover {
  border-color: var(--color-accent);
  background: #FFFFFF;
  transform: translateY(-1px);
}

.avatar-ring {
  position: relative;
  width: 32px;
  height: 32px;
}

.station-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.station-pulse-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9CA3AF;
  border: 1.5px solid #FAF7F2;
}

.station-pulse-dot.connected {
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
}

.station-label-bay {
  display: flex;
  flex-direction: column;
}

.station-title-line {
  display: flex;
  align-items: center;
  gap: 6px;
}

.station-nick {
  font-family: var(--font-serif);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.station-pill {
  font-size: 0.62rem;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
  font-weight: 500;
}

.station-caption {
  font-size: 0.7rem;
  color: var(--color-text-lighter);
}

.player-close-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  color: var(--color-text-lighter);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.25s var(--ease);
}

.player-close-btn:hover {
  background: #FFFFFF;
  color: var(--color-text);
  border-color: var(--border-medium);
  transform: rotate(90deg);
}

/* 分段选项卡栏 */
.segmented-nav-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #EDE8E2;
  padding: 3px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-light);
}

.nav-tab-pill {
  flex: 1;
  position: relative;
  padding: 6px 0;
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--color-text-light);
  border-radius: var(--radius-full);
  cursor: pointer;
  text-align: center;
  transition: all 0.22s var(--ease);
}

.nav-tab-pill:hover {
  color: var(--color-text);
}

.nav-tab-pill.active {
  background: #FAF7F2;
  color: var(--color-text);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(45, 40, 35, 0.08);
}

.nav-tab-pill.highlight {
  color: var(--color-accent);
}

.lyrics-dot-indicator {
  position: absolute;
  top: 6px;
  right: 14px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
}

/* ── 中部内容区 (Card Body Viewport) ── */
.card-body-viewport {
  padding: 6px 24px 14px;
  min-height: 360px;
  max-height: 390px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ── TAB 1: 唱盘主视角 ── */
.tab-page-player {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.vinyl-stage {
  position: relative;
  width: 200px;
  height: 200px;
  margin: 0 auto 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.vinyl-record-platter {
  width: 196px;
  height: 196px;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle,
      rgba(255, 255, 255, 0.025) 0px,
      rgba(255, 255, 255, 0.025) 1px,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(circle, #252220 0%, #151312 100%);
  position: relative;
  box-shadow:
    0 18px 40px rgba(40, 34, 28, 0.38),
    0 2px 10px rgba(0, 0, 0, 0.15),
    inset 0 0 0 2px #342F2B;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  transition: transform 0.3s var(--ease);
}

.vinyl-stage:hover .vinyl-record-platter {
  transform: scale(1.02);
}

.vinyl-record-platter.spinning {
  animation: vinyl-spin 12s linear infinite;
}

@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.vinyl-groove {
  position: absolute;
  border-radius: 50%;
}
.g-1 { width: 164px; height: 164px; border: 1px solid rgba(255, 255, 255, 0.04); }
.g-2 { width: 134px; height: 134px; border: 1px dashed rgba(255, 255, 255, 0.05); }
.g-3 { width: 104px; height: 104px; border: 1px solid rgba(255, 255, 255, 0.04); }

.vinyl-soft-reflection {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 35deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.08) 35deg,
    transparent 90deg,
    transparent 180deg,
    rgba(255, 255, 255, 0.08) 215deg,
    transparent 270deg
  );
  pointer-events: none;
}

.vinyl-center-label {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  border: 2px solid #C4A882;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.label-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.spindle-brass-pin {
  position: absolute;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #C4A882;
  border: 1.5px solid #252220;
}

.turntable-hover-tag {
  position: absolute;
  bottom: 4px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: rgba(250, 247, 242, 0.9);
  border: 1px solid var(--border-medium);
  font-size: 0.68rem;
  color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 0.25s var(--ease);
}

.vinyl-stage:hover .turntable-hover-tag {
  opacity: 1;
}

/* 曲目信息 */
.track-meta-section {
  text-align: center;
  margin-bottom: 6px;
  width: 100%;
}

.title-flex-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 3px;
}

.track-main-title {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 250px;
}

.morandi-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 1px 7px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-lighter);
}

.morandi-tag.full {
  background: rgba(124, 140, 110, 0.15);
  color: var(--color-accent-dark);
  font-weight: 500;
}

.morandi-tag.trial {
  background: rgba(196, 168, 130, 0.2);
  color: #B48855;
  font-weight: 500;
}

.morandi-tag.resolving {
  background: rgba(59, 130, 246, 0.12);
  color: #2563EB;
}

.morandi-tag.error {
  background: rgba(239, 68, 68, 0.12);
  color: #DC2626;
}

.track-sub-artist {
  font-size: 0.8rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.err-hint { color: #DC2626; }

/* 声波画布 */
.visualizer-container {
  width: 100%;
  height: 26px;
  margin-bottom: 8px;
}

.wave-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* 进度条 */
.timeline-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.timeline-track-wrap {
  position: relative;
  height: 18px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.timeline-tooltip {
  position: absolute;
  top: -24px;
  transform: translateX(-50%);
  padding: 2px 6px;
  background: var(--color-text);
  color: #FAF7F2;
  border-radius: var(--radius-xs);
  font-family: var(--font-mono);
  font-size: 0.68rem;
  pointer-events: none;
  white-space: nowrap;
}

.timeline-track-rail {
  width: 100%;
  height: 4px;
  background: var(--border-medium);
  border-radius: 2px;
}

.timeline-fill-rail {
  position: absolute;
  left: 0;
  height: 4px;
  background: var(--color-accent);
  border-radius: 2px;
  pointer-events: none;
}

.timeline-thumb {
  position: absolute;
  right: -5px;
  top: -4px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2px solid var(--color-accent);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
  transition: transform 0.2s var(--ease);
}

.timeline-thumb.dragging {
  transform: scale(1.3);
}

.timeline-time-labels {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

/* ── TAB 2: 诗集式歌词视窗 ── */
.tab-page-lyrics {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F4EFEB;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;
}

.lyrics-header-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 6px;
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.lyrics-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #B0AAA0;
}

.status-pulse-dot.active {
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
  animation: pulse-dot 1.8s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.lyrics-trial-tip {
  color: #B48855;
  font-size: 0.68rem;
}

.lyrics-scroll-viewport {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0 20px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 16%,
    black 84%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    black 16%,
    black 84%,
    transparent 100%
  );
}
.lyrics-scroll-viewport::-webkit-scrollbar { display: none; }

.verse-spacer {
  height: 110px;
  flex-shrink: 0;
}

.lyrics-verse-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
}

.lyric-verse-item {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.28s var(--ease);
  user-select: none;
}

.verse-text {
  font-family: var(--font-serif);
  font-size: 0.98rem;
  line-height: 1.5;
  color: #8C8880;
  transition: all 0.25s var(--ease);
  margin: 0;
}

.verse-trans {
  font-size: 0.78rem;
  line-height: 1.4;
  color: #A39F97;
  margin: 4px 0 0;
  transition: all 0.25s var(--ease);
}

.lyric-verse-item.active {
  transform: scale(1.06);
}

.lyric-verse-item.active .verse-text {
  font-size: 1.18rem;
  font-weight: 600;
  color: var(--color-accent-dark);
  text-shadow: 0 2px 10px rgba(124, 140, 110, 0.2);
}

.lyric-verse-item.active .verse-trans {
  font-size: 0.86rem;
  color: var(--color-text);
  font-weight: 500;
}

.lyric-verse-item:hover:not(.active) {
  background: rgba(124, 140, 110, 0.08);
}

.lyric-verse-item:hover:not(.active) .verse-text {
  color: var(--color-text);
}

.lyrics-empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 40px;
  color: var(--color-text-lighter);
  font-size: 0.88rem;
  text-align: center;
}

.note-floating-icon {
  font-size: 2.2rem;
  color: var(--color-accent);
  opacity: 0.8;
  animation: float-note 3s ease-in-out infinite;
}

@keyframes float-note {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.inst-headline {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.inst-subtitle {
  font-size: 0.8rem;
  color: var(--color-text-lighter);
  margin: 0;
}

/* ── TAB 3: 搜歌 ── */
.tab-page-search {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.search-bar-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #F4EFEB;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius);
}

.search-svg {
  color: var(--color-text-lighter);
}

.morandi-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  font-size: 0.88rem;
}

.search-confirm-btn {
  padding: 4px 12px;
  background: var(--color-accent);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}

.search-confirm-btn:hover {
  background: var(--color-accent-dark);
}

.hot-chips-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chips-label {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.hot-chip-btn {
  padding: 3px 10px;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.2s;
}

.hot-chip-btn:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.search-list-scroll {
  flex: 1;
  overflow-y: auto;
}

.search-state-msg {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-lighter);
  font-size: 0.85rem;
  padding: 30px;
}

.search-intro-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  gap: 6px;
  text-align: center;
}

.intro-leaf-icon { font-size: 1.8rem; }
.intro-card-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}
.intro-card-desc {
  font-size: 0.78rem;
  color: var(--color-text-lighter);
}

.results-flow {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.song-card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #F4EFEB;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.song-card-row:hover {
  background: #EDE6DF;
}

.row-cover-thumb {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.row-meta-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-title {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-play-btn {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
  font-size: 0.72rem;
  cursor: pointer;
}

/* ── TAB 4: 播放队列 ── */
.tab-page-queue {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.queue-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--color-text-lighter);
  padding: 0 4px;
}

.queue-list-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-track-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #F4EFEB;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.queue-track-item:hover {
  background: #EDE6DF;
}

.queue-track-item.playing {
  background: rgba(124, 140, 110, 0.12);
  border: 1px solid rgba(124, 140, 110, 0.3);
}

.queue-index-num {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  width: 20px;
}

.queue-track-item.playing .queue-index-num {
  color: var(--color-accent);
  font-weight: bold;
}

.queue-thumb-img {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.queue-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.queue-song-title {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-song-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-status-pill {
  font-size: 0.65rem;
  color: var(--color-accent-dark);
  background: rgba(124, 140, 110, 0.18);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.queue-time {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

/* ── TAB 5: 站长精选歌单 ── */
.tab-page-playlists {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.playlists-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--color-text-lighter);
  padding: 0 4px;
}

.playlists-cards-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #F4EFEB;
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
  cursor: pointer;
  transition: all 0.2s;
}

.playlist-item-card:hover {
  background: #EDE6DF;
  border-color: var(--color-accent);
}

.pl-cover-box {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xs);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.pl-cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pl-loading-cover {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pl-info-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pl-card-title {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-card-meta {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.pl-mount-btn {
  padding: 5px 14px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
  font-size: 0.74rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pl-mount-btn:hover:not(:disabled) {
  background: var(--color-accent-dark);
}

/* ── 底部控制栏 (Controls Deck) ── */
.player-controls-deck {
  padding: 14px 24px 20px;
  background: #F4EFEB;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.control-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  color: var(--color-text);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.2s var(--ease);
  flex-shrink: 0;
}

.control-btn:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  border-color: var(--color-accent);
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(1px);
}

.primary-play-btn {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--color-accent);
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 8px 24px var(--color-accent-glow),
    0 2px 6px rgba(0, 0, 0, 0.08);
  transition: all 0.25s var(--ease-spring);
  flex-shrink: 0;
}

.primary-play-btn:hover {
  background: var(--color-accent-dark);
  transform: scale(1.06);
  box-shadow: 0 12px 28px var(--color-accent-glow-strong);
}

.primary-play-btn:active {
  transform: scale(0.96);
}

.primary-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 音量推子 */
.volume-slider-bay {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 120px;
}

.vol-icon-btn {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-lighter);
}

.vol-icon-btn:hover {
  color: var(--color-text);
  background: transparent;
}

.morandi-vol-range {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border-medium);
  border-radius: 2px;
  outline: none;
}

.morandi-vol-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* ── 3. 电台状态弹窗 (Station Modal) ── */
.station-modal-scrim {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(36, 32, 28, 0.65);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.station-modal-card {
  width: 100%;
  max-width: 420px;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.station-modal-header {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
}

.modal-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tea-icon { font-size: 1.2rem; }

.modal-title {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.modal-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-lighter);
  font-size: 0.9rem;
  cursor: pointer;
}
.modal-close-btn:hover { color: var(--color-text); }

.station-modal-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.owner-profile-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}

.owner-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.owner-meta {
  display: flex;
  flex-direction: column;
}

.owner-name {
  font-family: var(--font-serif);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.owner-desc {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.node-status-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}

.node-label {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.node-url-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.node-url-row code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.node-badge {
  font-size: 0.68rem;
  color: #DC2626;
}
.node-badge.ok {
  color: var(--color-accent-dark);
  font-weight: 500;
}

.node-hint {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  margin: 0;
}

.node-test-btn {
  padding: 6px 14px;
  background: var(--color-accent);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.2s;
}
.node-test-btn:hover:not(:disabled) {
  background: var(--color-accent-dark);
}

/* ── 通用 Spinner ── */
.morandi-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.morandi-spinner-sm {
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── 进出过渡动画 ── */
.capsule-fade-enter-active,
.capsule-fade-leave-active {
  transition: all 0.3s var(--ease-spring);
}
.capsule-fade-enter-from { opacity: 0; transform: translateY(16px) scale(0.9); }
.capsule-fade-leave-to   { opacity: 0; transform: translateY(12px) scale(0.92); }

.player-modal-fade-enter-active,
.player-modal-fade-leave-active {
  transition: all 0.28s var(--ease);
}
.player-modal-fade-enter-from { opacity: 0; transform: scale(0.95) translateY(12px); }
.player-modal-fade-leave-to   { opacity: 0; transform: scale(0.96) translateY(-8px); }

.modal-pop-enter-active,
.modal-pop-leave-active {
  transition: all 0.24s var(--ease);
}
.modal-pop-enter-from,
.modal-pop-leave-to { opacity: 0; transform: scale(0.94); }

/* ── 移动端适配 ── */
@media (max-width: 600px) {
  .porcelain-capsule {
    left: 16px;
    bottom: 20px;
    padding: 6px 12px 6px 6px;
  }
  .capsule-meta { max-width: 95px; }
  .player-scrim { padding: 12px; }
  .player-porcelain-card { max-width: 100%; border-radius: 20px; }
  .card-header-suite { padding: 16px 18px 10px; }
  .card-body-viewport { min-height: 330px; max-height: 360px; padding: 4px 18px 10px; }
  .vinyl-stage { width: 170px; height: 170px; }
  .vinyl-record-platter { width: 168px; height: 168px; }
  .player-controls-deck { padding: 12px 18px 16px; }
  .volume-slider-bay { display: none; }
}
</style>
