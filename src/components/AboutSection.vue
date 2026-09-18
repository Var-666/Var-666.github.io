<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'

const sectionRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const statsRef = ref<HTMLElement | null>(null)
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 8, scale: 1.02, speed: 400 })

// 数字滚动动画
interface StatItem {
  end: number
  suffix: string
  label: string
  current: string
}

const stats = ref<StatItem[]>([
  { end: 3, suffix: '+', label: '年代码修行', current: '0+' },
  { end: 365, suffix: '+', label: '持续探索天数', current: '0+' },
  { end: 100, suffix: '%', label: '造物与美学热情', current: '0%' },
])

let countersStarted = false

function animateCounters() {
  if (countersStarted) return
  countersStarted = true

  stats.value.forEach((stat, i) => {
    const duration = 1800 + i * 300
    const startTime = performance.now()
    const end = stat.end

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(end * eased)
      stats.value[i].current = current + stat.suffix
      if (progress < 1) {
        requestAnimationFrame(step)
      }
    }

    requestAnimationFrame(step)
  })
}

// 用 IntersectionObserver 触发计数动画
const counterObserver = new IntersectionObserver(
  (entries) => {
    if (entries[0]?.isIntersecting) {
      animateCounters()
      counterObserver.disconnect()
    }
  },
  { threshold: 0.5 }
)

onMounted(async () => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-left, .reveal-right', sectionRef.value)
  }

  await nextTick()

  // 绑定 3D 倾斜
  if (cardRef.value) {
    bindTilt(cardRef.value)
  }

  // 观察统计区域
  if (statsRef.value) {
    counterObserver.observe(statsRef.value)
  }
})
</script>

<template>
  <section id="about" class="section" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">关于与手艺</h2>
        <p class="section-subtitle">在代码与设计的十字路口，以手艺人心态雕琢真实触感</p>
      </div>

      <div class="about-grid">
        <!-- 左侧：陶艺拱门肖像壁龛 -->
        <div class="about-avatar-col reveal-left">
          <div class="avatar-ceramic-niche">
            <div class="avatar-portrait-wrap">
              <svg viewBox="0 0 48 48" width="100%" height="100%" class="avatar-svg">
                <!-- 背景圆 -->
                <circle cx="24" cy="24" r="24" fill="#325844" />
                <!-- 蓝色工装夹克领口与白衬衫 -->
                <path d="M10 44 C10 35, 17 33, 24 33 C31 33, 38 35, 38 44 Z" fill="#202A26" />
                <path d="M14 44 C14 36, 18 34, 24 34 C30 34, 34 36, 34 44 Z" fill="#3D5A4C" />
                <path d="M22 34 L24 37 L26 34 Z" fill="#ffffff" />
                <!-- 小人脸蛋 -->
                <circle cx="24" cy="24" r="10.5" fill="#ffd3b6" />
                <!-- 栗色刘海与鬓发 -->
                <path d="M15 21 Q19 25 24 20 Q29 25 33 21 Q30 14 24 14 Q18 14 15 21 Z" fill="#3d271d" />
                <!-- 萌系大眼睛 -->
                <circle cx="20.5" cy="23.5" r="1.5" fill="#1e272e" />
                <circle cx="27.5" cy="23.5" r="1.5" fill="#1e272e" />
                <!-- 脸颊红晕 -->
                <ellipse cx="18.5" cy="26.5" rx="2.2" ry="1.2" fill="#ff7979" opacity="0.65" />
                <ellipse cx="29.5" cy="26.5" rx="2.2" ry="1.2" fill="#ff7979" opacity="0.65" />
                <!-- 微笑小嘴 -->
                <path d="M22 26.5 Q24 28.5 26 26.5" stroke="#b33939" stroke-width="1.2" stroke-linecap="round" fill="none" />
                <!-- 标志性深红便帽 (Red Beanie) -->
                <path d="M12 18 C12 8, 36 8, 36 18 Z" fill="#C25B34" />
                <!-- 便帽卷边厚圈 -->
                <rect x="11" y="16" width="26" height="4.5" rx="2.2" fill="#9E4322" />
              </svg>
            </div>

            <div class="avatar-foot-badge">
              <span class="foot-dot"></span>
              <span class="foot-text">数字手艺人 · 杭州</span>
            </div>
          </div>
        </div>

        <!-- 右侧：工坊工册卡片 -->
        <div class="about-info-col reveal-right">
          <div ref="cardRef" class="tile-card about-card tilt-shine">
            <div class="about-card-header">
              <span class="card-kicker">造物理念</span>
              <h3 class="about-heading">你好，我是 var</h3>
            </div>

            <p class="about-bio">
              一名专注于全栈架构与交互美学的独立创造者。我相信优秀的数字造物应当如同烧制的器物一般——拥有清晰自洽的骨骼结构、温润自然的交互触感与诚实的生命力。
            </p>
            <p class="about-bio">
              在每一次状态流转、动效加速度与数据管线中寻找秩序。把多余的视觉噪音去掉，让信息和内容本身发出清晰、有分量的声音。
            </p>

            <!-- 统计数字 — 3 格实体微瓷砖 -->
            <div class="about-stats-grid" ref="statsRef">
              <div
                v-for="stat in stats"
                :key="stat.label"
                class="stat-tile"
              >
                <span class="stat-number">{{ stat.current }}</span>
                <span class="stat-label">{{ stat.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 3.5rem;
  align-items: stretch;
}

/* 陶艺拱门肖像壁龛 */
.about-avatar-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.avatar-ceramic-niche {
  background: var(--color-surface);
  border: 1px solid var(--color-grout);
  border-radius: 120px 120px var(--radius) var(--radius);
  box-shadow: var(--tile-shadow);
  padding: 36px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  transition: transform var(--transition), box-shadow var(--transition);
}

.avatar-ceramic-niche:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
}

.avatar-portrait-wrap {
  width: 170px;
  height: 170px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1), 0 4px 16px rgba(0, 0, 0, 0.06);
  border: 4px solid var(--color-bg-alt);
  margin-bottom: 1.5rem;
  transition: transform 0.35s var(--ease-spring);
}

.avatar-ceramic-niche:hover .avatar-portrait-wrap {
  transform: scale(1.04);
}

.avatar-foot-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-grout);
  border-radius: var(--radius-xs);
  font-size: 0.78rem;
  color: var(--color-text-light);
  font-weight: 500;
}

.foot-dot {
  width: 6px;
  height: 6px;
  background: var(--color-glaze-celadon);
  border-radius: 50%;
}

/* 右侧信息瓷砖卡片 */
.about-info-col {
  display: flex;
}

.about-card {
  padding: 3rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.about-card-header {
  margin-bottom: 1.4rem;
}

.card-kicker {
  display: inline-block;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-glaze-celadon);
  letter-spacing: 0.06em;
  margin-bottom: 0.4rem;
}

.about-heading {
  font-family: var(--font-serif);
  font-size: 1.85rem;
  font-weight: 600;
  color: var(--color-ink);
  letter-spacing: -0.01em;
}

.about-bio {
  font-size: 1rem;
  line-height: 1.85;
  color: var(--color-text-light);
  margin-bottom: 1.2rem;
  font-weight: 400;
}

/* 统计数据 — 3 格实体微瓷砖 */
.about-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 1.8rem;
  padding-top: 1.8rem;
  border-top: 1px solid var(--color-grout);
}

.stat-tile {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-grout);
  border-radius: var(--radius-sm);
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.7);
  transition: transform var(--transition), border-color var(--transition), background var(--transition);
}

.stat-tile:hover {
  transform: translateY(-2px);
  background: #FFFFFF;
  border-color: #D2CEC2;
}

.stat-number {
  font-family: var(--font-mono);
  font-size: 1.7rem;
  font-weight: 700;
  color: var(--color-glaze-celadon);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  transition: color var(--transition);
}

.stat-tile:hover .stat-number {
  color: var(--color-glaze-celadon-light);
}

.stat-label {
  font-size: 0.78rem;
  color: var(--color-text-light);
  font-weight: 400;
}

/* 响应式 */
@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .avatar-ceramic-niche {
    border-radius: var(--radius);
    padding: 28px 20px;
    max-width: 320px;
    margin: 0 auto;
  }

  .avatar-portrait-wrap {
    width: 140px;
    height: 140px;
  }

  .about-card {
    padding: 2rem 1.6rem;
  }

  .about-stats-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .stat-tile {
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 18px;
  }
}
</style>
