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

// ── 硬件工作模式切换 ──
// 'player' 唱机 | 'lyrics' 歌词终端 | 'search' 曲库检索 | 'playlist' 当前队列 | 'user-playlists' 精选唱片盒
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

function formatPreciseTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.0'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.floor((seconds % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`
}

// ── 精密刻度寻轨器 (Precision Ruler Scrubber) ──
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

const playModeLabel = computed(() => {
  if (playMode.value === 'sequence') return 'SEQ'
  if (playMode.value === 'loop-one') return 'RPT-1'
  return 'SHFL'
})

const playModeDescription = computed(() => {
  if (playMode.value === 'sequence') return '顺序循环'
  if (playMode.value === 'loop-one') return '单曲循环'
  return '随机播放'
})

// ── 硬件 LED 点阵频段仪 (Segmented LED Ladder VU Meter) ──
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

function drawLedSpectrum() {
  if (animId !== null) cancelAnimationFrame(animId)

  const barCount = 20
  const segCount = 7 // 每个通道 7 级点阵 LED
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

    const t = Date.now() * 0.0035
    if (isPlaying.value) {
      for (let i = 0; i < barCount; i++) {
        const centerDist = Math.abs(i - barCount / 2) / (barCount / 2)
        const bellCurve = 1 - centerDist * 0.4
        const wave1 = Math.sin(t * 3.0 + i * 0.45) * 0.4 + 0.48
        const wave2 = Math.cos(t * 1.8 - i * 0.32) * 0.25
        const wave3 = Math.sin(t * 5.0 + i * 0.8) * 0.15
        const targetVal = Math.max(0.1, Math.min(0.98, (wave1 + wave2 + wave3) * bellCurve))
        dataArray[i] += (targetVal - dataArray[i]) * 0.25
      }
    } else {
      for (let i = 0; i < barCount; i++) {
        const targetVal = 0.08
        dataArray[i] += (targetVal - dataArray[i]) * 0.1
      }
    }

    const barWidth = Math.max(3, (w / barCount) * 0.55)
    const totalBarsWidth = barWidth * barCount
    const colGap = Math.max(2, (w - totalBarsWidth) / (barCount - 1))
    const segHeight = Math.max(2, (h - (segCount - 1) * 2) / segCount)
    const segGap = 2

    for (let i = 0; i < barCount; i++) {
      const activeSegs = Math.round((dataArray[i] || 0.05) * segCount)
      const x = i * (barWidth + colGap)

      for (let s = 0; s < segCount; s++) {
        // 从底部往上算 (0 为最底层，segCount-1 为最顶层)
        const y = h - (s + 1) * (segHeight + segGap)
        const isLit = s < activeSegs

        if (isLit) {
          if (s >= segCount - 1) {
            // 峰值红色报警
            ctx.fillStyle = '#EF4444'
            ctx.shadowColor = 'rgba(239, 68, 68, 0.6)'
            ctx.shadowBlur = 4
          } else if (s >= segCount - 3) {
            // 中高段工业橙 (Teenage Engineering Signal Orange)
            ctx.fillStyle = '#FF5500'
            ctx.shadowColor = 'rgba(255, 85, 0, 0.5)'
            ctx.shadowBlur = 3
          } else {
            // 基础段工业荧光翠绿
            ctx.fillStyle = '#10B981'
            ctx.shadowColor = 'rgba(16, 185, 129, 0.4)'
            ctx.shadowBlur = 2
          }
        } else {
          // 未点亮状态：微弱硬件暗透质感
          ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
          ctx.shadowBlur = 0
        }

        ctx.beginPath()
        ctx.roundRect(x, y, barWidth, segHeight, [1, 1, 1, 1])
        ctx.fill()
      }
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
      drawLedSpectrum()
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
      drawLedSpectrum()
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
  drawLedSpectrum()
})

onUnmounted(() => {
  if (animId !== null) cancelAnimationFrame(animId)
  if (userScrollTimer) clearTimeout(userScrollTimer)
})
</script>

<template>
  <div class="te-audio-system">
    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 1. 悬浮遥控硬件胶囊 (Pocket Remote Dock)               -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="remote-pop">
      <div
        v-if="!isExpanded"
        class="pocket-remote"
        @click="toggleExpand"
        title="点击展开专业音频工作台"
      >
        <!-- 机械滚轮/微盘 (Motorized Mini Spool) -->
        <div class="remote-spool-wrap">
          <div class="remote-spool" :class="{ spinning: isPlaying }">
            <span class="spool-spoke s1"></span>
            <span class="spool-spoke s2"></span>
            <span class="spool-spoke s3"></span>
            <div class="spool-hub"></div>
          </div>
        </div>

        <!-- 读数与曲目信息 -->
        <div class="remote-display">
          <div class="remote-status-row">
            <span class="remote-led-dot" :class="{ active: isPlaying }"></span>
            <span class="remote-mono-tag">OP-12 // {{ isPlaying ? 'PLAY' : 'STBY' }}</span>
            <span v-if="currentTrack.isFull" class="remote-badge-full">LOSSLESS</span>
            <span v-else-if="currentTrack.isTrial" class="remote-badge-trial">TRIAL</span>
          </div>
          <span class="remote-title" :title="currentTrack.title">{{ currentTrack.title }}</span>
        </div>

        <!-- 微型均衡器 -->
        <div class="remote-meter">
          <span class="m-bar mb-1" :class="{ run: isPlaying }"></span>
          <span class="m-bar mb-2" :class="{ run: isPlaying }"></span>
          <span class="m-bar mb-3" :class="{ run: isPlaying }"></span>
        </div>

        <!-- 硬件微动播放按键 -->
        <button
          class="remote-tactile-btn"
          @click.stop="togglePlay"
          :aria-label="isPlaying ? '暂停' : '播放'"
        >
          <span v-if="isLoading" class="te-spinner-mini"></span>
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
    <!-- 2. 展开态工业控制台 (TE Studio Console Deck)           -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="console-pop">
      <div v-if="isExpanded" class="console-scrim" @click.self="toggleExpand">
        <div class="console-chassis">
          <!-- 四角微型内六角沉头螺钉 (Industrial Chassis Screws) -->
          <span class="chassis-screw screw-tl"></span>
          <span class="chassis-screw screw-tr"></span>
          <span class="chassis-screw screw-bl"></span>
          <span class="chassis-screw screw-br"></span>

          <!-- ── 顶栏：仪表读数与硬件开关 ── -->
          <div class="console-header-block">
            <div class="status-meter-strip">
              <div class="system-ident">
                <span class="status-led-pill" :class="{ online: isPlaying }">
                  <span class="led-pip"></span>
                  <span class="led-txt">{{ isPlaying ? 'DSP: ACTIVE' : 'DSP: STANDBY' }}</span>
                </span>
                <span class="system-code">TE // VAR-LAB 44.1kHz</span>
              </div>

              <div class="header-tools">
                <button
                  class="station-link-trigger"
                  @click="showNeteaseModal = true"
                  title="查看云端节点通信诊断"
                >
                  <span class="cloud-dot" :class="{ linked: isApiConnected }"></span>
                  <span class="cloud-txt">{{ isApiConnected ? `LINKED ${apiLatency}ms` : 'OFFLINE' }}</span>
                </button>
                <button
                  class="chassis-close-btn"
                  @click="toggleExpand"
                  aria-label="关闭控制台"
                  title="收起至便携遥控器 [ESC]"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- 硬件拨码选择档位 (Tactile Segmented Switch) -->
            <div class="chassis-nav-switches">
              <button
                class="switch-key"
                :class="{ active: activeTab === 'player' }"
                @click="activeTab = 'player'"
              >
                <span class="key-index">01</span>
                <span class="key-label">PLTR 唱盘</span>
              </button>
              <button
                class="switch-key"
                :class="{ active: activeTab === 'lyrics' }"
                @click="activeTab = 'lyrics'"
              >
                <span class="key-index">02</span>
                <span class="key-label">LYRC 歌词</span>
                <span v-if="hasLyrics" class="key-dot-badge"></span>
              </button>
              <button
                class="switch-key"
                :class="{ active: activeTab === 'search' }"
                @click="activeTab = 'search'"
              >
                <span class="key-index">03</span>
                <span class="key-label">SRCH 检索</span>
              </button>
              <button
                class="switch-key"
                :class="{ active: activeTab === 'playlist' }"
                @click="activeTab = 'playlist'"
              >
                <span class="key-index">04</span>
                <span class="key-label">QUEU 队列</span>
              </button>
              <button
                class="switch-key"
                :class="{ active: activeTab === 'user-playlists' }"
                @click="activeTab = 'user-playlists'"
              >
                <span class="key-index">05</span>
                <span class="key-label">DISK 歌单</span>
              </button>
            </div>
          </div>

          <!-- ── 中部主要工作区 (Main Stage Viewport) ── -->
          <div class="console-stage-viewport">
            <!-- 档位 01: 直驱精密唱盘 (Direct-Drive Motor Platter) -->
            <div v-if="activeTab === 'player'" class="stage-view-player">
              <!-- 直驱转盘总成 -->
              <div
                class="direct-drive-deck"
                @click="activeTab = 'lyrics'"
                title="点击转盘直接切换至大屏歌词终端"
              >
                <!-- 频闪测速外圈 (Strobe Bezel) -->
                <div class="strobe-bezel" :class="{ spinning: isPlaying }">
                  <!-- 凹槽唱片盘面 -->
                  <div class="vinyl-platter-body">
                    <div class="groove-layer g-outer"></div>
                    <div class="groove-layer g-mid"></div>
                    <div class="groove-layer g-inner"></div>
                    <div class="anisotropic-sheen"></div>

                    <!-- 滚花中心压片与封面 (Knurled Clamp & Cover) -->
                    <div class="center-clamp">
                      <img :src="currentTrack.coverUrl" alt="cover" class="clamp-artwork" />
                      <div class="spindle-knurl"></div>
                      <div class="spindle-center-bore"></div>
                    </div>
                  </div>
                </div>

                <!-- 边缘精密光学拾音指示器 (Optical Pickup Indicator) -->
                <div class="optical-pickup-head" :class="{ active: isPlaying }">
                  <div class="pickup-beam"></div>
                  <div class="pickup-diode"></div>
                </div>

                <!-- 快捷翻转提示徽标 -->
                <div class="deck-flip-hint">
                  <span>LYRICS ⇄</span>
                </div>
              </div>

              <!-- 嵌入式信息面板 (Recessed Meta Bay) -->
              <div class="track-readout-bay">
                <div class="track-headline-row">
                  <h3 class="track-name" :title="currentTrack.title">{{ currentTrack.title }}</h3>
                  <span v-if="playbackStatus === 'resolving'" class="tech-pill resolving">
                    PARSING...
                  </span>
                  <span v-else-if="playbackStatus === 'error'" class="tech-pill error" :title="playbackError">
                    ERR: SIGNAL LOST
                  </span>
                  <span v-else class="tech-pill" :class="{ full: currentTrack.isFull, trial: currentTrack.isTrial }">
                    {{ currentTrack.isTrial ? '30S TRIAL' : (currentTrack.isFull ? 'MASTER LOSSLESS' : 'SAMPLE') }}
                  </span>
                </div>
                <div class="track-sub-row">
                  <span class="sub-artist">{{ currentTrack.artist }}</span>
                  <span class="sub-sep">//</span>
                  <span class="sub-album">{{ currentTrack.album }}</span>
                </div>
              </div>

              <!-- 分段式 LED 电平频段仪 (Segmented LED Ladder VU Meter) -->
              <div class="vu-meter-module">
                <canvas ref="canvasRef" class="vu-canvas"></canvas>
                <div class="vu-scale-ticks">
                  <span>-24dB</span>
                  <span>-12dB</span>
                  <span>-6dB</span>
                  <span>0dB</span>
                  <span class="tick-peak">PEAK</span>
                </div>
              </div>

              <!-- 标尺型进度寻轨器 (Precision Ruler Scrubber) -->
              <div class="ruler-scrubber-module">
                <div
                  class="scrub-track-area"
                  @pointerdown="handleProgressPointerDown"
                  @mousemove="handleProgressMouseMove"
                  @mouseleave="handleProgressMouseLeave"
                >
                  <div
                    v-if="showHoverTooltip"
                    class="scrub-precision-tooltip"
                    :style="{ left: `${hoverTooltipX}px` }"
                  >
                    {{ formatPreciseTime(hoverPct * (duration || 180)) }}
                  </div>

                  <!-- 标尺底衬与刻度点 -->
                  <div class="ruler-scale-bg"></div>
                  <div class="ruler-fill-bar" :style="{ width: `${progressPercent}%` }">
                    <div class="ruler-slider-handle" :class="{ dragging: isScrubbing }">
                      <div class="handle-pip"></div>
                    </div>
                  </div>
                </div>

                <div class="ruler-time-readout">
                  <span class="mono-time">{{ formatPreciseTime(displayCurrentTime) }}</span>
                  <span class="mono-divider">/</span>
                  <span class="mono-time total">{{ formatPreciseTime(duration) }}</span>
                </div>
              </div>
            </div>

            <!-- 档位 02: 工业歌词终端视窗 (OLED Terminal Lyrics) -->
            <div v-else-if="activeTab === 'lyrics'" class="stage-view-lyrics">
              <div class="terminal-lyrics-head">
                <div class="lyrics-sys-stat">
                  <span class="terminal-prompt">&gt;</span>
                  <span class="terminal-title">LIVE SYNC LRC</span>
                  <span class="terminal-clock">{{ formatTime(currentTime) }}</span>
                </div>
                <span v-if="currentTrack.isTrial" class="terminal-trial-flag">
                  SYNCING TRIAL RANGE (30s)
                </span>
              </div>

              <div
                ref="lyricsScrollContainer"
                class="terminal-lyrics-screen"
                @wheel="handleUserLyricScroll"
                @touchstart="handleUserLyricScroll"
              >
                <!-- 加载状态 -->
                <div v-if="isLoadingLyrics" class="lyrics-term-msg">
                  <span class="te-spinner"></span>
                  <span class="msg-txt">FETCHING LYRIC STREAM...</span>
                </div>

                <!-- 纯音乐或未收录 -->
                <div
                  v-else-if="isInstrumental || currentLyrics.length === 0"
                  class="lyrics-term-msg instrumental"
                >
                  <div class="oscilloscope-wave">
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <span class="msg-bold">INSTRUMENTAL TRACK</span>
                  <span class="msg-sub">纯音乐 · 请在旋律中漫步探索</span>
                </div>

                <!-- 歌词行矩阵 -->
                <div v-else class="lyrics-matrix">
                  <div class="terminal-spacer"></div>
                  <div
                    v-for="(line, idx) in currentLyrics"
                    :key="line.id"
                    :ref="(el) => setLyricLineRef(el, idx)"
                    class="terminal-lyric-row"
                    :class="{
                      active: idx === currentLineIndex,
                      past: idx < currentLineIndex,
                      future: idx > currentLineIndex
                    }"
                    @click="handleLyricClick(line.time)"
                  >
                    <!-- 左侧时间戳标尺 -->
                    <span class="gutter-timestamp">{{ formatTime(line.time) }}</span>
                    <!-- 机械游标指示符 -->
                    <span class="row-indicator">{{ idx === currentLineIndex ? '▶' : ' ' }}</span>
                    <!-- 歌词文本 -->
                    <div class="lyric-content-bay">
                      <p class="origin-text">{{ line.text }}</p>
                      <p v-if="line.translation" class="trans-text">{{ line.translation }}</p>
                    </div>
                  </div>
                  <div class="terminal-spacer"></div>
                </div>
              </div>
            </div>

            <!-- 档位 03: 曲库检索控制台 (Cloud Search Console) -->
            <div v-else-if="activeTab === 'search'" class="stage-view-search">
              <div class="chassis-search-box">
                <span class="cli-arrow">&gt;</span>
                <input
                  v-model="searchKeyword"
                  type="text"
                  class="chassis-search-input"
                  placeholder="检索歌曲、歌手或网易云单曲 ID"
                  @keyup.enter="handleSearch()"
                />
                <button class="search-action-btn" @click="handleSearch()">EXEC</button>
              </div>

              <div class="search-tag-chips">
                <span class="chip-caption">TAGS:</span>
                <button
                  v-for="tag in hotTags"
                  :key="tag"
                  class="micro-tag-btn"
                  @click="handleSearch(tag)"
                >
                  {{ tag }}
                </button>
              </div>

              <div class="search-output-deck">
                <div v-if="isSearching" class="output-placeholder">
                  <span class="te-spinner"></span>
                  <span>QUERYING CLOUD REPOSITORY...</span>
                </div>

                <div v-else-if="searchError" class="output-placeholder error">
                  {{ searchError }}
                </div>

                <div v-else-if="searchResults.length === 0" class="output-placeholder intro">
                  <span class="ascii-glyph">✦</span>
                  <span class="intro-headline">CLOUD AUDIO ARCHIVE</span>
                  <p class="intro-caption">输入曲目名称或歌手关键词，检索即时音频信号</p>
                </div>

                <div v-else class="results-table">
                  <div
                    v-for="(item, idx) in searchResults"
                    :key="item.id"
                    class="track-result-row"
                    @click="handleSelectSearchResult(item)"
                  >
                    <span class="row-idx">{{ String(idx + 1).padStart(2, '0') }}</span>
                    <img :src="item.coverUrl" alt="cover" class="row-mini-thumb" />
                    <div class="row-name-box">
                      <span class="row-song-title">{{ item.title }}</span>
                      <span class="row-song-artist">{{ item.artist }}</span>
                    </div>
                    <button class="row-play-trigger" title="加载并播放">PLAY ▶</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 档位 04: 当前播放队列 (Active Queue) -->
            <div v-else-if="activeTab === 'playlist'" class="stage-view-playlist">
              <div class="view-header-strip">
                <span class="strip-label">CURRENT QUEUE ({{ playlist.length }})</span>
                <span class="strip-badge">HOT MEMORY</span>
              </div>

              <div class="queue-table-scroll">
                <div
                  v-for="(item, idx) in playlist"
                  :key="item.id"
                  class="queue-item-row"
                  :class="{ active: idx === currentTrackIndex }"
                  @click="selectTrack(idx)"
                >
                  <span class="queue-num">{{ String(idx + 1).padStart(2, '0') }}</span>
                  <img :src="item.coverUrl" alt="cover" class="queue-thumb" />
                  <div class="queue-meta">
                    <span class="queue-name">{{ item.title }}</span>
                    <span class="queue-sub">{{ item.artist }}</span>
                  </div>
                  <span v-if="idx === currentTrackIndex && isPlaying" class="queue-live-tag">RUNNING</span>
                  <span v-else class="queue-duration">{{ formatTime(item.duration) }}</span>
                </div>
              </div>
            </div>

            <!-- 档位 05: 站长精选公开唱片盒 (Curated Playlists) -->
            <div v-else-if="activeTab === 'user-playlists'" class="stage-view-user-playlists">
              <div class="view-header-strip">
                <span class="strip-label">{{ stationUser.nickname }} · CURATED TAPES ({{ userPlaylists.length }})</span>
                <span class="strip-badge">PUBLIC</span>
              </div>

              <div class="playlists-tape-grid">
                <div
                  v-for="pl in userPlaylists"
                  :key="pl.id"
                  class="tape-cartridge"
                  :class="{ loading: currentLoadingPlaylistId === pl.id }"
                  @click="handleSelectNeteasePlaylist(pl.id)"
                >
                  <div class="tape-cover-cradle">
                    <img :src="pl.coverImgUrl" alt="cover" class="tape-art" />
                    <span v-if="currentLoadingPlaylistId === pl.id" class="tape-spin-overlay">
                      <span class="te-spinner-mini"></span>
                    </span>
                  </div>
                  <div class="tape-info-bay">
                    <span class="tape-title" :title="pl.name">{{ pl.name }}</span>
                    <span class="tape-specs">{{ pl.trackCount }} TRACKS // STATION FEED</span>
                  </div>
                  <button class="tape-load-lever" :disabled="currentLoadingPlaylistId === pl.id">
                    {{ currentLoadingPlaylistId === pl.id ? 'MOUNTING...' : 'MOUNT' }}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- ── 底部控制台：机械按键组 (Hardware Control Deck) ── -->
          <div class="hardware-control-deck">
            <!-- 模式拨码 (Mode Toggle) -->
            <button
              class="hw-key key-mode"
              @click="togglePlayMode"
              :title="`播放模式: ${playModeDescription}`"
            >
              <span class="key-sub-label">MODE</span>
              <span class="key-mode-code">{{ playModeLabel }}</span>
            </button>

            <!-- 上一曲 -->
            <button class="hw-key key-skip" @click="prevTrack" title="上一曲 [PREV]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="19 20 9 12 19 4 19 20" />
                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" />
              </svg>
            </button>

            <!-- 主播放/暂停 (Primary Tactile Engine Key) -->
            <button
              class="hw-key-primary"
              :class="{ playing: isPlaying }"
              @click="togglePlay"
              :aria-label="isPlaying ? '暂停' : '播放'"
            >
              <span v-if="isLoading" class="te-spinner primary"></span>
              <svg v-else-if="!isPlaying" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            </button>

            <!-- 下一曲 -->
            <button class="hw-key key-skip" @click="nextTrack" title="下一曲 [NEXT]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" />
              </svg>
            </button>

            <!-- 音量调节推子 (Fader Volume Pot) -->
            <div class="hw-fader-block">
              <button class="fader-mute-btn" @click="toggleMute" title="静音切换">
                <svg v-if="isMuted || volume === 0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              </button>
              <div class="fader-slider-wrap">
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="isMuted ? 0 : volume * 100"
                  class="te-fader-input"
                  @input="handleVolumeChange"
                  title="音量调节"
                />
                <span class="fader-scale-tag">VOL</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ══════════════════════════════════════════════════════ -->
    <!-- 3. 云端接口与节点诊断弹窗 (Hardware Diagnostics)       -->
    <!-- ══════════════════════════════════════════════════════ -->
    <Transition name="diag-pop">
      <div v-if="showNeteaseModal" class="diag-scrim" @click.self="showNeteaseModal = false">
        <div class="diag-chassis">
          <div class="diag-header">
            <div class="diag-title-row">
              <span class="diag-led"></span>
              <span class="diag-headline">DIAGNOSTICS // CLOUD LINK</span>
            </div>
            <button class="diag-close" @click="showNeteaseModal = false">✕</button>
          </div>

          <div class="diag-body">
            <!-- 站长电台信息 -->
            <div class="diag-card-unit">
              <div class="unit-banner">
                <img :src="stationUser.avatarUrl" alt="avatar" class="unit-avatar" />
                <div class="unit-meta">
                  <span class="unit-nick">{{ stationUser.nickname }}</span>
                  <span class="unit-desc">STATION MASTER · {{ userPlaylists.length }} ALBUMS ONLINE</span>
                </div>
              </div>
            </div>

            <!-- API 节点状态 -->
            <div class="diag-card-unit">
              <span class="unit-label">SERVICE ENDPOINT</span>
              <div class="endpoint-line">
                <code>{{ apiUrl }}</code>
                <span class="ping-badge" :class="{ ok: isApiConnected }">
                  {{ isApiConnected ? `ONLINE (${apiLatency}ms)` : 'UNREACHABLE' }}
                </span>
              </div>
              <p v-if="apiTestMessage" class="diag-hint">{{ apiTestMessage }}</p>
              <button
                class="diag-action-btn"
                :disabled="apiTesting"
                @click="testCurrentApi()"
              >
                {{ apiTesting ? 'PINGING...' : 'TEST LATENCY' }}
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
   TEENAGE ENGINEERING / 现代工业设计系统 (TE DESIGN SYSTEM)
   ═══════════════════════════════════════════════════════════════ */

/* ── 1. 悬浮遥控微胶囊 (Pocket Remote Dock) ── */
.pocket-remote {
  position: fixed;
  left: 24px;
  bottom: 28px;
  z-index: 1000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px 8px 10px;
  background: #141618;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  box-shadow:
    0 16px 36px -6px rgba(0, 0, 0, 0.55),
    0 2px 8px rgba(0, 0, 0, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.12);
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.2, 0.8, 0.2, 1);
  user-select: none;
  font-family: 'JetBrains Mono', 'SF Mono', -apple-system, monospace;
}

.pocket-remote:hover {
  background: #1A1D20;
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
  box-shadow:
    0 20px 42px -6px rgba(0, 0, 0, 0.65),
    inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

/* 机械微型齿轮/卷带轮 */
.remote-spool-wrap {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #22252A;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.6);
}

.remote-spool {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #121315;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.remote-spool.spinning {
  animation: spool-rotate 6s linear infinite;
}

@keyframes spool-rotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.spool-spoke {
  position: absolute;
  width: 2px;
  height: 100%;
  background: rgba(255, 255, 255, 0.18);
  border-radius: 1px;
}
.spool-spoke.s1 { transform: rotate(0deg); }
.spool-spoke.s2 { transform: rotate(60deg); }
.spool-spoke.s3 { transform: rotate(120deg); }

.spool-hub {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #FF5500;
  box-shadow: 0 0 6px rgba(255, 85, 0, 0.6);
  z-index: 2;
}

/* 读数区域 */
.remote-display {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  max-width: 140px;
}

.remote-status-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.remote-led-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #555860;
  transition: all 0.3s;
}

.remote-led-dot.active {
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
  animation: led-pulse 2s ease-in-out infinite;
}

@keyframes led-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.remote-mono-tag {
  font-size: 0.65rem;
  letter-spacing: 0.05em;
  color: #8E929A;
  text-transform: uppercase;
}

.remote-badge-full {
  font-size: 0.58rem;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(16, 185, 129, 0.15);
  color: #10B981;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.remote-badge-trial {
  font-size: 0.58rem;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(255, 85, 0, 0.15);
  color: #FF5500;
  border: 1px solid rgba(255, 85, 0, 0.3);
}

.remote-title {
  font-size: 0.82rem;
  color: #F0F2F5;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.02em;
}

/* 微型电平条 */
.remote-meter {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
  margin-left: 2px;
}

.m-bar {
  width: 2px;
  background: #3A3D44;
  border-radius: 1px;
}
.m-bar.mb-1 { height: 4px; }
.m-bar.mb-2 { height: 8px; }
.m-bar.mb-3 { height: 6px; }

.m-bar.run {
  background: #10B981;
  animation: bar-dance 1.2s ease-in-out infinite alternate;
}
.m-bar.mb-1.run { animation-delay: 0.1s; }
.m-bar.mb-2.run { animation-delay: 0.3s; }
.m-bar.mb-3.run { animation-delay: 0.2s; }

@keyframes bar-dance {
  0% { height: 3px; }
  100% { height: 12px; }
}

/* 硬件微动按键 */
.remote-tactile-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #24272D;
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #F0F2F5;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.remote-tactile-btn:hover {
  background: #2E323A;
  color: #FF5500;
  border-color: rgba(255, 85, 0, 0.4);
}

.remote-tactile-btn:active {
  transform: translateY(1px) scale(0.96);
  background: #1A1C20;
}

/* ── 2. 展开态工作室工作台 (TE Studio Console) ── */
.console-scrim {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(10, 12, 15, 0.78);
  backdrop-filter: blur(24px) saturate(180%);
  -webkit-backdrop-filter: blur(24px) saturate(180%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.console-chassis {
  width: 100%;
  max-width: 480px;
  background: #181A1D;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 20px;
  position: relative;
  box-shadow:
    0 32px 80px -12px rgba(0, 0, 0, 0.8),
    0 12px 30px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'JetBrains Mono', 'SF Mono', -apple-system, BlinkMacSystemFont, monospace;
}

/* 机械四角沉头螺丝 */
.chassis-screw {
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2A2D33;
  border: 1px solid rgba(0, 0, 0, 0.5);
  box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.15);
  z-index: 20;
  pointer-events: none;
}
.screw-tl { top: 12px; left: 12px; }
.screw-tr { top: 12px; right: 12px; }
.screw-bl { bottom: 12px; left: 12px; }
.screw-br { bottom: 12px; right: 12px; }

/* ── 顶栏套件 (Header Suite) ── */
.console-header-block {
  padding: 16px 20px 12px;
  background: #141518;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.status-meter-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.system-ident {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-led-pill {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px;
  background: #1F2227;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}

.led-pip {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #555860;
  transition: all 0.3s;
}

.status-led-pill.online .led-pip {
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
}

.led-txt {
  font-size: 0.68rem;
  color: #9EADB8;
  font-weight: 500;
  letter-spacing: 0.04em;
}

.system-code {
  font-size: 0.65rem;
  color: #555962;
  letter-spacing: 0.08em;
}

.header-tools {
  display: flex;
  align-items: center;
  gap: 8px;
}

.station-link-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: #1F2227;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.65rem;
  color: #8E929A;
  transition: all 0.2s;
}

.station-link-trigger:hover {
  background: #282C33;
  color: #FFFFFF;
}

.cloud-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #EF4444;
}
.cloud-dot.linked {
  background: #10B981;
  box-shadow: 0 0 6px #10B981;
}

.chassis-close-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: #24272D;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #8E929A;
  font-size: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.chassis-close-btn:hover {
  background: #FF5500;
  color: white;
  border-color: #FF5500;
}

/* 硬件拨码选择档位 (Tactile Segmented Switch) */
.chassis-nav-switches {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  background: #0E0F12;
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.switch-key {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 6px 2px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.18s ease;
  font-family: inherit;
}

.key-index {
  font-size: 0.58rem;
  color: #555962;
  letter-spacing: 0.05em;
}

.key-label {
  font-size: 0.72rem;
  color: #8E929A;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.switch-key:hover {
  background: #1A1D22;
  color: #FFFFFF;
}

.switch-key.active {
  background: #24272E;
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.switch-key.active .key-index {
  color: #FF5500;
  font-weight: 600;
}

.switch-key.active .key-label {
  color: #FFFFFF;
  font-weight: 600;
}

.key-dot-badge {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #FF5500;
  box-shadow: 0 0 6px #FF5500;
}

/* ── 中部工作区 (Console Stage Viewport) ── */
.console-stage-viewport {
  padding: 16px 20px;
  min-height: 380px;
  max-height: 420px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: relative;
}

/* ── 档位 01: 直驱精密唱机 (Direct-Drive Motor Platter) ── */
.stage-view-player {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* 直驱转盘总成 */
.direct-drive-deck {
  width: 196px;
  height: 196px;
  margin: 0 auto;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

/* 频闪齿纹外圈 (Strobe Bezel) */
.strobe-bezel {
  width: 196px;
  height: 196px;
  border-radius: 50%;
  background: repeating-conic-gradient(
    from 0deg,
    #33373F 0deg 2.5deg,
    #141619 2.5deg 5deg
  );
  box-shadow:
    0 16px 36px rgba(0, 0, 0, 0.7),
    0 0 0 1px #3A3E47,
    inset 0 0 0 2px #0E1012;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: transform 0.2s ease;
}

.direct-drive-deck:hover .strobe-bezel {
  transform: scale(1.02);
}

.strobe-bezel.spinning {
  animation: drive-spin 10s linear infinite;
}

@keyframes drive-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 盘面凹槽 */
.vinyl-platter-body {
  width: 174px;
  height: 174px;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle,
      rgba(255, 255, 255, 0.02) 0px,
      rgba(255, 255, 255, 0.02) 1px,
      transparent 1px,
      transparent 3px
    ),
    radial-gradient(circle, #202328 0%, #0D0E10 100%);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.groove-layer {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}
.g-outer { width: 154px; height: 154px; border: 1px solid rgba(255, 255, 255, 0.04); }
.g-mid   { width: 128px; height: 128px; border: 1px dashed rgba(255, 255, 255, 0.05); }
.g-inner { width: 104px; height: 104px; border: 1px solid rgba(255, 255, 255, 0.04); }

.anisotropic-sheen {
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

/* 滚花中心压片与封面 (Knurled Clamp) */
.center-clamp {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #181A1D;
  position: relative;
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.8),
    0 0 0 2px #3A3E47,
    inset 0 0 0 1px rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  z-index: 3;
}

.clamp-artwork {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.spindle-knurl {
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: radial-gradient(circle, #3D424C 0%, #1A1C20 100%);
  border: 1px solid #5A606D;
  box-shadow: inset 0 1px 2px rgba(255, 255, 255, 0.4);
}

.spindle-center-bore {
  position: absolute;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #08090A;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 边缘光学拾音指示器 (Optical Pickup) */
.optical-pickup-head {
  position: absolute;
  top: -4px;
  right: 28px;
  width: 14px;
  height: 24px;
  background: #25282F;
  border: 1px solid #434854;
  border-radius: 3px;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  padding-bottom: 3px;
  z-index: 5;
}

.pickup-diode {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #666;
  transition: all 0.3s;
}

.optical-pickup-head.active .pickup-diode {
  background: #FF5500;
  box-shadow: 0 0 8px #FF5500;
}

.deck-flip-hint {
  position: absolute;
  bottom: 0;
  right: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(36, 39, 46, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 0.6rem;
  color: #8E929A;
  letter-spacing: 0.05em;
  opacity: 0;
  transition: opacity 0.2s;
}

.direct-drive-deck:hover .deck-flip-hint {
  opacity: 1;
}

/* 嵌入式信息面板 (Recessed Meta Bay) */
.track-readout-bay {
  background: #131417;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.4);
}

.track-headline-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.track-name {
  font-size: 1.05rem;
  font-weight: 600;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  letter-spacing: 0.01em;
  margin: 0;
}

.tech-pill {
  font-size: 0.62rem;
  padding: 2px 6px;
  border-radius: 3px;
  background: #1C1E23;
  color: #8E929A;
  border: 1px solid rgba(255, 255, 255, 0.08);
  white-space: nowrap;
  letter-spacing: 0.04em;
}

.tech-pill.full {
  background: rgba(16, 185, 129, 0.15);
  color: #10B981;
  border-color: rgba(16, 185, 129, 0.3);
}

.tech-pill.trial {
  background: rgba(255, 85, 0, 0.15);
  color: #FF5500;
  border-color: rgba(255, 85, 0, 0.3);
}

.tech-pill.resolving {
  color: #3B82F6;
  border-color: rgba(59, 130, 246, 0.3);
}

.tech-pill.error {
  color: #EF4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.track-sub-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.75rem;
  color: #7A808C;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sub-sep {
  color: #444852;
}

/* 分段式 LED 电平频段仪 */
.vu-meter-module {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.vu-canvas {
  width: 100%;
  height: 24px;
  background: #0E0F12;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: block;
}

.vu-scale-ticks {
  display: flex;
  justify-content: space-between;
  font-size: 0.56rem;
  color: #4A4E58;
  padding: 0 4px;
  letter-spacing: 0.05em;
}

.tick-peak {
  color: #EF4444;
  opacity: 0.8;
}

/* 标尺型进度寻轨器 (Precision Ruler Scrubber) */
.ruler-scrubber-module {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scrub-track-area {
  position: relative;
  height: 20px;
  display: flex;
  align-items: center;
  cursor: pointer;
  touch-action: none;
}

.scrub-precision-tooltip {
  position: absolute;
  top: -24px;
  transform: translateX(-50%);
  padding: 2px 6px;
  background: #000000;
  border: 1px solid #FF5500;
  border-radius: 3px;
  font-size: 0.65rem;
  color: #FF5500;
  pointer-events: none;
  white-space: nowrap;
  z-index: 10;
}

.ruler-scale-bg {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background:
    repeating-linear-gradient(
      to right,
      rgba(255, 255, 255, 0.12) 0px,
      rgba(255, 255, 255, 0.12) 1px,
      transparent 1px,
      transparent 8px
    ),
    #131417;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ruler-fill-bar {
  position: absolute;
  left: 0;
  height: 6px;
  border-radius: 3px;
  background: #FF5500;
  pointer-events: none;
}

.ruler-slider-handle {
  position: absolute;
  right: -5px;
  top: -4px;
  width: 10px;
  height: 14px;
  background: #ECEEF2;
  border: 1px solid #1A1C20;
  border-radius: 2px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.1s;
}

.handle-pip {
  width: 2px;
  height: 8px;
  background: #FF5500;
}

.ruler-slider-handle.dragging {
  transform: scale(1.2);
}

.ruler-time-readout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.7rem;
  color: #7A808C;
}

.mono-time {
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
}

.mono-time.total {
  color: #4A4E58;
}

/* ── 档位 02: 工业歌词终端 (OLED Terminal Lyrics) ── */
.stage-view-lyrics {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #111215;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.6);
}

.terminal-lyrics-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 14px;
  background: #0E0F12;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 0.68rem;
}

.lyrics-sys-stat {
  display: flex;
  align-items: center;
  gap: 8px;
}

.terminal-prompt {
  color: #FF5500;
  font-weight: bold;
}

.terminal-title {
  color: #8E929A;
  letter-spacing: 0.06em;
}

.terminal-clock {
  color: #10B981;
}

.terminal-trial-flag {
  color: #FF5500;
  font-size: 0.62rem;
}

.terminal-lyrics-screen {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  position: relative;
  padding: 0 16px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 1) 18%,
    rgba(0, 0, 0, 1) 82%,
    transparent 100%
  );
  mask-image: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(0, 0, 0, 1) 18%,
    rgba(0, 0, 0, 1) 82%,
    transparent 100%
  );
}
.terminal-lyrics-screen::-webkit-scrollbar { display: none; }

.terminal-spacer {
  height: 110px;
  flex-shrink: 0;
}

.lyrics-matrix {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.terminal-lyric-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
  user-select: none;
}

.gutter-timestamp {
  font-size: 0.7rem;
  color: #4A4E58;
  width: 42px;
  flex-shrink: 0;
  padding-top: 2px;
}

.row-indicator {
  width: 12px;
  font-size: 0.75rem;
  color: #FF5500;
  flex-shrink: 0;
  padding-top: 2px;
}

.lyric-content-bay {
  flex: 1;
}

.origin-text {
  font-size: 0.98rem;
  line-height: 1.45;
  color: #727782;
  transition: all 0.2s;
  margin: 0;
}

.trans-text {
  font-size: 0.82rem;
  line-height: 1.35;
  color: #4A4E58;
  margin: 3px 0 0;
  transition: all 0.2s;
}

/* 高亮激活行 */
.terminal-lyric-row.active {
  background: rgba(255, 85, 0, 0.08);
}

.terminal-lyric-row.active .gutter-timestamp {
  color: #FF5500;
}

.terminal-lyric-row.active .origin-text {
  font-size: 1.15rem;
  font-weight: 600;
  color: #FFFFFF;
  text-shadow: 0 0 16px rgba(255, 85, 0, 0.35);
}

.terminal-lyric-row.active .trans-text {
  font-size: 0.88rem;
  color: #D2D6DF;
}

.terminal-lyric-row:hover:not(.active) {
  background: rgba(255, 255, 255, 0.04);
}

.terminal-lyric-row:hover:not(.active) .origin-text {
  color: #C0C5CF;
}

/* 状态提示 */
.lyrics-term-msg {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #8E929A;
  font-size: 0.85rem;
  padding: 40px 20px;
  text-align: center;
}

.oscilloscope-wave {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 28px;
}
.oscilloscope-wave span {
  width: 3px;
  height: 16px;
  background: #FF5500;
  border-radius: 2px;
  animation: osc-pulse 1.4s ease-in-out infinite alternate;
}
.oscilloscope-wave span:nth-child(2) { height: 26px; animation-delay: 0.2s; }
.oscilloscope-wave span:nth-child(3) { height: 10px; animation-delay: 0.4s; }
.oscilloscope-wave span:nth-child(4) { height: 22px; animation-delay: 0.1s; }
.oscilloscope-wave span:nth-child(5) { height: 14px; animation-delay: 0.3s; }

@keyframes osc-pulse {
  0% { transform: scaleY(0.4); opacity: 0.5; }
  100% { transform: scaleY(1); opacity: 1; }
}

.msg-bold {
  color: #FFFFFF;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.msg-sub {
  color: #555962;
  font-size: 0.78rem;
}

/* ── 档位 03: 检索控制台 (Cloud Search) ── */
.stage-view-search {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
}

.chassis-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #101215;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

.cli-arrow {
  color: #FF5500;
  font-weight: bold;
}

.chassis-search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #FFFFFF;
  font-family: inherit;
  font-size: 0.85rem;
}

.search-action-btn {
  padding: 4px 10px;
  background: #252830;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #D1D5DB;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.search-action-btn:hover {
  background: #FF5500;
  color: #FFFFFF;
}

.search-tag-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.chip-caption {
  font-size: 0.65rem;
  color: #555962;
}

.micro-tag-btn {
  padding: 2px 8px;
  background: #1B1D22;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: #8E929A;
  font-size: 0.7rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}

.micro-tag-btn:hover {
  border-color: #FF5500;
  color: #FF5500;
}

.search-output-deck {
  flex: 1;
  overflow-y: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  background: #111215;
  padding: 8px;
}

.output-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #555962;
  font-size: 0.8rem;
  padding: 30px;
  text-align: center;
}

.intro-headline {
  color: #8E929A;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.results-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.track-result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #15171C;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.track-result-row:hover {
  background: #1F2229;
  border-color: rgba(255, 255, 255, 0.1);
}

.row-idx {
  font-size: 0.7rem;
  color: #4A4E58;
  width: 18px;
}

.row-mini-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}

.row-name-box {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-song-title {
  font-size: 0.82rem;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-song-artist {
  font-size: 0.7rem;
  color: #727782;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-play-trigger {
  padding: 4px 8px;
  border-radius: 4px;
  background: #252830;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #10B981;
  font-size: 0.65rem;
  cursor: pointer;
  font-family: inherit;
}

.row-play-trigger:hover {
  background: #10B981;
  color: #000;
}

/* ── 档位 04: 当前队列 (Queue Table) ── */
.stage-view-playlist {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.view-header-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 4px;
  font-size: 0.68rem;
  color: #8E929A;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  padding-bottom: 6px;
}

.strip-badge {
  color: #FF5500;
}

.queue-table-scroll {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.queue-item-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #131518;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
}

.queue-item-row:hover {
  background: #1C1F25;
}

.queue-item-row.active {
  background: #20242C;
  border-color: rgba(255, 85, 0, 0.3);
}

.queue-num {
  font-size: 0.7rem;
  color: #4A4E58;
}

.queue-item-row.active .queue-num {
  color: #FF5500;
  font-weight: bold;
}

.queue-thumb {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  object-fit: cover;
}

.queue-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.queue-name {
  font-size: 0.82rem;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-sub {
  font-size: 0.7rem;
  color: #727782;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.queue-live-tag {
  font-size: 0.62rem;
  color: #10B981;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.queue-duration {
  font-size: 0.7rem;
  color: #4A4E58;
}

/* ── 档位 05: 精选唱片盒 (Curated Playlists) ── */
.stage-view-user-playlists {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.playlists-tape-grid {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tape-cartridge {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #14161A;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tape-cartridge:hover {
  background: #1D2026;
  border-color: rgba(255, 255, 255, 0.15);
}

.tape-cover-cradle {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.tape-art {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tape-spin-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tape-info-bay {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tape-title {
  font-size: 0.85rem;
  font-weight: 500;
  color: #FFFFFF;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tape-specs {
  font-size: 0.68rem;
  color: #727782;
}

.tape-load-lever {
  padding: 6px 12px;
  background: #252830;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  color: #FFFFFF;
  font-size: 0.68rem;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
}

.tape-load-lever:hover:not(:disabled) {
  background: #FF5500;
  border-color: #FF5500;
}

/* ── 底部控制台：机械按键组 (Hardware Control Deck) ── */
.hardware-control-deck {
  padding: 14px 20px 18px;
  background: #111215;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

/* 通用硬件按键 */
.hw-key {
  height: 42px;
  border-radius: 8px;
  background: #202328;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #D1D5DB;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 3px 6px rgba(0, 0, 0, 0.5),
    inset 0 1px 0 rgba(255, 255, 255, 0.1);
  transition: all 0.12s ease;
  font-family: inherit;
  flex-shrink: 0;
}

.hw-key:hover {
  background: #282C33;
  color: #FFFFFF;
  border-color: rgba(255, 255, 255, 0.18);
}

.hw-key:active {
  transform: translateY(2px) scale(0.97);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  background: #181A1E;
}

/* 模式按键 */
.key-mode {
  width: 48px;
  flex-direction: column;
  gap: 2px;
  padding: 4px 2px;
}

.key-sub-label {
  font-size: 0.5rem;
  color: #555962;
  letter-spacing: 0.08em;
}

.key-mode-code {
  font-size: 0.68rem;
  color: #FF5500;
  font-weight: bold;
}

/* 上下曲 */
.key-skip {
  width: 42px;
}

/* 标志性主按键 (Primary Tactile Engine Key) */
.hw-key-primary {
  width: 54px;
  height: 50px;
  border-radius: 12px;
  background: #FF5500;
  border: 1px solid #FF7733;
  color: #FFFFFF;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow:
    0 4px 14px rgba(255, 85, 0, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.35);
  transition: all 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
  flex-shrink: 0;
}

.hw-key-primary:hover {
  background: #FF661A;
  box-shadow: 0 6px 20px rgba(255, 85, 0, 0.6);
  transform: translateY(-1px);
}

.hw-key-primary:active {
  transform: translateY(2px) scale(0.96);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

/* 音量推子模块 */
.hw-fader-block {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 130px;
  padding-left: 6px;
}

.fader-mute-btn {
  background: transparent;
  border: none;
  color: #7A808C;
  cursor: pointer;
  display: flex;
  align-items: center;
  padding: 4px;
  transition: color 0.2s;
}

.fader-mute-btn:hover {
  color: #FFFFFF;
}

.fader-slider-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.te-fader-input {
  width: 100%;
  height: 4px;
  -webkit-appearance: none;
  background: #252830;
  border-radius: 2px;
  outline: none;
}

.te-fader-input::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 16px;
  background: #ECEEF2;
  border: 1px solid #141619;
  border-radius: 2px;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.6);
}

.fader-scale-tag {
  font-size: 0.55rem;
  color: #4A4E58;
  letter-spacing: 0.08em;
}

/* ── 3. 诊断与配置弹窗 (Hardware Diagnostics) ── */
.diag-scrim {
  position: fixed;
  inset: 0;
  z-index: 10050;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.diag-chassis {
  width: 100%;
  max-width: 420px;
  background: #1A1C20;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8);
  overflow: hidden;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
}

.diag-header {
  padding: 12px 16px;
  background: #141518;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.diag-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.diag-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FF5500;
  box-shadow: 0 0 8px #FF5500;
}

.diag-headline {
  font-size: 0.75rem;
  color: #FFFFFF;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.diag-close {
  background: transparent;
  border: none;
  color: #8E929A;
  cursor: pointer;
  font-size: 0.85rem;
}
.diag-close:hover { color: #FFFFFF; }

.diag-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.diag-card-unit {
  background: #131417;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.unit-banner {
  display: flex;
  align-items: center;
  gap: 10px;
}

.unit-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
}

.unit-meta {
  display: flex;
  flex-direction: column;
}

.unit-nick {
  font-size: 0.85rem;
  color: #FFFFFF;
  font-weight: 600;
}

.unit-desc {
  font-size: 0.65rem;
  color: #727782;
}

.unit-label {
  font-size: 0.62rem;
  color: #555962;
  letter-spacing: 0.08em;
}

.endpoint-line {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.endpoint-line code {
  font-size: 0.72rem;
  color: #10B981;
  background: #0E0F12;
  padding: 2px 6px;
  border-radius: 4px;
}

.ping-badge {
  font-size: 0.65rem;
  color: #EF4444;
}
.ping-badge.ok {
  color: #10B981;
}

.diag-hint {
  font-size: 0.68rem;
  color: #8E929A;
  margin: 0;
}

.diag-action-btn {
  padding: 6px 12px;
  background: #252830;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #FFFFFF;
  font-size: 0.72rem;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.diag-action-btn:hover:not(:disabled) {
  background: #FF5500;
  border-color: #FF5500;
}

/* ── 通用 Spinner ── */
.te-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-top-color: #FF5500;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.te-spinner.primary {
  border-top-color: #FFFFFF;
}

.te-spinner-mini {
  width: 12px;
  height: 12px;
  border: 1.5px solid rgba(255, 255, 255, 0.15);
  border-top-color: #FF5500;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ── 过渡动效 ── */
.remote-pop-enter-active,
.remote-pop-leave-active {
  transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.remote-pop-enter-from { opacity: 0; transform: translateY(16px) scale(0.92); }
.remote-pop-leave-to   { opacity: 0; transform: translateY(12px) scale(0.95); }

.console-pop-enter-active,
.console-pop-leave-active {
  transition: all 0.28s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.console-pop-enter-from { opacity: 0; transform: scale(0.94) translateY(12px); }
.console-pop-leave-to   { opacity: 0; transform: scale(0.96) translateY(-8px); }

.diag-pop-enter-active,
.diag-pop-leave-active {
  transition: all 0.25s ease;
}
.diag-pop-enter-from,
.diag-pop-leave-to { opacity: 0; transform: scale(0.94); }

/* ── 移动端适配 ── */
@media (max-width: 600px) {
  .pocket-remote {
    left: 16px;
    bottom: 20px;
    padding: 6px 12px 6px 8px;
  }
  .remote-display { max-width: 100px; }
  .console-scrim { padding: 12px; }
  .console-chassis { max-width: 100%; border-radius: 16px; }
  .console-stage-viewport { min-height: 350px; max-height: 380px; padding: 12px 14px; }
  .direct-drive-deck { width: 160px; height: 160px; }
  .strobe-bezel { width: 160px; height: 160px; }
  .vinyl-platter-body { width: 142px; height: 142px; }
  .center-clamp { width: 58px; height: 58px; }
  .hardware-control-deck { padding: 10px 14px 14px; }
  .hw-fader-block { display: none; } /* 移动端隐藏较宽的音量条，腾出按键空间 */
}
</style>
