import { ref, onMounted, onUnmounted } from 'vue'

const WMO_WEATHER_MAP: Record<number, string> = {
  0: '晴朗 ☀️',
  1: '大部晴朗 🌤️',
  2: '多云 ⛅',
  3: '阴天 ☁️',
  45: '有雾 🌫️',
  48: '薄雾 🌫️',
  51: '毛毛雨 🌦️',
  53: '小雨 🌧️',
  55: '细雨连绵 🌧️',
  61: '小雨 🌧️',
  63: '中雨 🌧️',
  65: '大雨 🌧️',
  71: '小雪 🌨️',
  73: '中雪 ❄️',
  75: '大雪 ❄️',
  80: '阵雨 🌦️',
  81: '强阵雨 🌧️',
  82: '暴雨 ⛈️',
  95: '雷阵雨 ⛈️',
  96: '雷阵雨 ⛈️',
  99: '强雷雨 ⛈️',
}

function getWeatherDesc(code: number): string {
  return WMO_WEATHER_MAP[code] || '微风拂面 🍃'
}

const CACHE_KEY = 'var_live_geo_weather_v1'
const CACHE_TTL = 20 * 60 * 1000 // 20 分钟缓存

export function useLiveStatus() {
  const timeStr = ref('')
  const dateStr = ref('')
  const city = ref('定位中...')
  const weather = ref('获取气象中...')
  const temp = ref('--°C')
  const currentActivity = ref('专注造物中')
  const activityIcon = ref('💻')
  const isWorkingHour = ref(true)
  const isAutoLocated = ref(false)

  let timer: number | null = null

  function updateTime() {
    const now = new Date()

    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    timeStr.value = `${hours}:${minutes}:${seconds}`

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const month = now.getMonth() + 1
    const date = now.getDate()
    const day = weekdays[now.getDay()]
    dateStr.value = `${month}月${date}日 ${day}`

    const h = now.getHours()
    if (h >= 9 && h < 12) {
      currentActivity.value = '晨间深度编码中'
      activityIcon.value = '💻'
      isWorkingHour.value = true
    } else if (h >= 12 && h < 14) {
      currentActivity.value = '午间小憩 · 养神'
      activityIcon.value = '🍵'
      isWorkingHour.value = false
    } else if (h >= 14 && h < 19) {
      currentActivity.value = '全神贯注造物中'
      activityIcon.value = '⚡'
      isWorkingHour.value = true
    } else if (h >= 19 && h < 23) {
      currentActivity.value = '夜读 · 前沿探索'
      activityIcon.value = '📖'
      isWorkingHour.value = false
    } else {
      currentActivity.value = '夜深了 · 离线充能'
      activityIcon.value = '🌙'
      isWorkingHour.value = false
    }
  }

  async function fetchGeoAndWeather() {
    // 1. 先检查本地缓存
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        if (Date.now() - data.timestamp < CACHE_TTL) {
          city.value = data.city
          weather.value = data.weather
          temp.value = data.temp
          isAutoLocated.value = true
          return
        }
      }
    } catch {
      // ignore
    }

    try {
      // 2. 调用真实免费的 IP 定位 API (支持中文与跨域 HTTPS)
      const geoRes = await fetch('https://ipwho.is/?lang=zh-CN')
      const geoData = await geoRes.json()

      if (geoData && geoData.success) {
        const regionName = geoData.region || geoData.city || ''
        const cityName = geoData.city || ''
        const countryName = geoData.country || ''

        let displayCity = ''
        if (countryName === '中国') {
          displayCity = regionName === cityName ? cityName : `${regionName} · ${cityName}`
        } else {
          displayCity = `${countryName} · ${cityName}`
        }
        city.value = displayCity

        // 3. 根据定位到的经纬度，调用 Open-Meteo 真实气象接口
        const lat = geoData.latitude
        const lon = geoData.longitude

        if (lat && lon) {
          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`
          )
          const weatherData = await weatherRes.json()

          if (weatherData && weatherData.current) {
            const currentTemp = Math.round(weatherData.current.temperature_2m)
            const weatherCode = weatherData.current.weather_code
            temp.value = `${currentTemp}°C`
            weather.value = getWeatherDesc(weatherCode)
          }
        }

        isAutoLocated.value = true

        // 写入本地缓存
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              city: city.value,
              weather: weather.value,
              temp: temp.value,
              timestamp: Date.now(),
            })
          )
        } catch {
          // ignore
        }
        return
      }
    } catch (e) {
      console.warn('自动定位服务暂未连通，使用平稳兜底:', e)
    }

    // 兜底策略（网络离线或接口超限时优雅回退）
    city.value = '中国 · 杭州'
    weather.value = '晴朗微风 🍃'
    temp.value = '25°C'
    isAutoLocated.value = false
  }

  onMounted(() => {
    updateTime()
    timer = window.setInterval(updateTime, 1000)
    fetchGeoAndWeather()
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  return {
    timeStr,
    dateStr,
    city,
    weather,
    temp,
    currentActivity,
    activityIcon,
    isWorkingHour,
    isAutoLocated,
  }
}
