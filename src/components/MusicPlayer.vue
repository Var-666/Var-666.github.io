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

// ── 进度条拖拽交互 ──
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

// ── 莫兰迪自然流体声波 Canvas ──
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

  const barCount = 26
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
        const bellCurve = 1 - centerDist * 0.4
        const wave1 = Math.sin(t * 2.6 + i * 0.45) * 0.38 + 0.45
        const wave2 = Math.cos(t * 1.8 - i * 0.3) * 0.22
        const wave3 = Math.sin(t * 4.4 + i * 0.7) * 0.15
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

      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight)
      gradient.addColorStop(0, '#7C8C6E')
      gradient.addColorStop(0.5, '#A3B495')
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
  <div class="artisan-music-scope">
    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 1. 悬浮精致唱片徽章胶囊 (Floating Vinyl Capsule)         -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="capsule-pop">
      <div
        v-if="!isExpanded"
        class="artisan-capsule"
        @click="toggleExpand"
        title="展开沉浸式黑胶唱机与歌词"
      >
        <!-- 实体黑胶唱片微型滑出效果 -->
        <div class="capsule-sleeve">
          <img :src="currentTrack.coverUrl" alt="cover" class="capsule-sleeve-cover" />
          <div class="capsule-mini-disc" :class="{ spinning: isPlaying }">
            <div class="mini-disc-spindle"></div>
          </div>
        </div>

        <div class="capsule-text-col">
          <div class="capsule-title-line">
            <span class="capsule-title">{{ currentTrack.title }}</span>
            <span v-if="currentTrack.isTrial" class="capsule-tag trial">试听</span>
            <span v-else-if="currentTrack.isFull" class="capsule-tag full">全曲</span>
          </div>
          <span class="capsule-artist">{{ currentTrack.artist }}</span>
        </div>

        <!-- 莫兰迪绿声波微动条 -->
        <div class="capsule-pulse-wave">
          <span class="p-bar pb-1" :class="{ play: isPlaying }"></span>
          <span class="p-bar pb-2" :class="{ play: isPlaying }"></span>
          <span class="p-bar pb-3" :class="{ play: isPlaying }"></span>
        </div>

        <!-- 触觉微动播放键 -->
        <button
          class="capsule-play-action"
          @click.stop="togglePlay"
          :aria-label="isPlaying ? '暂停' : '播放'"
        >
          <span v-if="isLoading" class="artisan-spinner-sm"></span>
          <svg v-else-if="!isPlaying" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <svg v-else width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        </button>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 2. 展开态沉浸式艺术唱机 (Artisan Studio Player)          -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="studio-fade">
      <div v-if="isExpanded" class="studio-scrim" @click.self="toggleExpand">
        <div class="artisan-player-card">
          <!-- ── 顶栏：电台认证与优雅导航 ── -->
          <div class="artisan-header-suite">
            <div class="station-meta-row">
              <div
                class="station-capsule-chip"
                @click="showNeteaseModal = true"
                title="查看电台服务与节点状态"
              >
                <div class="chip-avatar-box">
                  <img :src="stationUser.avatarUrl" alt="avatar" class="chip-avatar" />
                  <span class="chip-pulse" :class="{ active: isApiConnected }"></span>
                </div>
                <div class="chip-text-wrap">
                  <div class="chip-title">
                    <span class="nick">{{ stationUser.nickname }}</span>
                    <span class="station-mark">音乐空间</span>
                  </div>
                  <span class="sub">{{ userPlaylists.length }} 张精选歌单 · 诗意流淌</span>
                </div>
              </div>

              <button class="studio-close-pill" @click="toggleExpand" aria-label="收起播放器">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <!-- 雅致分段选项卡 (Sliding Indicator Tabs) -->
            <div class="artisan-nav-bar">
              <button
                class="artisan-tab"
                :class="{ active: activeTab === 'player' }"
                @click="activeTab = 'player'"
              >
                唱盘
              </button>
              <button
                class="artisan-tab"
                :class="{ active: activeTab === 'lyrics' }"
                @click="activeTab = 'lyrics'"
              >
                歌词
                <span v-if="hasLyrics" class="lyrics-live-pip"></span>
              </button>
              <button
                class="artisan-tab"
                :class="{ active: activeTab === 'search' }"
                @click="activeTab = 'search'"
              >
                搜歌
              </button>
              <button
                class="artisan-tab"
                :class="{ active: activeTab === 'playlist' }"
                @click="activeTab = 'playlist'"
              >
                队列 ({{ playlist.length }})
              </button>
              <button
                class="artisan-tab highlight"
                :class="{ active: activeTab === 'user-playlists' }"
                @click="activeTab = 'user-playlists'"
              >
                歌单 ({{ userPlaylists.length }})
              </button>
            </div>
          </div>

          <!-- ── 中部主舞台 (Main Interactive Viewport) ── -->
          <div class="artisan-body-viewport">
            <!-- 视角 01: 实体黑胶唱片封套交互 (Vinyl Sleeve & Record Experience) -->
            <div v-if="activeTab === 'player'" class="view-player-deck">
              <!-- 核心唱片封套联动舞台 -->
              <div
                class="sleeve-disc-stage"
                @click="activeTab = 'lyrics'"
                title="点击封套或唱片翻转至歌词视窗"
              >
                <!-- 黑胶唱片本体 (从封套中滑出并旋转) -->
                <div
                  class="artisan-vinyl-disc"
                  :class="{ playing: isPlaying }"
                >
                  <div class="disc-rotator" :class="{ spinning: isPlaying }">
                    <div class="disc-groove dg-1"></div>
                    <div class="disc-groove dg-2"></div>
                    <div class="disc-groove dg-3"></div>
                    <div class="disc-sheen"></div>
                    <div class="disc-center-hub">
                      <div class="hub-brass-spindle"></div>
                    </div>
                  </div>
                </div>

                <!-- 实体方形黑胶封套 (Physical Album Jacket) -->
                <div class="artisan-album-sleeve">
                  <img :src="currentTrack.coverUrl" alt="album cover" class="sleeve-artwork" />
                  <div class="sleeve-paper-spine"></div>
                  <div class="sleeve-edge-sheen"></div>
                  <div class="sleeve-pocket-shadow"></div>
                </div>

                <!-- 交互悬浮提示 -->
                <div class="sleeve-interaction-tip">
                  <span>查看歌词 ⇄</span>
                </div>
              </div>

              <!-- 曲目信息区域 -->
              <div class="track-title-card">
                <div class="title-with-pill">
                  <h3 class="track-hero-name" :title="currentTrack.title">{{ currentTrack.title }}</h3>
                  <span v-if="playbackStatus === 'resolving'" class="artisan-tag resolving">
                    ● 解析直链中
                  </span>
                  <span v-else-if="playbackStatus === 'error'" class="artisan-tag error" :title="playbackError">
                    ⚠️ 播放受阻
                  </span>
                  <span v-else class="artisan-tag" :class="{ full: currentTrack.isFull, trial: currentTrack.isTrial }">
                    {{ currentTrack.isTrial ? '◐ 试听采样 (30秒)' : (currentTrack.isFull ? '● 完整全曲' : '○ 试听采样') }}
                  </span>
                </div>
                <p class="track-author-line">
                  <span v-if="playbackStatus === 'error' && playbackError" class="err-text">{{ playbackError }}</span>
                  <span v-else>{{ currentTrack.artist }} · 《{{ currentTrack.album }}》</span>
                </p>
              </div>

              <!-- 莫兰迪自然流体频谱 Canvas -->
              <div class="artisan-wave-box">
                <canvas ref="canvasRef" class="artisan-wave-canvas"></canvas>
              </div>

              <!-- 精致细线交互进度条 -->
              <div class="artisan-progress-module">
                <div
                  class="progress-touch-zone"
                  @pointerdown="handleProgressPointerDown"
                  @mousemove="handleProgressMouseMove"
                  @mouseleave="handleProgressMouseLeave"
                >
                  <div
                    v-if="showHoverTooltip"
                    class="progress-hover-bubble"
                    :style="{ left: `${hoverTooltipX}px` }"
                  >
                    {{ formatTime(hoverPct * (duration || 180)) }}
                  </div>

                  <div class="progress-track-bg"></div>
                  <div class="progress-track-fill" :style="{ width: `${progressPercent}%` }">
                    <div class="progress-track-thumb" :class="{ dragging: isScrubbing, active: isPlaying }"></div>
                  </div>
                </div>

                <div class="progress-time-row">
                  <span class="time-elapsed">{{ formatTime(displayCurrentTime) }}</span>
                  <span class="time-total">{{ formatTime(duration) }}</span>
                </div>
              </div>
            </div>

            <!-- 视角 02: 诗集式大字呼吸歌词视窗 (Poetic Lyrics) -->
            <div v-else-if="activeTab === 'lyrics'" class="view-lyrics-deck">
              <div class="lyrics-zen-header">
                <div class="zen-dot-group">
                  <span class="zen-dot" :class="{ pulsing: isPlaying }"></span>
                  <span class="zen-label">{{ isPlaying ? '实时歌词同步' : '已暂停' }}</span>
                </div>
                <span v-if="currentTrack.isTrial" class="zen-trial-hint">试听片段 · 歌词将随音轨同步</span>
              </div>

              <div
                ref="lyricsScrollContainer"
                class="lyrics-zen-viewport"
                @wheel="handleUserLyricScroll"
                @touchstart="handleUserLyricScroll"
              >
                <!-- 加载中 -->
                <div v-if="isLoadingLyrics" class="lyrics-zen-status">
                  <span class="artisan-spinner"></span>
                  <p>正在拉取歌词灵感...</p>
                </div>

                <!-- 纯音乐或未收录 -->
                <div
                  v-else-if="isInstrumental || currentLyrics.length === 0"
                  class="lyrics-zen-status instrumental"
                >
                  <span class="inst-music-icon">♪</span>
                  <h4 class="inst-title">纯音乐 · 请沉浸欣赏</h4>
                  <p class="inst-desc">无歌词收录，静心聆听音符流淌</p>
                </div>

                <!-- 歌词行诗意排版 -->
                <div v-else class="lyrics-poetry-flow">
                  <div class="poetry-spacer"></div>
                  <div
                    v-for="(line, idx) in currentLyrics"
                    :key="line.id"
                    :ref="(el) => setLyricLineRef(el, idx)"
                    class="poetry-line-item"
                    :class="{
                      active: idx === currentLineIndex,
                      passed: idx < currentLineIndex,
                      future: idx > currentLineIndex
                    }"
                    @click="handleLyricClick(line.time)"
                    :title="`点击跳转至 ${formatTime(line.time)}`"
                  >
                    <p class="poetry-original">{{ line.text }}</p>
                    <p v-if="line.translation" class="poetry-trans">{{ line.translation }}</p>
                  </div>
                  <div class="poetry-spacer"></div>
                </div>
              </div>
            </div>

            <!-- 视角 03: 曲库搜歌 (Search View) -->
            <div v-else-if="activeTab === 'search'" class="view-search-deck">
              <div class="search-input-capsule">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-lens-svg">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="search-text-input"
                  placeholder="搜索歌曲、艺术家，或网易云单曲 ID"
                  @keyup.enter="handleSearch()"
                />
                <button class="search-submit-btn" @click="handleSearch()">搜索</button>
              </div>

              <!-- 风格芯片 -->
              <div class="hot-chips-bar">
                <span class="chips-title">灵感推荐:</span>
                <button
                  v-for="tag in hotTags"
                  :key="tag"
                  class="hot-style-chip"
                  @click="handleSearch(tag)"
                >
                  {{ tag }}
                </button>
              </div>

              <!-- 搜索结果 -->
              <div class="search-results-viewport">
                <div v-if="isSearching" class="results-feedback-state">
                  <span class="artisan-spinner"></span>
                  <span>全网曲库检索中...</span>
                </div>

                <div v-else-if="searchError" class="results-feedback-state error">
                  {{ searchError }}
                </div>

                <div v-else-if="searchResults.length === 0" class="search-gentle-card">
                  <span class="gentle-icon">✦</span>
                  <span class="gentle-title">在旋律中漫步</span>
                  <p class="gentle-desc">输入曲目、歌手或单曲 ID，为当下的思绪配一首背景音。</p>
                </div>

                <div v-else class="results-rows-list">
                  <div
                    v-for="item in searchResults"
                    :key="item.id"
                    class="search-song-card"
                    @click="handleSelectSearchResult(item)"
                  >
                    <img :src="item.coverUrl" alt="cover" class="song-card-thumb" />
                    <div class="song-card-meta">
                      <span class="song-card-title">{{ item.title }}</span>
                      <span class="song-card-artist">{{ item.artist }} · {{ item.album }}</span>
                    </div>
                    <button class="song-play-action">播放</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 视角 04: 当前队列 (Queue View) -->
            <div v-else-if="activeTab === 'playlist'" class="view-queue-deck">
              <div class="queue-status-bar">
                <span>播放列表 ({{ playlist.length }})</span>
                <span class="queue-mode-tag">{{ playModeTitle }}</span>
              </div>

              <div class="queue-items-viewport">
                <div
                  v-for="(item, idx) in playlist"
                  :key="item.id"
                  class="queue-card-row"
                  :class="{ active: idx === currentTrackIndex }"
                  @click="selectTrack(idx)"
                >
                  <span class="queue-ordinal">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <img :src="item.coverUrl" alt="cover" class="queue-row-thumb" />
                  <div class="queue-row-info">
                    <span class="queue-row-title">{{ item.title }}</span>
                    <span class="queue-row-artist">{{ item.artist }}</span>
                  </div>
                  <span v-if="idx === currentTrackIndex && isPlaying" class="queue-active-badge">播放中</span>
                  <span v-else class="queue-row-dur">{{ formatTime(item.duration) }}</span>
                </div>
              </div>
            </div>

            <!-- 视角 05: 站长精选公开歌单 (Curated Playlists View) -->
            <div v-else-if="activeTab === 'user-playlists'" class="view-playlists-deck">
              <div class="playlists-status-bar">
                <span>{{ stationUser.nickname }} · 日常精选歌单 ({{ userPlaylists.length }})</span>
                <span class="playlists-hint">点击载入整张歌单</span>
              </div>

              <div class="playlists-cards-viewport">
                <div
                  v-for="pl in userPlaylists"
                  :key="pl.id"
                  class="playlist-banner-card"
                  :class="{ loading: currentLoadingPlaylistId === pl.id }"
                  @click="handleSelectNeteasePlaylist(pl.id)"
                >
                  <div class="pl-banner-thumb-wrap">
                    <img :src="pl.coverImgUrl" alt="cover" class="pl-banner-thumb" />
                    <span v-if="currentLoadingPlaylistId === pl.id" class="pl-loading-glass">
                      <span class="artisan-spinner-sm"></span>
                    </span>
                  </div>
                  <div class="pl-banner-info">
                    <span class="pl-banner-title" :title="pl.name">{{ pl.name }}</span>
                    <span class="pl-banner-sub">{{ pl.trackCount }} 首歌曲 · 灵感电台</span>
                  </div>
                  <button class="pl-mount-action" :disabled="currentLoadingPlaylistId === pl.id">
                    {{ currentLoadingPlaylistId === pl.id ? '载入中...' : '载入歌单' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── 底部控制栏：陶瓷触感按键组 (Tactile Controls Deck) ── -->
          <div class="artisan-controls-deck">
            <!-- 播放模式切换 -->
            <button
              class="artisan-btn btn-mode"
              @click="togglePlayMode"
              :title="`播放模式: ${playModeTitle}`"
            >
              <svg v-if="playMode === 'sequence'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
              <svg v-else-if="playMode === 'loop-one'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                <text x="12" y="15" font-size="8" font-family="monospace" font-weight="bold" fill="currentColor" text-anchor="middle">1</text>
              </svg>
              <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="16 3 21 3 21 8" />
                <line x1="4" y1="20" x2="21" y2="3" />
                <polyline points="21 16 21 21 16 21" />
                <line x1="15" y1="15" x2="21" y2="21" />
                <line x1="4" y1="4" x2="9" y2="9" />
              </svg>
            </button>

            <!-- 上一首 -->
            <button class="artisan-btn" @click="prevTrack" title="上一首">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 主播放/暂停 (莫兰迪绿核心水滴按键) -->
            <button class="artisan-play-master" @click="togglePlay" :aria-label="isPlaying ? '暂停' : '播放'">
              <span v-if="isLoading" class="master-spinner"></span>
              <svg v-else-if="!isPlaying" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>

            <!-- 下一首 -->
            <button class="artisan-btn" @click="nextTrack" title="下一首">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2" />
              </svg>
            </button>

            <!-- 音量推子模块 -->
            <div class="artisan-volume-bay">
              <button class="volume-mute-toggle" @click="toggleMute" title="静音切换">
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
                class="artisan-slider-input"
                @input="handleVolumeChange"
                title="音量调节"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 3. 云端服务状态与节点弹窗 (Station Diagnostics)          -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="diag-fade">
      <div v-if="showNeteaseModal" class="diag-scrim-mask" @click.self="showNeteaseModal = false">
        <div class="diag-porcelain-card">
          <div class="diag-top-bar">
            <div class="diag-title-row">
              <span class="diag-tea">🍵</span>
              <span class="diag-title">var 的音乐电台节点</span>
            </div>
            <button class="diag-close-btn" @click="showNeteaseModal = false">✕</button>
          </div>

          <div class="diag-content-body">
            <div class="station-owner-block">
              <img :src="stationUser.avatarUrl" alt="avatar" class="owner-circle-avatar" />
              <div class="owner-meta-col">
                <span class="owner-name-txt">{{ stationUser.nickname }}</span>
                <span class="owner-desc-txt">专属站长电台 · 免登录畅听精选歌单</span>
              </div>
            </div>

            <div class="node-endpoint-block">
              <span class="endpoint-caption">曲库数据源节点</span>
              <div class="endpoint-status-line">
                <code>{{ apiUrl }}</code>
                <span class="endpoint-badge" :class="{ ok: isApiConnected }">
                  {{ isApiConnected ? `已连通 (${apiLatency}ms)` : '未连通' }}
                </span>
              </div>
              <p v-if="apiTestMessage" class="endpoint-msg">{{ apiTestMessage }}</p>
              <button
                class="endpoint-test-action"
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
   ARTISAN WABI-SABI MUSIC PLAYER — 侘寂大地自然美学设计系统
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. 悬浮精致唱片胶囊 (Floating Capsule) ── */
.artisan-capsule {
  position: fixed;
  left: 24px;
  bottom: 28px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px 8px 10px;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  box-shadow:
    0 16px 38px -6px rgba(44, 38, 33, 0.18),
    0 4px 12px rgba(0, 0, 0, 0.04),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  cursor: pointer;
  transition: all 0.3s var(--ease-spring);
  user-select: none;
}

.artisan-capsule:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow:
    0 22px 46px -6px rgba(44, 38, 33, 0.24),
    0 6px 18px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 #FFFFFF;
  border-color: rgba(124, 140, 110, 0.45);
}

/* 唱片微型滑出效果 */
.capsule-sleeve {
  position: relative;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
}

.capsule-sleeve-cover {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  z-index: 2;
}

.capsule-mini-disc {
  position: absolute;
  top: 2px;
  left: 10px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: radial-gradient(circle, #252220 0%, #12100E 100%);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
  transition: left 0.4s var(--ease-spring);
  animation: mini-spin 8s linear infinite;
  animation-play-state: paused;
}

.artisan-capsule:hover .capsule-mini-disc {
  left: 18px;
}

.capsule-mini-disc.spinning {
  animation-play-state: running;
}

@keyframes mini-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mini-disc-spindle {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #C4A882;
  border: 1px solid #FAF7F2;
}

/* 胶囊文本 */
.capsule-text-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  max-width: 140px;
}

.capsule-title-line {
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

.capsule-tag {
  font-size: 0.58rem;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: var(--font-mono);
  white-space: nowrap;
}

.capsule-tag.full {
  background: rgba(124, 140, 110, 0.15);
  color: var(--color-accent-dark);
}

.capsule-tag.trial {
  background: rgba(196, 168, 130, 0.2);
  color: #9C723E;
}

.capsule-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 律动微波 */
.capsule-pulse-wave {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 14px;
}

.p-bar {
  width: 2.5px;
  background: var(--border-medium);
  border-radius: 1px;
}
.p-bar.pb-1 { height: 5px; }
.p-bar.pb-2 { height: 11px; }
.p-bar.pb-3 { height: 7px; }

.p-bar.play {
  background: var(--color-accent);
  animation: bar-flutter 1.2s ease-in-out infinite alternate;
}
.p-bar.pb-1.play { animation-delay: 0.1s; }
.p-bar.pb-2.play { animation-delay: 0.3s; }
.p-bar.pb-3.play { animation-delay: 0.2s; }

@keyframes bar-flutter {
  0% { height: 4px; }
  100% { height: 14px; }
}

.capsule-play-action {
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

.capsule-play-action:hover {
  background: var(--color-accent-dark);
  transform: scale(1.08);
}

.artisan-spinner-sm {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* ── 2. 展开态艺术唱机卡片 (Artisan Studio Player) ── */
.studio-scrim {
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

.artisan-player-card {
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

/* 顶栏套件 */
.artisan-header-suite {
  padding: 20px 24px 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.station-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.station-capsule-chip {
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

.station-capsule-chip:hover {
  background: #FFFFFF;
  border-color: var(--color-accent);
  transform: translateY(-1px);
}

.chip-avatar-box {
  position: relative;
  width: 32px;
  height: 32px;
}

.chip-avatar {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
}

.chip-pulse {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9CA3AF;
  border: 1.5px solid #FAF7F2;
}

.chip-pulse.active {
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
}

.chip-text-wrap {
  display: flex;
  flex-direction: column;
}

.chip-title {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chip-title .nick {
  font-family: var(--font-serif);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-text);
}

.station-mark {
  font-size: 0.62rem;
  padding: 1px 6px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
}

.chip-text-wrap .sub {
  font-size: 0.7rem;
  color: var(--color-text-lighter);
}

.studio-close-pill {
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

.studio-close-pill:hover {
  background: #FFFFFF;
  color: var(--color-text);
  border-color: var(--border-medium);
  transform: rotate(90deg);
}

/* 分段选项卡 */
.artisan-nav-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #EDE8E2;
  padding: 3px;
  border-radius: var(--radius-full);
  border: 1px solid var(--border-light);
}

.artisan-tab {
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

.artisan-tab:hover {
  color: var(--color-text);
}

.artisan-tab.active {
  background: #FAF7F2;
  color: var(--color-text);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(45, 40, 35, 0.08);
}

.artisan-tab.highlight {
  color: var(--color-accent);
}

.lyrics-live-pip {
  position: absolute;
  top: 6px;
  right: 14px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-accent);
}

/* ── 主视口区域 (Card Body Viewport) ── */
.artisan-body-viewport {
  padding: 6px 24px 14px;
  min-height: 360px;
  max-height: 390px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ── 视角 01: 黑胶唱片封套交互 (Sleeve & Vinyl Stage) ── */
.view-player-deck {
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* 封套与黑胶联动舞台 */
.sleeve-disc-stage {
  position: relative;
  width: 250px;
  height: 180px;
  margin: 0 auto 10px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 20px;
  cursor: pointer;
}

/* 实体方形黑胶封套 */
.artisan-album-sleeve {
  position: relative;
  width: 144px;
  height: 144px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow:
    -6px 12px 30px rgba(45, 40, 35, 0.22),
    0 2px 8px rgba(0, 0, 0, 0.1);
  z-index: 3;
  background: #252220;
  transition: transform 0.35s var(--ease-spring);
}

.sleeve-disc-stage:hover .artisan-album-sleeve {
  transform: translateY(-2px) scale(1.02);
}

.sleeve-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.sleeve-paper-spine {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 4px;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.3), transparent);
}

.sleeve-edge-sheen {
  position: absolute;
  inset: 0;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
  pointer-events: none;
}

/* 封套右侧插口阴影 */
.sleeve-pocket-shadow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8px;
  background: linear-gradient(to left, rgba(0, 0, 0, 0.45), transparent);
  pointer-events: none;
}

/* 黑胶唱片本体 (从封套中探出并自由旋转) */
.artisan-vinyl-disc {
  position: absolute;
  left: 60px;
  width: 140px;
  height: 140px;
  border-radius: 50%;
  z-index: 2;
  transform: translateX(24px);
  transition: transform 0.5s var(--ease-spring);
  pointer-events: none;
}

.artisan-vinyl-disc.playing {
  transform: translateX(54px);
}

.sleeve-disc-stage:hover .artisan-vinyl-disc {
  transform: translateX(64px);
}

.disc-rotator {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background:
    repeating-radial-gradient(
      circle,
      rgba(255, 255, 255, 0.025) 0px,
      rgba(255, 255, 255, 0.025) 1px,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(circle, #252220 0%, #12100E 100%);
  box-shadow:
    0 10px 24px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1.5px rgba(255, 255, 255, 0.12);
  animation: disc-spin 10s linear infinite;
  animation-play-state: paused;
}

.disc-rotator.spinning {
  animation-play-state: running;
}

@keyframes disc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.disc-groove {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.dg-1 { width: 118px; height: 118px; border: 1px solid rgba(255, 255, 255, 0.04); }
.dg-2 { width: 94px; height: 94px; border: 1px dashed rgba(255, 255, 255, 0.05); }
.dg-3 { width: 72px; height: 72px; border: 1px solid rgba(255, 255, 255, 0.04); }

.disc-sheen {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(
    from 45deg,
    transparent 0deg,
    rgba(255, 255, 255, 0.08) 45deg,
    transparent 90deg,
    transparent 180deg,
    rgba(255, 255, 255, 0.08) 225deg,
    transparent 270deg
  );
  pointer-events: none;
}

.disc-center-hub {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #C4A882;
  border: 2px solid #FAF7F2;
  position: relative;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hub-brass-spindle {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #252220;
  border: 1.5px solid #FAF7F2;
}

.sleeve-interaction-tip {
  position: absolute;
  bottom: 4px;
  right: 10px;
  padding: 3px 8px;
  border-radius: var(--radius-full);
  background: rgba(250, 247, 242, 0.95);
  border: 1px solid var(--border-medium);
  font-size: 0.68rem;
  color: var(--color-accent);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  opacity: 0;
  transition: opacity 0.25s var(--ease);
  z-index: 4;
}

.sleeve-disc-stage:hover .sleeve-interaction-tip {
  opacity: 1;
}

/* 曲目信息 */
.track-title-card {
  text-align: center;
  margin-bottom: 6px;
  width: 100%;
}

.title-with-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 4px;
}

.track-hero-name {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 260px;
  margin: 0;
}

.artisan-tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 1px 7px;
  border-radius: var(--radius-sm);
  background: rgba(0, 0, 0, 0.05);
  color: var(--color-text-lighter);
}

.artisan-tag.full {
  background: rgba(124, 140, 110, 0.15);
  color: var(--color-accent-dark);
  font-weight: 500;
}

.artisan-tag.trial {
  background: rgba(196, 168, 130, 0.2);
  color: #B48855;
  font-weight: 500;
}

.artisan-tag.resolving {
  background: rgba(59, 130, 246, 0.12);
  color: #2563EB;
}

.artisan-tag.error {
  background: rgba(239, 68, 68, 0.12);
  color: #DC2626;
}

.track-author-line {
  font-size: 0.8rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.err-text { color: #DC2626; }

/* 声波画布 */
.artisan-wave-box {
  width: 100%;
  height: 26px;
  margin-bottom: 8px;
}

.artisan-wave-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

/* 进度条 */
.artisan-progress-module {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-touch-zone {
  position: relative;
  height: 18px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.progress-hover-bubble {
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

.progress-track-bg {
  width: 100%;
  height: 4px;
  background: var(--border-medium);
  border-radius: 2px;
}

.progress-track-fill {
  position: absolute;
  left: 0;
  height: 4px;
  background: var(--color-accent);
  border-radius: 2px;
  pointer-events: none;
}

.progress-track-thumb {
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

.progress-track-thumb.dragging {
  transform: scale(1.3);
}

.progress-time-row {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

/* ── 视角 02: 诗集式歌词视窗 ── */
.view-lyrics-deck {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #F4EFEB;
  border: 1px solid var(--border-light);
  border-radius: 16px;
  overflow: hidden;
}

.lyrics-zen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 6px;
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.zen-dot-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.zen-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #B0AAA0;
}

.zen-dot.pulsing {
  background: var(--color-accent);
  box-shadow: 0 0 6px var(--color-accent);
  animation: zen-pulse 1.8s ease-in-out infinite;
}

@keyframes zen-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.zen-trial-hint {
  color: #B48855;
  font-size: 0.68rem;
}

.lyrics-zen-viewport {
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
.lyrics-zen-viewport::-webkit-scrollbar { display: none; }

.poetry-spacer {
  height: 110px;
  flex-shrink: 0;
}

.lyrics-poetry-flow {
  display: flex;
  flex-direction: column;
  gap: 16px;
  text-align: center;
}

.poetry-line-item {
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.28s var(--ease);
  user-select: none;
}

.poetry-original {
  font-family: var(--font-serif);
  font-size: 0.98rem;
  line-height: 1.5;
  color: #8C8880;
  transition: all 0.25s var(--ease);
  margin: 0;
}

.poetry-trans {
  font-size: 0.78rem;
  line-height: 1.4;
  color: #A39F97;
  margin: 4px 0 0;
  transition: all 0.25s var(--ease);
}

.poetry-line-item.active {
  transform: scale(1.06);
}

.poetry-line-item.active .poetry-original {
  font-size: 1.18rem;
  font-weight: 600;
  color: var(--color-accent-dark);
  text-shadow: 0 2px 10px rgba(124, 140, 110, 0.2);
}

.poetry-line-item.active .poetry-trans {
  font-size: 0.86rem;
  color: var(--color-text);
  font-weight: 500;
}

.poetry-line-item:hover:not(.active) {
  background: rgba(124, 140, 110, 0.08);
}

.poetry-line-item:hover:not(.active) .poetry-original {
  color: var(--color-text);
}

.lyrics-zen-status {
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

.inst-music-icon {
  font-size: 2.2rem;
  color: var(--color-accent);
  opacity: 0.8;
  animation: float-note 3s ease-in-out infinite;
}

@keyframes float-note {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.inst-title {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  margin: 0;
}

.inst-desc {
  font-size: 0.8rem;
  color: var(--color-text-lighter);
  margin: 0;
}

/* ── 视角 03: 搜歌 ── */
.view-search-deck {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.search-input-capsule {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #F4EFEB;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius);
}

.search-lens-svg {
  color: var(--color-text-lighter);
}

.search-text-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--color-text);
  font-size: 0.88rem;
}

.search-submit-btn {
  padding: 4px 12px;
  background: var(--color-accent);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.2s;
}

.search-submit-btn:hover {
  background: var(--color-accent-dark);
}

.hot-chips-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chips-title {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.hot-style-chip {
  padding: 3px 10px;
  background: var(--color-bg-alt);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.72rem;
  color: var(--color-text-light);
  cursor: pointer;
  transition: all 0.2s;
}

.hot-style-chip:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  border-color: var(--color-accent);
}

.search-results-viewport {
  flex: 1;
  overflow-y: auto;
}

.results-feedback-state {
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

.search-gentle-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px;
  gap: 6px;
  text-align: center;
}

.gentle-icon { font-size: 1.6rem; color: var(--color-warm); }
.gentle-title {
  font-family: var(--font-serif);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
}
.gentle-desc {
  font-size: 0.78rem;
  color: var(--color-text-lighter);
}

.results-rows-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-song-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #F4EFEB;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.search-song-card:hover {
  background: #EDE6DF;
}

.song-card-thumb {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.song-card-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.song-card-title {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-card-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-play-action {
  padding: 3px 10px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
  font-size: 0.72rem;
  cursor: pointer;
}

/* ── 视角 04: 播放队列 ── */
.view-queue-deck {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.queue-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--color-text-lighter);
  padding: 0 4px;
}

.queue-items-viewport {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.queue-card-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #F4EFEB;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.2s;
}

.queue-card-row:hover {
  background: #EDE6DF;
}

.queue-card-row.active {
  background: rgba(124, 140, 110, 0.12);
  border: 1px solid rgba(124, 140, 110, 0.3);
}

.queue-ordinal {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  width: 20px;
}

.queue-card-row.active .queue-ordinal {
  color: var(--color-accent);
  font-weight: bold;
}

.queue-row-thumb {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-xs);
  object-fit: cover;
}

.queue-row-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.queue-row-title {
  font-size: 0.86rem;
  font-weight: 500;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-row-artist {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-active-badge {
  font-size: 0.65rem;
  color: var(--color-accent-dark);
  background: rgba(124, 140, 110, 0.18);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.queue-row-dur {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

/* ── 视角 05: 站长精选歌单 ── */
.view-playlists-deck {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.playlists-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.74rem;
  color: var(--color-text-lighter);
  padding: 0 4px;
}

.playlists-cards-viewport {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-banner-card {
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

.playlist-banner-card:hover {
  background: #EDE6DF;
  border-color: var(--color-accent);
}

.pl-banner-thumb-wrap {
  width: 44px;
  height: 44px;
  border-radius: var(--radius-xs);
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.pl-banner-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pl-loading-glass {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}

.pl-banner-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pl-banner-title {
  font-family: var(--font-serif);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.pl-banner-sub {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.pl-mount-action {
  padding: 5px 14px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #FFFFFF;
  font-size: 0.74rem;
  cursor: pointer;
  transition: all 0.2s;
}

.pl-mount-action:hover:not(:disabled) {
  background: var(--color-accent-dark);
}

/* ── 底部控制栏 (Controls Deck) ── */
.artisan-controls-deck {
  padding: 14px 24px 20px;
  background: #F4EFEB;
  border-top: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.artisan-btn {
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

.artisan-btn:hover {
  background: #FFFFFF;
  color: var(--color-accent);
  border-color: var(--color-accent);
  transform: translateY(-1px);
}

.artisan-btn:active {
  transform: translateY(1px);
}

.artisan-play-master {
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

.artisan-play-master:hover {
  background: var(--color-accent-dark);
  transform: scale(1.06);
  box-shadow: 0 12px 28px var(--color-accent-glow-strong);
}

.artisan-play-master:active {
  transform: scale(0.96);
}

.master-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

/* 音量推子 */
.artisan-volume-bay {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  max-width: 120px;
}

.volume-mute-toggle {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  box-shadow: none;
  color: var(--color-text-lighter);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.volume-mute-toggle:hover {
  color: var(--color-text);
}

.artisan-slider-input {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  background: var(--border-medium);
  border-radius: 2px;
  outline: none;
}

.artisan-slider-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-accent);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* ── 3. 电台状态弹窗 (Diagnostics) ── */
.diag-scrim-mask {
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

.diag-porcelain-card {
  width: 100%;
  max-width: 420px;
  background: #FAF7F2;
  border: 1px solid var(--border-medium);
  border-radius: 20px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.diag-top-bar {
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-light);
}

.diag-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diag-tea { font-size: 1.2rem; }

.diag-title {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text);
}

.diag-close-btn {
  background: transparent;
  border: none;
  color: var(--color-text-lighter);
  font-size: 0.9rem;
  cursor: pointer;
}
.diag-close-btn:hover { color: var(--color-text); }

.diag-content-body {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.station-owner-block {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}

.owner-circle-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}

.owner-meta-col {
  display: flex;
  flex-direction: column;
}

.owner-name-txt {
  font-family: var(--font-serif);
  font-size: 0.92rem;
  font-weight: 600;
  color: var(--color-text);
}

.owner-desc-txt {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.node-endpoint-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px;
  background: var(--color-bg-alt);
  border-radius: var(--radius);
  border: 1px solid var(--border-light);
}

.endpoint-caption {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.endpoint-status-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.endpoint-status-line code {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text);
  background: rgba(0, 0, 0, 0.04);
  padding: 2px 6px;
  border-radius: var(--radius-xs);
}

.endpoint-badge {
  font-size: 0.68rem;
  color: #DC2626;
}
.endpoint-badge.ok {
  color: var(--color-accent-dark);
  font-weight: 500;
}

.endpoint-msg {
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  margin: 0;
}

.endpoint-test-action {
  padding: 6px 14px;
  background: var(--color-accent);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  cursor: pointer;
  align-self: flex-start;
  transition: all 0.2s;
}
.endpoint-test-action:hover:not(:disabled) {
  background: var(--color-accent-dark);
}

/* ── 通用 Spinner ── */
.artisan-spinner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-medium);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── 进出过渡动画 ── */
.capsule-pop-enter-active,
.capsule-pop-leave-active {
  transition: all 0.3s var(--ease-spring);
}
.capsule-pop-enter-from { opacity: 0; transform: translateY(16px) scale(0.9); }
.capsule-pop-leave-to   { opacity: 0; transform: translateY(12px) scale(0.92); }

.studio-fade-enter-active,
.studio-fade-leave-active {
  transition: all 0.28s var(--ease);
}
.studio-fade-enter-from { opacity: 0; transform: scale(0.95) translateY(12px); }
.studio-fade-leave-to   { opacity: 0; transform: scale(0.96) translateY(-8px); }

.diag-fade-enter-active,
.diag-fade-leave-active {
  transition: all 0.24s var(--ease);
}
.diag-fade-enter-from,
.diag-fade-leave-to { opacity: 0; transform: scale(0.94); }

/* ── 移动端适配 ── */
@media (max-width: 600px) {
  .artisan-capsule {
    left: 16px;
    bottom: 20px;
    padding: 6px 12px 6px 8px;
  }
  .capsule-text-col { max-width: 95px; }
  .studio-scrim { padding: 12px; }
  .artisan-player-card { max-width: 100%; border-radius: 20px; }
  .artisan-header-suite { padding: 16px 18px 10px; }
  .artisan-body-viewport { min-height: 330px; max-height: 360px; padding: 4px 18px 10px; }
  .sleeve-disc-stage { width: 200px; height: 140px; padding-left: 0; }
  .artisan-album-sleeve { width: 110px; height: 110px; }
  .artisan-vinyl-disc { width: 106px; height: 106px; left: 30px; }
  .artisan-vinyl-disc.playing { transform: translateX(36px); }
  .artisan-controls-deck { padding: 12px 18px 16px; }
  .artisan-volume-bay { display: none; }
}
</style>
