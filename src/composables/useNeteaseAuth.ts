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

const STORAGE_KEY = 'var_netease_auth_profile_v1'

// ── 模块级响应式状态 ──
const isLoggedIn = ref(false)
const isAuthLoading = ref(false)
const authError = ref('')
const userInfo = ref<NeteaseUser | null>(null)
const userPlaylists = ref<NeteasePlaylist[]>([])
const currentLoadingPlaylistId = ref<number | null>(null)

// API 节点管理状态
const apiUrl = ref(getSavedApiUrl())
const isApiConnected = ref(false)
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

    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed && parsed.userInfo) {
          userInfo.value = parsed.userInfo
          userPlaylists.value = parsed.userPlaylists || []
          isLoggedIn.value = true
        }
      }
    } catch {
      // 忽略缓存解析错误
    }

    // 如果配置了 API，后台预测连通性
    if (apiUrl.value) {
      testCurrentApi(false)
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
   * 开启 App 扫码登录流程
   */
  async function startQrLogin() {
    stopQrPolling()

    if (!apiUrl.value) {
      qrStatusText.value = '请先在「API 配置」中绑定你的 Vercel 接口地址'
      return
    }

    isQrLoading.value = true
    qrStatusText.value = '正在向 API 获取登录凭证...'
    qrStatusCode.value = null
    qrImg.value = ''

    const key = await getQrKey(apiUrl.value)
    if (!key) {
      isQrLoading.value = false
      qrStatusText.value = '获取二维码授权 Key 失败，请检查 API 节点配置'
      return
    }

    currentQrKey = key
    const qrData = await createQrImage(key, apiUrl.value)
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
      const checkRes = await checkQrStatus(currentQrKey, apiUrl.value)
      qrStatusCode.value = checkRes.code

      if (checkRes.code === 800) {
        // 二维码过期
        qrStatusText.value = '二维码已过期，点击刷新'
        stopQrPolling()
      } else if (checkRes.code === 801) {
        // 等待扫码
        qrStatusText.value = '请使用网易云音乐手机 App 扫一扫'
      } else if (checkRes.code === 802) {
        // 扫码成功，待确认
        qrStatusText.value = `${checkRes.nickname || '扫描成功'}，请在手机上点击「确认登录」`
      } else if (checkRes.code === 803) {
        // 授权登录成功！
        qrStatusText.value = '🎉 授权登录成功！正在同步曲库与会员特权...'
        stopQrPolling()

        if (checkRes.cookie) {
          persistCookie(checkRes.cookie)
        }

        // 获取用户完整资料
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

  /**
   * 登录成功后同步用户资料与歌单
   */
  async function syncUserProfileAfterLogin(cookie?: string) {
    isAuthLoading.value = true
    try {
      const profile = await fetchUserAccount(apiUrl.value, cookie)
      if (profile) {
        const user: NeteaseUser = {
          userId: profile.userId,
          nickname: profile.nickname,
          avatarUrl: (profile.avatarUrl || '').replace('http://', 'https://'),
          vipType: profile.vipType || (profile.vipLevels?.length ? 1 : 0),
          signature: profile.signature || '',
        }

        userInfo.value = user
        isLoggedIn.value = true

        // 同步歌单
        const rawPlaylists = await fetchUserPlaylists(profile.userId, apiUrl.value, cookie)
        const playlists: NeteasePlaylist[] = rawPlaylists.map((item: any) => ({
          id: item.id,
          name: item.name || '私人歌单',
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
   * 方案 B：UID 一键快速导入 (免扫码)
   */
  async function loginWithUid(input: string): Promise<boolean> {
    const trimmed = input.trim()
    if (!trimmed) {
      authError.value = '请输入你的网易云 UID 或个人主页链接'
      return false
    }

    const match = trimmed.match(/(?:id=)?(\d{4,12})/)
    if (!match) {
      authError.value = '未识别到有效的网易云数字 UID，请检查输入'
      return false
    }

    const uid = match[1]
    isAuthLoading.value = true
    authError.value = ''

    try {
      // 如果配置了 API，优先使用 API
      if (apiUrl.value) {
        const rawList = await fetchUserPlaylists(uid, apiUrl.value)
        if (rawList && rawList.length > 0) {
          const firstPl = rawList[0]
          const creator = firstPl.creator || {}

          const user: NeteaseUser = {
            userId: uid,
            nickname: creator.nickname || `云村听客_${uid.slice(-4)}`,
            avatarUrl: (creator.avatarUrl || 'https://p1.music.126.net/r8jK6UuK2_jXm3bZ4r1Z4g==/109951163428984926.jpg').replace('http://', 'https://'),
            vipType: creator.vipType || 1,
            signature: creator.signature || '',
          }

          const playlists: NeteasePlaylist[] = rawList.map((item: any) => ({
            id: item.id,
            name: item.name || '歌单',
            coverImgUrl: (item.coverImgUrl || '').replace('http://', 'https://') + '?param=200y200',
            trackCount: item.trackCount || 0,
            playCount: item.playCount || 0,
          }))

          userInfo.value = user
          userPlaylists.value = playlists
          isLoggedIn.value = true

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ userInfo: user, userPlaylists: playlists }))
          } catch {
            // ignore
          }
          isAuthLoading.value = false
          return true
        }
      }

      // 如果未配置 API 或拉取为空，生成友好的平稳村民态
      const fallbackUser: NeteaseUser = {
        userId: uid,
        nickname: `云音乐玩家 #${uid.slice(-4)}`,
        avatarUrl: 'https://p1.music.126.net/r8jK6UuK2_jXm3bZ4r1Z4g==/109951163428984926.jpg',
        vipType: 1,
      }
      userInfo.value = fallbackUser
      userPlaylists.value = []
      isLoggedIn.value = true
      isAuthLoading.value = false
      return true
    } catch (err) {
      console.warn('UID 同步出现异常:', err)
      isAuthLoading.value = false
      return true
    }
  }

  /**
   * 载入指定歌单的曲目列表
   */
  async function loadPlaylistTracks(playlistId: number): Promise<Track[]> {
    currentLoadingPlaylistId.value = playlistId
    try {
      if (apiUrl.value) {
        const tracks = await fetchPlaylistTracks(playlistId, apiUrl.value)
        if (tracks.length > 0) {
          currentLoadingPlaylistId.value = null
          return tracks
        }
      }
    } catch (e) {
      console.warn('拉取歌单曲目异常:', e)
    }

    currentLoadingPlaylistId.value = null
    return []
  }

  function logout() {
    stopQrPolling()
    isLoggedIn.value = false
    userInfo.value = null
    userPlaylists.value = []
    clearAuthData()
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

    // API 配置状态
    apiUrl,
    isApiConnected,
    apiLatency,
    apiTesting,
    apiTestMessage,
    testAndSaveApiUrl,
    testCurrentApi,

    // 扫码登录状态
    qrImg,
    qrStatusText,
    qrStatusCode,
    isQrLoading,
    startQrLogin,
    stopQrPolling,
    refreshQr,

    loginWithUid,
    loadPlaylistTracks,
    logout,
  }
}
