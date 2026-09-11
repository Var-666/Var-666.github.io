import { ref, computed } from 'vue'

export type DrawerType = 'projects' | 'articles' | 'updates' | 'cabinet' | 'map' | null

export interface DiscoveredItem {
  id: string
  title: string
  category: string
  desc: string
  timestamp: number
}

const STORAGE_KEY = 'my_little_web_discoveries_v1'

// 初始默认发现的内容（对齐参考图中的 3 / 10）
const DEFAULT_DISCOVERIES: DiscoveredItem[] = [
  {
    id: 'base-pc',
    title: '工作站电脑',
    category: '基地设施',
    desc: '连接外部网络的核心终端，归档了所有已上线的数字作品与创意工具。',
    timestamp: Date.now() - 3600000 * 5,
  },
  {
    id: 'base-bookshelf',
    title: '沉思书架',
    category: '文章典籍',
    desc: '陈列着多年积累的技术手记、架构复盘与生活随笔。',
    timestamp: Date.now() - 3600000 * 3,
  },
  {
    id: 'base-map',
    title: '探险羊皮地图',
    category: '世界导览',
    desc: '标有迷雾区域的地形图，指引着通往未知森林与废弃设施的道路。',
    timestamp: Date.now() - 3600000 * 1,
  },
]

// 响应式单例状态
const activeDrawer = ref<DrawerType>(null)
const discoveries = ref<DiscoveredItem[]>(loadDiscoveries())
const recentDiscoveryToast = ref<DiscoveredItem | null>(null)
const isFullscreen = ref(false)

function loadDiscoveries(): DiscoveredItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (e) {
    console.warn('Failed to parse discoveries from localStorage', e)
  }
  return [...DEFAULT_DISCOVERIES]
}

function saveDiscoveries() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(discoveries.value))
  } catch (e) {
    console.warn('Failed to save discoveries to localStorage', e)
  }
}

export function useCabinStore() {
  const totalTargetCount = 10

  const discoveredCount = computed(() => discoveries.value.length)
  const progressPercent = computed(() =>
    Math.min(100, Math.round((discoveredCount.value / totalTargetCount) * 100))
  )

  function openDrawer(type: DrawerType) {
    activeDrawer.value = type
  }

  function closeDrawer() {
    activeDrawer.value = null
  }

  function discoverItem(item: Omit<DiscoveredItem, 'timestamp'>) {
    const exists = discoveries.value.some((d) => d.id === item.id)
    if (!exists) {
      const newEntry: DiscoveredItem = {
        ...item,
        timestamp: Date.now(),
      }
      discoveries.value.push(newEntry)
      saveDiscoveries()

      // 触发短暂的获得新物品 Toast
      recentDiscoveryToast.value = newEntry
      setTimeout(() => {
        if (recentDiscoveryToast.value?.id === newEntry.id) {
          recentDiscoveryToast.value = null
        }
      }, 4000)
    }
  }

  function toggleFullscreen() {
    isFullscreen.value = !isFullscreen.value
  }

  return {
    activeDrawer,
    discoveries,
    discoveredCount,
    totalTargetCount,
    progressPercent,
    recentDiscoveryToast,
    isFullscreen,
    openDrawer,
    closeDrawer,
    discoverItem,
    toggleFullscreen,
  }
}
