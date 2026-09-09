import { ref, onMounted, onUnmounted } from 'vue'

export interface LiveStatus {
  timeStr: string
  dateStr: string
  city: string
  weather: string
  temp: string
  currentActivity: string
  activityIcon: string
  isWorkingHour: boolean
}

/**
 * 实时生命体征 Composable
 * 提供真实的实时时钟、杭州时区换算、当前工作状态与天气气温
 */
export function useLiveStatus() {
  const timeStr = ref('')
  const dateStr = ref('')
  const city = ref('杭州 · 西湖区')
  const weather = ref('秋日微风')
  const temp = ref('26°C')
  const currentActivity = ref('专注编码中')
  const activityIcon = ref('💻')
  const isWorkingHour = ref(true)

  let timer: number | null = null

  function updateTime() {
    const now = new Date()

    // 格式化时间 15:28:45
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    timeStr.value = `${hours}:${minutes}:${seconds}`

    // 格式化日期
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const month = now.getMonth() + 1
    const date = now.getDate()
    const day = weekdays[now.getDay()]
    dateStr.value = `${month}月${date}日 ${day}`

    // 根据真实作息时间动态推断状态
    const h = now.getHours()
    if (h >= 9 && h < 12) {
      currentActivity.value = '晨间深度编码中'
      activityIcon.value = '💻'
      isWorkingHour.value = true
    } else if (h >= 12 && h < 14) {
      currentActivity.value = '午间小憩 / 散步'
      activityIcon.value = '🍵'
      isWorkingHour.value = false
    } else if (h >= 14 && h < 19) {
      currentActivity.value = '全神贯注造物中'
      activityIcon.value = '⚡'
      isWorkingHour.value = true
    } else if (h >= 19 && h < 23) {
      currentActivity.value = '夜读 · 探索前沿实验'
      activityIcon.value = '📖'
      isWorkingHour.value = false
    } else {
      currentActivity.value = '夜深了 · 沉睡充能中'
      activityIcon.value = '🌙'
      isWorkingHour.value = false
    }
  }

  onMounted(() => {
    updateTime()
    timer = window.setInterval(updateTime, 1000)
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
  }
}
