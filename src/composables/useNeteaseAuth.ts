import { ref, onMounted, onUnmounted } from 'vue'
import type { Track } from '@/data/playlist'
import {
  getSavedApiUrl,
  saveApiUrl as persistApiUrl,
  getSavedCookie,
  saveCookie as persistCookie,
  clearAuthData,
  testApiConnection,
  getQrKey,
  createQrImage,
  checkQrStatus,
  fetchUserAccount,
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

// 站长专属电台 UID 与默认资料预设
export const OWNER_UID = '3986148741'
export const DEFAULT_OWNER_USER: NeteaseUser = {
  userId: OWNER_UID,
  nickname: 'var',
  avatarUrl: 'https://p1.music.126.net/r8jK6UuK2_jXm3bZ4r1Z4g==/109951163428984926.jpg',
  vipType: 1,
  signature: '以代码编织创意 · 专属黑胶电台',
}

const STORAGE_KEY = 'var_netease_auth_profile_v1'

// ── 模块级响应式状态（全局单例） ──
const isLoggedIn = ref(true) // 默认开启站长专属电台模式
const isAuthLoading = ref(false)
const authError = ref('')
const userInfo = ref<NeteaseUser>({ ...DEFAULT_OWNER_USER })
const userPlaylists = ref<NeteasePlaylist[]>([])
const currentLoadingPlaylistId = ref<number | null>(null)

// API 节点管理状态
const apiUrl = ref(getSavedApiUrl())
const isApiConnected = ref(true)
const apiLatency = ref(0)
const apiTesting = ref(false)
const apiTestMessage = ref('')

// 扫码登录状态
const qrImg = ref('')
const qrStatusText = ref('')
const qrStatusCode = ref<number | null>(null)
const isQrLoading = ref(false)

let currentQrKey: string | null = null
let qrPollingTimer: number | null = null

export function useNeteaseAuth() {
  function initAuth() {
    apiUrl.value = getSavedApiUrl()

    let hasCachedUser = false
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.userInfo) {
          userInfo.value = parsed.userInfo
          userPlaylists.value = parsed.userPlaylists || []
          isLoggedIn.value = true
          hasCachedUser = true
        }
      }
    } catch {
      // ignore
    }

    // 若本地没有额外缓存，默认直接使用站长电台身份
    if (!hasCachedUser) {
      userInfo.value = { ...DEFAULT_OWNER_USER }
      isLoggedIn.value = true
    }

    // 后台静默同步站长真实头像与全部歌单
    syncOwnerData()

    if (apiUrl.value) {
      testCurrentApi(false)
    }
  }

  /**
   * 后台自动同步站长网易云真实公开歌单与资料
   */
  async function syncOwnerData() {
    const targetApi = apiUrl.value || 'https://personly-use.vercel.app'
    try {
      const rawList = await fetchUserPlaylists(OWNER_UID, targetApi)
      if (rawList && rawList.length > 0) {
        const firstPl = rawList[0]
        const creator = firstPl.creator || {}

        if (creator.nickname) {
          userInfo.value = {
            userId: OWNER_UID,
            nickname: creator.nickname || DEFAULT_OWNER_USER.nickname,
            avatarUrl: (creator.avatarUrl || DEFAULT_OWNER_USER.avatarUrl).replace('http://', 'https://'),
            vipType: creator.vipType || 1,
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

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ userInfo: userInfo.value, userPlaylists: playlists }))
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('站长电台歌单静默拉取:', err)
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
   * 开启 App 扫码登录流程（用于站长在各设备授权更新 Cookie）
   */
  async function startQrLogin() {
    stopQrPolling()

    const targetApi = apiUrl.value || 'https://personly-use.vercel.app'
    isQrLoading.value = true
    qrStatusText.value = '正在向 API 获取登录凭证...'
    qrStatusCode.value = null
    qrImg.value = ''

    const key = await getQrKey(targetApi)
    if (!key) {
      isQrLoading.value = false
      qrStatusText.value = '获取二维码授权 Key 失败，请稍后刷新重试'
      return
    }

    currentQrKey = key
    const qrData = await createQrImage(key, targetApi)
    isQrLoading.value = false

    if (!qrData || !qrData.qrimg) {
      qrStatusText.value = '生成二维码图片失败，请点击刷新重试'
      return
    }

    qrImg.value = qrData.qrimg
    qrStatusText.value = '请打开网易云音乐手机 App 扫码授权'
    qrStatusCode.value = 801

    // 启动 2.5 秒一次轮询
    qrPollingTimer = window.setInterval(async () => {
      if (!currentQrKey) return
      const checkRes = await checkQrStatus(currentQrKey, targetApi)
      qrStatusCode.value = checkRes.code

      if (checkRes.code === 800) {
        qrStatusText.value = '二维码已过期，点击刷新'
        stopQrPolling()
      } else if (checkRes.code === 801) {
        qrStatusText.value = '请使用网易云音乐手机 App 扫一扫'
      } else if (checkRes.code === 802) {
        qrStatusText.value = `${checkRes.nickname || '扫描成功'}，请在手机上点击「确认登录」`
      } else if (checkRes.code === 803) {
        qrStatusText.value = '🎉 授权登录成功！正在同步曲库与会员特权...'
        stopQrPolling()

        if (checkRes.cookie) {
          persistCookie(checkRes.cookie)
        }

        await syncUserProfileAfterLogin(checkRes.cookie)
      }
    }, 2500)
  }

  function stopQrPolling() {
    if (qrPollingTimer) {
      clearInterval(qrPollingTimer)
      qrPollingTimer = null
    }
  }

  function refreshQr() {
    startQrLogin()
  }

  async function syncUserProfileAfterLogin(cookie?: string) {
    isAuthLoading.value = true
    const targetApi = apiUrl.value || 'https://personly-use.vercel.app'
    try {
      const profile = await fetchUserAccount(targetApi, cookie)
      if (profile) {
        const user: NeteaseUser = {
          userId: profile.userId,
          nickname: profile.nickname,
          avatarUrl: (profile.avatarUrl || '').replace('http://', 'https://'),
          vipType: profile.vipType || 1,
          signature: profile.signature || '',
        }

        userInfo.value = user
        isLoggedIn.value = true

        const rawPlaylists = await fetchUserPlaylists(profile.userId, targetApi, cookie)
        const playlists: NeteasePlaylist[] = rawPlaylists.map((item: any) => ({
          id: item.id,
          name: item.name || '精选歌单',
          coverImgUrl: (item.coverImgUrl || '').replace('http://', 'https://') + '?param=200y200',
          trackCount: item.trackCount || 0,
          playCount: item.playCount || 0,
        }))

        userPlaylists.value = playlists

        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ userInfo: user, userPlaylists: playlists }))
        } catch {
          // ignore
        }
      }
    } catch (err) {
      console.warn('同步登录用户资料异常:', err)
    } finally {
      isAuthLoading.value = false
    }
  }

  /**
   * 载入指定歌单的曲目列表
   */
  async function loadPlaylistTracks(playlistId: number): Promise<Track[]> {
    currentLoadingPlaylistId.value = playlistId
    const targetApi = apiUrl.value || 'https://personly-use.vercel.app'
    try {
      const tracks = await fetchPlaylistTracks(playlistId, targetApi)
      if (tracks.length > 0) {
        currentLoadingPlaylistId.value = null
        return tracks
      }
    } catch (e) {
      console.warn('拉取歌单曲目异常:', e)
    }

    currentLoadingPlaylistId.value = null
    return []
  }

  function resetToStationMode() {
    stopQrPolling()
    clearAuthData()
    userInfo.value = { ...DEFAULT_OWNER_USER }
    isLoggedIn.value = true
    syncOwnerData()
  }

  onMounted(() => {
    initAuth()
  })

  onUnmounted(() => {
    stopQrPolling()
  })

  return {
    isLoggedIn,
    isAuthLoading,
    authError,
    userInfo,
    userPlaylists,
    currentLoadingPlaylistId,

    apiUrl,
    isApiConnected,
    apiLatency,
    apiTesting,
    apiTestMessage,
    testAndSaveApiUrl,
    testCurrentApi,

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
  }
}
