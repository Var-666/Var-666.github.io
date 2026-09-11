import { ref, onMounted } from 'vue'
import { INITIAL_PLAYLIST, type Track } from '@/data/playlist'
import {
  DEFAULT_NETEASE_API_URL,
  getSavedApiUrl,
  saveApiUrl as persistApiUrl,
  testApiConnection,
  fetchUserPlaylists,
  fetchPlaylistTracks,
} from '@/services/neteaseApi'

export interface NeteaseUser {
  userId: string | number
  nickname: string
  avatarUrl: string
  vipType?: number
  signature?: string
}

export interface NeteasePlaylist {
  id: number
  name: string
  coverImgUrl: string
  trackCount: number
  playCount?: number
}

// 站长专属公开电台 UID 与默认资料预设（真实网易云账户: 不可以叫我憨憨）
export const OWNER_UID = '3986148741'
export const DEFAULT_OWNER_USER: NeteaseUser = {
  userId: OWNER_UID,
  nickname: '不可以叫我憨憨',
  avatarUrl: 'https://p1.music.126.net/SUeqMM8HOIpHv9Nhl9qt9w==/109951165647004069.jpg?param=200y200',
  vipType: 0,
  signature: '站长公开精选电台 · 访客免登录畅听',
}

export const DEFAULT_OWNER_PLAYLISTS: NeteasePlaylist[] = [
  {
    id: 5352193809,
    name: '不可以叫我憨憨喜欢的音乐',
    coverImgUrl: 'https://p1.music.126.net/mFJKHNEAF9qLv_-VQpZOTw==/109951166361455433.jpg?param=200y200',
    trackCount: 23,
    playCount: 47,
  },
  {
    id: 18193921997,
    name: '你的兴趣歌单',
    coverImgUrl: 'https://p1.music.126.net/NR9U3zkNPu9ZuQSRr9QEWQ==/109951173650428159.jpg?param=200y200',
    trackCount: 49,
    playCount: 1,
  },
  {
    id: 2829816518,
    name: '欧美私人雷达 | 最懂你的欧美推荐',
    coverImgUrl: 'https://p1.music.126.net/kBUPrLfB9-OZXHrf8aVbSw==/109951168609048221.jpg?param=200y200',
    trackCount: 35,
    playCount: 582609728,
  },
]

// ── 模块级响应式状态（全局单例） ──
const isLoggedIn = ref(false)
const isAuthLoading = ref(false)
const authError = ref('')
const userInfo = ref<NeteaseUser | null>(null)
const stationUser = ref<NeteaseUser>({ ...DEFAULT_OWNER_USER })
const userPlaylists = ref<NeteasePlaylist[]>([...DEFAULT_OWNER_PLAYLISTS])
const currentLoadingPlaylistId = ref<number | null>(null)

// API 节点管理状态
const apiUrl = ref(getSavedApiUrl())
const isApiConnected = ref(true)
const apiLatency = ref(0)
const apiTesting = ref(false)
const apiTestMessage = ref('')

export function useNeteaseAuth() {
  async function initAuth() {
    apiUrl.value = getSavedApiUrl()
    // 静默拉取站长公开电台最新公开歌单
    syncOwnerData()
    // 异步测试 API 节点健康度
    if (apiUrl.value) {
      testCurrentApi(false)
    }
  }

  /**
   * 后台自动同步站长网易云真实公开歌单与资料（无需任何前端 Cookie）
   */
  async function syncOwnerData() {
    const targetApi = apiUrl.value || DEFAULT_NETEASE_API_URL
    try {
      const rawList = await fetchUserPlaylists(OWNER_UID, targetApi)
      if (rawList && rawList.length > 0) {
        const firstPl = rawList[0]
        const creator = firstPl.creator || {}

        if (creator.nickname) {
          stationUser.value = {
            userId: OWNER_UID,
            nickname: creator.nickname || DEFAULT_OWNER_USER.nickname,
            avatarUrl: (creator.avatarUrl || DEFAULT_OWNER_USER.avatarUrl).replace('http://', 'https://'),
            vipType: creator.vipType ?? 0,
            signature: creator.signature || DEFAULT_OWNER_USER.signature,
          }
        }

        const playlists: NeteasePlaylist[] = rawList.map((item: any) => ({
          id: item.id,
          name: item.name || '精选歌单',
          coverImgUrl: (item.coverImgUrl || '').replace('http://', 'https://') + '?param=200y200',
          trackCount: item.trackCount || 0,
          playCount: item.playCount || 0,
        }))

        userPlaylists.value = playlists
      }
    } catch (err) {
      console.warn('[NeteaseAuth] 站长电台歌单拉取异常:', err)
    }
  }

  /**
   * 测试并保存 API 地址
   */
  async function testAndSaveApiUrl(targetUrl: string): Promise<boolean> {
    const cleanUrl = targetUrl.trim().replace(/\/+$/, '')
    apiTesting.value = true
    apiTestMessage.value = '正在测试节点连通性...'

    const res = await testApiConnection(cleanUrl)
    apiTesting.value = false

    if (res.ok) {
      apiUrl.value = cleanUrl
      persistApiUrl(cleanUrl)
      isApiConnected.value = true
      apiLatency.value = res.latency
      apiTestMessage.value = `连接成功 (延迟 ${res.latency}ms)`
      return true
    } else {
      isApiConnected.value = false
      apiLatency.value = 0
      apiTestMessage.value = `连接失败: ${res.message || '未知错误'}`
      return false
    }
  }

  async function testCurrentApi(showFeedback = true): Promise<boolean> {
    if (!apiUrl.value) return false
    if (showFeedback) {
      apiTesting.value = true
      apiTestMessage.value = '正在测速...'
    }

    const res = await testApiConnection(apiUrl.value)
    apiTesting.value = false
    isApiConnected.value = res.ok
    apiLatency.value = res.latency

    if (showFeedback) {
      apiTestMessage.value = res.ok ? `已连接 (${res.latency}ms)` : `连接中断: ${res.message}`
    }
    return res.ok
  }

  /**
   * 载入指定歌单的曲目列表
   */
  async function loadPlaylistTracks(playlistId: number): Promise<Track[]> {
    currentLoadingPlaylistId.value = playlistId
    const targetApi = apiUrl.value || DEFAULT_NETEASE_API_URL
    try {
      const tracks = await fetchPlaylistTracks(playlistId, targetApi)
      if (tracks.length > 0) {
        currentLoadingPlaylistId.value = null
        return tracks
      }
    } catch (e) {
      console.warn('[NeteaseAuth] 拉取歌单曲目异常:', e)
    }

    if (playlistId === 5352193809) {
      currentLoadingPlaylistId.value = null
      return [...INITIAL_PLAYLIST]
    }

    currentLoadingPlaylistId.value = null
    return []
  }

  onMounted(() => {
    initAuth()
  })

  return {
    isLoggedIn,
    isAuthLoading,
    authError,
    userInfo,
    stationUser,
    userPlaylists,
    currentLoadingPlaylistId,

    apiUrl,
    isApiConnected,
    apiLatency,
    apiTesting,
    apiTestMessage,
    testAndSaveApiUrl,
    testCurrentApi,

    syncOwnerData,
    loadPlaylistTracks,
  }
}
