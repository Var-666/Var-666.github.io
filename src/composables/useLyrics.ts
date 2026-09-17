import { ref, computed, watch } from 'vue'
import { useAudioPlayer } from '@/composables/useAudioPlayer'
import { fetchSongLyric } from '@/services/neteaseApi'
import type { Track } from '@/data/playlist'

export interface LyricLine {
  id: number
  time: number // 秒，浮点数
  text: string
  translation?: string
}

interface RawParsedLine {
  time: number
  text: string
}

/**
 * 解析标准 LRC 文本为带有时间戳（秒）的行数组
 */
function parseRawLrc(rawText: string): RawParsedLine[] {
  if (!rawText || typeof rawText !== 'string') return []
  const lines = rawText.split(/\r?\n/)
  const results: RawParsedLine[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    // 匹配行中可能存在的一个或多个时间戳 [mm:ss.xx] 或 [mm:ss.xxx]
    const matches = Array.from(trimmed.matchAll(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g))
    if (!matches || matches.length === 0) continue

    // 剔除所有时间戳后获取歌词文本
    const text = trimmed.replace(/\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g, '').trim()
    if (!text) continue

    for (const match of matches) {
      const min = parseInt(match[1], 10)
      const sec = parseInt(match[2], 10)
      const msPart = match[3] || '0'
      const ms = msPart.length === 1
        ? parseInt(msPart, 10) / 10
        : (msPart.length === 2 ? parseInt(msPart, 10) / 100 : parseInt(msPart, 10) / 1000)

      const time = min * 60 + sec + ms
      results.push({ time, text })
    }
  }

  results.sort((a, b) => a.time - b.time)
  return results
}

/**
 * 整合主歌词与翻译歌词
 */
export function parseLrc(lrcText: string, tlyricText?: string): LyricLine[] {
  const originLines = parseRawLrc(lrcText)
  if (originLines.length === 0) return []

  const transLines = tlyricText ? parseRawLrc(tlyricText) : []

  return originLines.map((line, idx) => {
    let translation: string | undefined
    if (transLines.length > 0) {
      // 查找时间偏差在 0.35s 以内的对应翻译
      const match = transLines.find(t => Math.abs(t.time - line.time) <= 0.35)
      if (match && match.text && match.text !== line.text) {
        translation = match.text
      }
    }

    return {
      id: idx,
      time: line.time,
      text: line.text,
      translation,
    }
  })
}

// ── 模块级响应式状态（与音频播放器深度协同） ──
const currentLyrics = ref<LyricLine[]>([])
const currentLineIndex = ref<number>(-1)
const isLoadingLyrics = ref<boolean>(false)
const isInstrumental = ref<boolean>(false)
let lyricRequestId = 0

export function useLyrics() {
  const { currentTrack, currentTime, seek } = useAudioPlayer()

  const hasLyrics = computed(() => currentLyrics.value.length > 0)

  function updateActiveLine(time: number) {
    const lyrics = currentLyrics.value
    if (!lyrics || lyrics.length === 0) {
      currentLineIndex.value = -1
      return
    }

    // 预读 150ms 缓冲，使歌词变色高亮与人耳听音节奏更加同步自然
    const adjustedTime = time + 0.15

    if (adjustedTime < lyrics[0].time) {
      currentLineIndex.value = 0
      return
    }

    let activeIdx = 0
    for (let i = 0; i < lyrics.length; i++) {
      if (adjustedTime >= lyrics[i].time) {
        activeIdx = i
      } else {
        break
      }
    }

    currentLineIndex.value = activeIdx
  }

  async function loadLyricsForTrack(track: Track | undefined) {
    if (!track) {
      currentLyrics.value = []
      currentLineIndex.value = -1
      isInstrumental.value = false
      return
    }

    const requestId = ++lyricRequestId
    isLoadingLyrics.value = true
    isInstrumental.value = false
    currentLyrics.value = []
    currentLineIndex.value = -1

    const cleanId = String(track.id).replace(/\D/g, '')
    if (!cleanId) {
      // 本地无 ID 纯声或轻音乐
      isInstrumental.value = true
      isLoadingLyrics.value = false
      return
    }

    try {
      const res = await fetchSongLyric(cleanId)
      if (requestId !== lyricRequestId) return

      if (!res || res.isInstrumental || !res.lrc) {
        isInstrumental.value = true
        currentLyrics.value = []
        isLoadingLyrics.value = false
        return
      }

      const parsed = parseLrc(res.lrc, res.tlyric)
      if (parsed.length === 0 || (parsed.length === 1 && parsed[0].text.includes('纯音乐'))) {
        isInstrumental.value = true
        currentLyrics.value = []
      } else {
        currentLyrics.value = parsed
        isInstrumental.value = false
        updateActiveLine(currentTime.value)
      }
    } catch (err) {
      console.warn('[useLyrics] 解析歌词失败:', err)
      if (requestId === lyricRequestId) {
        currentLyrics.value = []
        isInstrumental.value = false
      }
    } finally {
      if (requestId === lyricRequestId) {
        isLoadingLyrics.value = false
      }
    }
  }

  // 监听当前播放进度，高频同步当前歌词高亮索引
  watch(currentTime, (newTime) => {
    updateActiveLine(newTime)
  })

  // 监听当前曲目切换，自动拉取新歌词
  watch(
    () => currentTrack.value?.id,
    async () => {
      await loadLyricsForTrack(currentTrack.value)
    },
    { immediate: true }
  )

  function seekToLine(idx: number) {
    const line = currentLyrics.value[idx]
    if (line) {
      seek(line.time)
    }
  }

  return {
    currentLyrics,
    currentLineIndex,
    isLoadingLyrics,
    hasLyrics,
    isInstrumental,
    loadLyricsForTrack,
    updateActiveLine,
    seekToLine,
  }
}
