import type { Track } from '@/data/playlist'

const STORAGE_API_KEY = 'var_netease_api_url'
export const DEFAULT_NETEASE_API_URL = 'https://api.hi-var.top'

export function getSavedApiUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_API_KEY)
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '')
    }
    return DEFAULT_NETEASE_API_URL
  } catch {
    return DEFAULT_NETEASE_API_URL
  }
}

export function saveApiUrl(url: string): void {
  const clean = url.trim().replace(/\/+$/, '')
  try {
    if (clean) {
      localStorage.setItem(STORAGE_API_KEY, clean)
    } else {
      localStorage.removeItem(STORAGE_API_KEY)
    }
  } catch {
    // ignore
  }
}


/**
 * 测试给定 API 地址的连通性与响应时间
 */
export async function testApiConnection(baseUrl?: string): Promise<{ ok: boolean; latency: number; message?: string }> {
  const target = (baseUrl || getSavedApiUrl()).trim().replace(/\/+$/, '')
  if (!target) {
    return { ok: false, latency: 0, message: '未配置 API 地址' }
  }

  const startTime = Date.now()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    // 请求轻量接口，例如搜索热词或首页状态
    const res = await fetch(`${target}/search/hot?timestamp=${Date.now()}`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    const latency = Date.now() - startTime
    if (res.ok) {
      return { ok: true, latency }
    } else {
      return { ok: false, latency, message: `HTTP ${res.status}` }
    }
  } catch (err: any) {
    const latency = Date.now() - startTime
    if (err.name === 'AbortError') {
      return { ok: false, latency, message: '请求超时 (6s)' }
    }
    return { ok: false, latency, message: err.message || '网络连接异常' }
  }
}

/**
 * 获取指定用户的公开歌单列表（纯只读 GET，不携带任何 Cookie）
 */
export async function fetchUserPlaylists(uid: string | number, baseUrl?: string): Promise<any[]> {
  const target = baseUrl || getSavedApiUrl()
  if (!target) return []

  try {
    const url = `${target}/user/playlist?uid=${uid}&limit=30&timestamp=${Date.now()}`
    const res = await fetch(url)
    const json = await res.json()
    if (json && json.playlist && Array.isArray(json.playlist)) {
      return json.playlist
    }
  } catch (err) {
    console.warn('[NeteaseApi] 获取歌单列表失败:', err)
  }
  return []
}

/**
 * 获取指定歌单的所有歌曲（纯只读 GET，不携带任何 Cookie）
 */
export async function fetchPlaylistTracks(playlistId: number, baseUrl?: string): Promise<Track[]> {
  const target = baseUrl || getSavedApiUrl()
  if (!target) return []

  try {
    let res = await fetch(`${target}/playlist/track/all?id=${playlistId}&limit=50&timestamp=${Date.now()}`)
    let json = await res.json()

    let songList = json.songs
    if (!songList || !Array.isArray(songList)) {
      res = await fetch(`${target}/playlist/detail?id=${playlistId}&timestamp=${Date.now()}`)
      json = await res.json()
      songList = json.playlist?.tracks
    }

    if (songList && Array.isArray(songList)) {
      return songList.map((s: any) => {
        const artistName = s.ar?.map((a: any) => a.name).join(' / ') || s.artists?.map((a: any) => a.name).join(' / ') || '网易云音乐人'
        const albumName = s.al?.name || s.album?.name || '精选原声'
        const cover = (s.al?.picUrl || s.album?.picUrl || '').replace('http://', 'https://') + '?param=300y300'
        const dur = s.dt ? Math.round(s.dt / 1000) : 210

        return {
          id: `netease-${s.id}`,
          title: s.name,
          artist: artistName,
          album: albumName,
          duration: dur,
          genre: 'Cloud Music',
          themeColor: '#7C8C6E',
          coverUrl: cover || 'https://p1.music.126.net/SUeqMM8HOIpHv9Nhl9qt9w==/109951165647004069.jpg?param=300y300',
          audioUrl: `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
          isFull: true,
        }
      })
    }
  } catch (err) {
    console.warn('[NeteaseApi] 获取歌单曲目失败:', err)
  }
  return []
}

/**
 * 解析歌曲真实音频直链（纯只读 GET，不携带任何 Cookie）
 */
export async function fetchSongAudioUrl(songId: number | string, baseUrl?: string): Promise<string | null> {
  const target = baseUrl || getSavedApiUrl()
  if (!target) return null

  const cleanId = String(songId).replace(/\D/g, '')
  if (!cleanId) return null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    const url = `${target}/song/url?id=${cleanId}&timestamp=${Date.now()}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    const json = await res.json()

    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
      const songData = json.data[0]
      if (songData.url) {
        return songData.url.replace(/^http:\/\//i, 'https://')
      }
    }
  } catch (err) {
    console.warn(`[NeteaseApi] 解析歌曲 (ID: ${cleanId}) 音频直链异常:`, err)
  }

  return null
}

/**
 * 批量解析歌曲真实 CDN 直链（纯只读 GET，不携带任何 Cookie）
 */
export async function fetchBatchSongAudioUrls(songIds: (number | string)[], baseUrl?: string): Promise<Record<string, string>> {
  const target = baseUrl || getSavedApiUrl()
  if (!target || songIds.length === 0) return {}

  const cleanIds = songIds.map(id => String(id).replace(/\D/g, '')).filter(Boolean)
  if (cleanIds.length === 0) return {}

  const result: Record<string, string> = {}
  try {
    const idStr = cleanIds.join(',')
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)
    const url = `${target}/song/url?id=${idStr}&timestamp=${Date.now()}`
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timer)
    const json = await res.json()

    if (json.data && Array.isArray(json.data)) {
      for (const item of json.data) {
        if (item.id && item.url) {
          result[String(item.id)] = item.url.replace(/^http:\/\//i, 'https://')
        }
      }
    }
  } catch (err) {
    console.warn('[NeteaseApi] 批量解析直链异常:', err)
  }

  return result
}

/**
 * 全网曲库云搜索（纯只读 GET，不携带任何 Cookie）
 */
export async function searchNeteaseSongs(keyword: string, baseUrl?: string): Promise<Track[]> {
  const target = baseUrl || getSavedApiUrl()
  if (!target) return []

  try {
    const url = `${target}/cloudsearch?keywords=${encodeURIComponent(keyword)}&type=1&limit=20&timestamp=${Date.now()}`
    const res = await fetch(url)
    const json = await res.json()

    const songList = json.result?.songs || json.songs
    if (songList && Array.isArray(songList)) {
      return songList.map((s: any) => {
        const artistName = s.ar?.map((a: any) => a.name).join(' / ') || s.artists?.map((a: any) => a.name).join(' / ') || '网易云音乐人'
        const albumName = s.al?.name || s.album?.name || '单曲'
        const cover = (s.al?.picUrl || s.album?.picUrl || '').replace('http://', 'https://') + '?param=300y300'
        const dur = s.dt ? Math.round(s.dt / 1000) : 210

        return {
          id: `netease-${s.id}`,
          title: s.name,
          artist: artistName,
          album: albumName,
          duration: dur,
          genre: 'Cloud Music',
          themeColor: '#7C8C6E',
          coverUrl: cover || 'https://p1.music.126.net/SUeqMM8HOIpHv9Nhl9qt9w==/109951165647004069.jpg?param=300y300',
          audioUrl: `https://music.163.com/song/media/outer/url?id=${s.id}.mp3`,
          isFull: false,
        }
      })
    }
  } catch (err) {
    console.warn('[NeteaseApi] 云搜索失败:', err)
  }

  return []
}
