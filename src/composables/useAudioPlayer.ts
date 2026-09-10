import { ref, computed } from 'vue'
import { INITIAL_PLAYLIST, type Track } from '@/data/playlist'
import {
  getSavedApiUrl,
  getSavedCookie,
  fetchSongAudioUrl,
  fetchBatchSongAudioUrls,
  searchNeteaseSongs,
} from '@/services/neteaseApi'

// ── 全局单例响应式状态 ──
const playlist = ref<Track[]>([...INITIAL_PLAYLIST])
const currentTrackIndex = ref(0)
const isPlaying = ref(false)
const isLoading = ref(false)
const currentTime = ref(0)
const duration = ref(INITIAL_PLAYLIST[0]?.duration || 312)
const volume = ref(0.85)
const isMuted = ref(false)
const isExpanded = ref(false)

// 搜索状态
const searchResults = ref<Track[]>([])
const isSearching = ref(false)
const searchError = ref('')

const currentTrack = computed<Track>(() => playlist.value[currentTrackIndex.value] || playlist.value[0])

// ── 原生 HTML5 Audio 核心实例（直通扬声器，零 CORS 拦截，零跨域消音） ──
let audioEl: HTMLAudioElement | null = null
let isAudioInited = false

function initAudioEngine() {
  if (isAudioInited) return

  audioEl = new Audio()
  audioEl.preload = 'auto'
  audioEl.src = currentTrack.value.audioUrl
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
  })

  audioEl.addEventListener('waiting', () => {
    isLoading.value = true
  })

  audioEl.addEventListener('pause', () => {
    isPlaying.value = false
  })

  audioEl.addEventListener('error', (e) => {
    console.warn('音频载入受阻或链接失效，尝试平稳处理:', e)
    isLoading.value = false
    isPlaying.value = false
  })

  isAudioInited = true
}

/**
 * 批量预加载当前歌单所有曲目的最新 HTTPS CDN 直链（1次请求完成全盘预热）
 */
async function prefetchPlaylistAudioUrls(tracks: Track[]) {
  if (!tracks || tracks.length === 0) return
  const neteaseTracks = tracks.filter(t => t.id.startsWith('netease-') && !t.audioUrl.includes('.126.net'))
  if (neteaseTracks.length === 0) return

  const ids = neteaseTracks.map(t => t.id.replace('netease-', ''))
  try {
    const urlMap = await fetchBatchSongAudioUrls(ids, getSavedApiUrl(), getSavedCookie())
    for (const t of tracks) {
      const songId = t.id.replace('netease-', '')
      if (urlMap[songId]) {
        t.audioUrl = urlMap[songId]
        t.isFull = true
      }
    }

    if (audioEl && !isPlaying.value) {
      audioEl.src = currentTrack.value.audioUrl
    }
  } catch (err) {
    console.warn('批量预加载 CDN 直链异常:', err)
  }
}

// 初始化时自动在后台预热初始歌单的 CDN 真实音频链接
setTimeout(() => {
  prefetchPlaylistAudioUrls(playlist.value)
}, 50)

// ── 播放器基础控制 ──
function play() {
  initAudioEngine()
  if (!audioEl) return

  const targetUrl = currentTrack.value.audioUrl
  const currentSrc = audioEl.getAttribute('src') || ''
  if (currentSrc !== targetUrl && !audioEl.src.endsWith(targetUrl)) {
    audioEl.src = targetUrl
    audioEl.load()
  }

  isLoading.value = true
  // 必须在用户交互上下文中同步调用 play()，保证 iOS/Android 移动端 Autoplay 策略放行
  const p = audioEl.play()
  if (p !== undefined) {
    p.then(() => {
      isPlaying.value = true
      isLoading.value = false
    }).catch((err) => {
      console.warn('播放等待交互触发:', err)
      isLoading.value = false
      isPlaying.value = false
    })
  }

  // 异步检查当前歌曲是否已换取最新 CDN 直链，若未换取则后台更新
  const track = currentTrack.value
  if (track && (track.id.startsWith('netease-') || track.audioUrl.includes('music.163.com')) && !track.audioUrl.includes('.126.net')) {
    const songId = track.id.replace('netease-', '')
    const apiUrl = getSavedApiUrl()
    if (apiUrl) {
      fetchSongAudioUrl(songId, apiUrl, getSavedCookie()).then((resolvedUrl) => {
        if (resolvedUrl && track.audioUrl !== resolvedUrl) {
          track.audioUrl = resolvedUrl
          track.isFull = true
          if (audioEl && isPlaying.value && audioEl.src.includes('music.163.com')) {
            const curTime = audioEl.currentTime
            audioEl.src = resolvedUrl
            audioEl.currentTime = curTime
            audioEl.play().catch(() => {})
          }
        }
      })
    }
  }
}

function pause() {
  if (audioEl) {
    audioEl.pause()
    isPlaying.value = false
  }
}

function togglePlay() {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

function selectTrack(index: number) {
  if (index < 0 || index >= playlist.value.length) return
  currentTrackIndex.value = index
  currentTime.value = 0

  const track = playlist.value[index]
  duration.value = track.duration

  initAudioEngine()
  if (audioEl) {
    audioEl.src = track.audioUrl
    audioEl.load()
  }
  play()

  // 异步解析直链，不阻塞当前播放
  if (track && (track.id.startsWith('netease-') || track.audioUrl.includes('music.163.com')) && !track.audioUrl.includes('.126.net')) {
    const songId = track.id.replace('netease-', '')
    const apiUrl = getSavedApiUrl()
    if (apiUrl) {
      fetchSongAudioUrl(songId, apiUrl, getSavedCookie()).then((resolvedUrl) => {
        if (resolvedUrl && track.audioUrl !== resolvedUrl) {
          track.audioUrl = resolvedUrl
          track.isFull = true
          if (audioEl && currentTrackIndex.value === index) {
            const curTime = audioEl.currentTime
            const wasPlaying = isPlaying.value
            audioEl.src = resolvedUrl
            audioEl.currentTime = curTime
            if (wasPlaying) audioEl.play().catch(() => {})
          }
        }
      })
    }
  }
}

function nextTrack() {
  const nextIdx = (currentTrackIndex.value + 1) % playlist.value.length
  selectTrack(nextIdx)
}

function prevTrack() {
  const prevIdx = (currentTrackIndex.value - 1 + playlist.value.length) % playlist.value.length
  selectTrack(prevIdx)
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

// ── 点歌 / 搜索处理 ──
interface ITunesSongResult {
  trackId: number
  trackName: string
  artistName: string
  collectionName?: string
  previewUrl?: string
  artworkUrl100?: string
  trackTimeMillis?: number
  primaryGenreName?: string
}

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

    if (apiUrl) {
      const resolved = await fetchSongAudioUrl(songId, apiUrl, getSavedCookie())
      if (resolved) directAudio = resolved
    }

    const customFullTrack: Track = {
      id: `netease-${songId}`,
      title: `网易云单曲 (ID: ${songId})`,
      artist: '网易云音乐 · 完整全曲',
      album: '自选曲库',
      duration: 240,
      genre: 'Cloud Music',
      themeColor: '#7C8C6E',
      coverUrl: 'https://p1.music.126.net/r8jK6UuK2_jXm3bZ4r1Z4g==/109951163428984926.jpg?param=300y300',
      audioUrl: directAudio,
      isFull: true,
    }
    searchResults.value = [customFullTrack]
    isSearching.value = false
    return
  }

  // 2. 如果输入的是直接的 mp3/m4a 链接
  if (trimmed.startsWith('http') && (trimmed.includes('.mp3') || trimmed.includes('.m4a') || trimmed.includes('.ogg'))) {
    const customLinkTrack: Track = {
      id: `custom-${Date.now()}`,
      title: '自定义音频直链',
      artist: '外部流媒体',
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

  // 3. 如果配置了网易云专属 API，优先执行网易云曲库搜索（全曲高音质）
  const apiUrl = getSavedApiUrl()
  if (apiUrl) {
    try {
      const songs = await searchNeteaseSongs(trimmed, apiUrl, getSavedCookie())
      if (songs.length > 0) {
        searchResults.value = songs
        isSearching.value = false
        return
      }
    } catch (err) {
      console.warn('网易云 API 检索异常，降级到公开备用通道:', err)
    }
  }

  // 4. 未配置 API 或降级模式：调用全球公开 iTunes 试听通道 (30s)
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(trimmed)}&media=music&entity=song&limit=15`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`API 响应异常: ${res.status}`)

    const data = await res.json()
    if (data.results && Array.isArray(data.results)) {
      const parsed: Track[] = data.results
        .filter((item: ITunesSongResult) => item.previewUrl && item.trackName)
        .map((item: ITunesSongResult) => {
          const highResCover = (item.artworkUrl100 || '').replace('100x100bb', '300x300bb')
          return {
            id: `itunes-${item.trackId}`,
            title: item.trackName,
            artist: item.artistName || '未知艺术家',
            album: item.collectionName || '单曲',
            duration: Math.round((item.trackTimeMillis || 30000) / 1000),
            genre: item.primaryGenreName || 'Music',
            themeColor: '#7C8C6E',
            coverUrl: highResCover,
            audioUrl: item.previewUrl as string,
            isFull: false,
          }
        })

      searchResults.value = parsed
      if (parsed.length === 0) {
        searchError.value = '未找到相关音轨，可尝试输入网易云歌曲ID（如 1436709403）'
      }
    }
  } catch (err) {
    console.error('音乐检索失败:', err)
    searchError.value = '检索受网络抖动影响，可直接输入网易云歌曲ID点歌'
  } finally {
    isSearching.value = false
  }
}

function playSearchResult(track: Track) {
  const existingIdx = playlist.value.findIndex(item => item.id === track.id || item.audioUrl === track.audioUrl)
  if (existingIdx !== -1) {
    selectTrack(existingIdx)
  } else {
    const insertIdx = currentTrackIndex.value + 1
    playlist.value.splice(insertIdx, 0, track)
    selectTrack(insertIdx)
  }
  play()
}

function setPlaylist(tracks: Track[], autoPlayFirst = true) {
  if (!tracks || tracks.length === 0) return
  playlist.value = [...tracks]
  if (autoPlayFirst) {
    selectTrack(0)
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
