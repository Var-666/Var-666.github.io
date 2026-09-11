import { ref, computed } from 'vue'
import { INITIAL_PLAYLIST, type Track } from '@/data/playlist'
import {
  getSavedApiUrl,
  fetchSongAudioUrl,
  fetchBatchSongAudioUrls,
  searchNeteaseSongs,
} from '@/services/neteaseApi'

export type PlaybackStatus = 'idle' | 'resolving' | 'loading' | 'playing' | 'paused' | 'error'

// ── 全局单例响应式状态 ──
const playlist = ref<Track[]>([...INITIAL_PLAYLIST])
const currentTrackIndex = ref(0)
const isPlaying = ref(false)
const isLoading = ref(false)
const currentTime = ref(0)
const duration = ref(INITIAL_PLAYLIST[0]?.duration || 312)
const volume = ref(1.0)
const isMuted = ref(false)
const isExpanded = ref(false)

// 明确的状态机与错误状态
const playbackStatus = ref<PlaybackStatus>('idle')
const playbackError = ref('')

// 搜索状态
const searchResults = ref<Track[]>([])
const isSearching = ref(false)
const searchError = ref('')

const currentTrack = computed<Track>(() => playlist.value[currentTrackIndex.value] || playlist.value[0])

// ── 音频直链缓存系统（带有效时间戳，防止 CDN 过期 403 死锁） ──
interface ResolvedCacheEntry {
  url: string
  timestamp: number
}
const resolvedUrlCache = new Map<string, ResolvedCacheEntry>()
const URL_CACHE_TTL = 15 * 60 * 1000 // 15 分钟有效，过期自动向 API 获取最新直链

// 序列锁（用于取消被快速连续切歌打断的旧请求，防竞态）
let playRequestId = 0

// ── 原生 HTML5 Audio 核心实例 ──
let audioEl: HTMLAudioElement | null = null
let isAudioInited = false

function initAudioEngine() {
  if (isAudioInited) return

  audioEl = new Audio()
  audioEl.preload = 'auto'
  audioEl.volume = isMuted.value ? 0 : volume.value

  // 绑定原生音频事件
  audioEl.addEventListener('timeupdate', () => {
    if (audioEl) {
      currentTime.value = Math.floor(audioEl.currentTime)
      if (!isNaN(audioEl.duration) && audioEl.duration > 0) {
        duration.value = Math.floor(audioEl.duration)
      }
    }
  })

  audioEl.addEventListener('loadedmetadata', () => {
    if (audioEl && !isNaN(audioEl.duration) && audioEl.duration > 0) {
      duration.value = Math.floor(audioEl.duration)
    }
  })

  audioEl.addEventListener('ended', () => {
    nextTrack()
  })

  audioEl.addEventListener('playing', () => {
    isPlaying.value = true
    isLoading.value = false
    playbackStatus.value = 'playing'
    playbackError.value = ''
  })

  audioEl.addEventListener('waiting', () => {
    isLoading.value = true
    playbackStatus.value = 'loading'
  })

  audioEl.addEventListener('pause', () => {
    isPlaying.value = false
    if (playbackStatus.value !== 'error') {
      playbackStatus.value = 'paused'
    }
  })

  audioEl.addEventListener('error', (e) => {
    console.warn('[AudioPlayer] 音频载入或解码失败:', e)
    isLoading.value = false
    isPlaying.value = false
    playbackStatus.value = 'error'
    playbackError.value = '音频载入异常，直链可能已过期或被网络阻断'
  })

  isAudioInited = true
}

/**
 * 解析并校验歌曲音频地址（带 15 分钟 TTL 缓存与过期重查）
 */
async function resolveTrackAudioUrl(track: Track): Promise<string | null> {
  // 1. 本地高保真音轨无需解析
  if (track.audioUrl.startsWith('/audio/')) {
    return track.audioUrl
  }

  // 2. 自定义外链直接可用
  if (!track.id.startsWith('netease-') && !track.audioUrl.includes('163.com')) {
    return track.audioUrl
  }

  const songId = track.id.replace('netease-', '')
  const now = Date.now()

  // 3. 检查缓存是否有效且未过期
  const cached = resolvedUrlCache.get(songId)
  if (cached && now - cached.timestamp < URL_CACHE_TTL) {
    track.audioUrl = cached.url
    track.isFull = true
    return cached.url
  }

  // 4. 向后端 API 请求最新的 VIP / 无损直链（10 秒宽裕超时）
  const apiUrl = getSavedApiUrl()
  if (!apiUrl) {
    // 未配置 API 时尝试原有兜底地址
    return track.audioUrl.startsWith('http') ? track.audioUrl : null
  }

  try {
    const resolvedUrl = await fetchSongAudioUrl(songId, apiUrl)
    if (resolvedUrl) {
      track.audioUrl = resolvedUrl
      track.isFull = true
      resolvedUrlCache.set(songId, { url: resolvedUrl, timestamp: now })
      return resolvedUrl
    }
  } catch (err) {
    console.warn(`[AudioPlayer] 解析单曲 (ID: ${songId}) 直链异常:`, err)
  }

  // 5. 若 API 未返回高品质直链，尝试使用外链，如果外链不存在则返回 null
  if (track.audioUrl && track.audioUrl.startsWith('http')) {
    return track.audioUrl
  }

  return null
}

/**
 * 批量预加载当前歌单曲目的 CDN 直链
 */
async function prefetchPlaylistAudioUrls(tracks: Track[]) {
  if (!tracks || tracks.length === 0) return
  const now = Date.now()
  const neteaseTracks = tracks.filter((t) => {
    if (!t.id.startsWith('netease-') || t.audioUrl.startsWith('/audio/')) return false
    const songId = t.id.replace('netease-', '')
    const cached = resolvedUrlCache.get(songId)
    return !cached || now - cached.timestamp >= URL_CACHE_TTL
  })

  if (neteaseTracks.length === 0) return

  const ids = neteaseTracks.map((t) => t.id.replace('netease-', ''))
  try {
    const urlMap = await fetchBatchSongAudioUrls(ids, getSavedApiUrl())
    for (const t of tracks) {
      const songId = t.id.replace('netease-', '')
      if (urlMap[songId]) {
        t.audioUrl = urlMap[songId]
        t.isFull = true
        resolvedUrlCache.set(songId, { url: urlMap[songId], timestamp: Date.now() })
      }
    }
  } catch (err) {
    console.warn('[AudioPlayer] 批量预加载直链异常:', err)
  }
}

// 延迟静默预热初始歌单
setTimeout(() => {
  prefetchPlaylistAudioUrls(playlist.value)
}, 100)

/**
 * 核心状态机执行器：单向严谨播放流
 * 解析直链 → 校验直链 → 装载媒体 → 唯一单次 play()
 */
async function startPlaybackPipeline(track: Track, reqId: number) {
  initAudioEngine()
  if (!audioEl) return

  playbackError.value = ''
  isLoading.value = true
  playbackStatus.value = 'resolving'

  // 阶段 1：解析音频直链
  const audioUrl = await resolveTrackAudioUrl(track)

  // 检查是否已被后续切歌请求打断，若已过期则直接退出
  if (reqId !== playRequestId) return

  if (!audioUrl) {
    playbackStatus.value = 'error'
    playbackError.value = '该歌曲暂无可用音频直链或受版权限制'
    isLoading.value = false
    isPlaying.value = false
    return
  }

  // 阶段 2：装载有效媒体
  playbackStatus.value = 'loading'
  const currentSrc = audioEl.getAttribute('src') || ''
  if (currentSrc !== audioUrl && !audioEl.src.endsWith(audioUrl)) {
    audioEl.src = audioUrl
    audioEl.load()
  }

  // 阶段 3：执行播放（唯一单次调用）
  try {
    const p = audioEl.play()
    if (p !== undefined) {
      await p
      if (reqId === playRequestId) {
        isPlaying.value = true
        isLoading.value = false
        playbackStatus.value = 'playing'
      }
    }
  } catch (err: any) {
    if (reqId === playRequestId) {
      isLoading.value = false
      isPlaying.value = false
      if (err.name === 'NotAllowedError') {
        playbackStatus.value = 'paused'
        playbackError.value = '浏览器阻止了自动播放，请轻触播放按钮'
      } else if (err.name !== 'AbortError') {
        console.warn('[AudioPlayer] 播放失败:', err)
        playbackStatus.value = 'error'
        playbackError.value = '播放失败，请稍后重试或切换曲目'
      }
    }
  }
}

// ── 播放器基础控制 ──
function play() {
  const track = currentTrack.value
  if (!track) return

  // 若当前音频已经就绪并暂停，直接恢复
  if (audioEl && audioEl.src && !audioEl.ended && audioEl.readyState >= 2 && playbackStatus.value === 'paused') {
    audioEl.play().catch(() => {})
    isPlaying.value = true
    playbackStatus.value = 'playing'
    return
  }

  const reqId = ++playRequestId
  startPlaybackPipeline(track, reqId)
}

function pause() {
  playRequestId++ // 取消正在进行的异步操作
  if (audioEl) {
    audioEl.pause()
    isPlaying.value = false
    isLoading.value = false
    playbackStatus.value = 'paused'
  }
}

function togglePlay() {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

function selectTrack(index: number, autoPlay = true) {
  if (index < 0 || index >= playlist.value.length) return
  currentTrackIndex.value = index
  currentTime.value = 0

  const track = playlist.value[index]
  duration.value = track.duration

  const reqId = ++playRequestId
  if (autoPlay) {
    startPlaybackPipeline(track, reqId)
  } else {
    playbackStatus.value = 'idle'
    playbackError.value = ''
    isLoading.value = false
  }
}

function nextTrack() {
  const nextIdx = (currentTrackIndex.value + 1) % playlist.value.length
  selectTrack(nextIdx, true)
}

function prevTrack() {
  const prevIdx = (currentTrackIndex.value - 1 + playlist.value.length) % playlist.value.length
  selectTrack(prevIdx, true)
}

function seek(time: number) {
  if (!audioEl) return
  const safeTime = Math.max(0, Math.min(time, duration.value))
  audioEl.currentTime = safeTime
  currentTime.value = Math.floor(safeTime)
}

function setVolume(val: number) {
  volume.value = Math.max(0, Math.min(1, val))
  if (audioEl) {
    audioEl.volume = isMuted.value ? 0 : volume.value
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value
  if (audioEl) {
    audioEl.volume = isMuted.value ? 0 : volume.value
  }
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function setExpand(val: boolean) {
  isExpanded.value = val
}

// ── 点歌与搜索处理 ──
async function searchMusic(query: string) {
  const trimmed = query.trim()
  if (!trimmed) {
    searchResults.value = []
    return
  }

  isSearching.value = true
  searchError.value = ''

  // 1. 如果用户输入的是纯数字（网易云歌曲 ID）或者包含 id= 的链接
  const idMatch = trimmed.match(/(?:id=)?(\d{4,12})/)
  if (idMatch && (trimmed.length < 15 || trimmed.includes('163.com'))) {
    const songId = idMatch[1]
    const apiUrl = getSavedApiUrl()
    let directAudio = `https://music.163.com/song/media/outer/url?id=${songId}.mp3`
    let isFull = false

    if (apiUrl) {
      const resolved = await fetchSongAudioUrl(songId, apiUrl)
      if (resolved) {
        directAudio = resolved
        isFull = true
        resolvedUrlCache.set(songId, { url: resolved, timestamp: Date.now() })
      }
    }

    const customTrack: Track = {
      id: `netease-${songId}`,
      title: `网易云单曲 (ID: ${songId})`,
      artist: '网易云音乐人',
      album: '自选曲目',
      duration: 240,
      genre: 'Cloud Music',
      themeColor: '#7C8C6E',
      coverUrl: 'https://p1.music.126.net/r8jK6UuK2_jXm3bZ4r1Z4g==/109951163428984926.jpg?param=300y300',
      audioUrl: directAudio,
      isFull,
    }
    searchResults.value = [customTrack]
    isSearching.value = false
    return
  }

  // 2. 如果输入的是直接的 mp3/m4a/ogg 音频直链
  if (trimmed.startsWith('http') && (trimmed.includes('.mp3') || trimmed.includes('.m4a') || trimmed.includes('.ogg'))) {
    const customLinkTrack: Track = {
      id: `custom-${Date.now()}`,
      title: '自定义音频直链',
      artist: '外部音频流',
      album: '网络音频',
      duration: 200,
      genre: 'Custom Audio',
      themeColor: '#9AAFB2',
      coverUrl: 'https://p1.music.126.net/TqAkg2uG-xX_bL2F1p5Q9A==/109951165415714034.jpg?param=300y300',
      audioUrl: trimmed,
      isFull: true,
    }
    searchResults.value = [customLinkTrack]
    isSearching.value = false
    return
  }

  // 3. 执行纯正网易云曲库搜索（无静默降级，失败给出明确提示）
  const apiUrl = getSavedApiUrl()
  try {
    const songs = await searchNeteaseSongs(trimmed, apiUrl)
    if (songs && songs.length > 0) {
      searchResults.value = songs
    } else {
      searchResults.value = []
      searchError.value = '未检索到相关网易云曲目，可尝试更换关键词或直接输入网易云歌曲ID（如 27946612）'
    }
  } catch (err) {
    console.warn('[AudioPlayer] 网易云检索异常:', err)
    searchResults.value = []
    searchError.value = '检索请求遇到网络超时或节点异常，请稍后重试'
  } finally {
    isSearching.value = false
  }
}

/**
 * 选定搜索结果播放（消除二次重复 play 调用）
 */
function playSearchResult(track: Track) {
  const existingIdx = playlist.value.findIndex(item => item.id === track.id)
  if (existingIdx !== -1) {
    selectTrack(existingIdx, true)
  } else {
    const insertIdx = currentTrackIndex.value + 1
    playlist.value.splice(insertIdx, 0, track)
    selectTrack(insertIdx, true)
  }
  // 注意：selectTrack(..., true) 已经通过状态机启动完整播放流程，无需再次调用 play()
}

function setPlaylist(tracks: Track[], autoPlayFirst = true) {
  if (!tracks || tracks.length === 0) return
  playlist.value = [...tracks]
  if (autoPlayFirst) {
    selectTrack(0, true)
  } else {
    selectTrack(0, false)
  }
  prefetchPlaylistAudioUrls(playlist.value)
}

export function useAudioPlayer() {
  return {
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
    getAnalyser: () => null,

    play,
    pause,
    togglePlay,
    selectTrack,
    nextTrack,
    prevTrack,
    seek,
    setVolume,
    toggleMute,
    toggleExpand,
    setExpand,
    searchMusic,
    playSearchResult,
    setPlaylist,
  }
}
