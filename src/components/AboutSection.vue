<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'

const sectionRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const statsRef = ref<HTMLElement | null>(null)
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 8, scale: 1.02, speed: 400 })

// 我在意的小事
interface CraftPillar {
  icon: string
  title: string
  subtitle: string
  desc: string
}

const pillars: CraftPillar[] = [
  {
    icon: '🌿',
    title: '呼吸感与留白',
    subtitle: 'Breathing Space & Harmony',
    desc: '拒绝紧绷与过度装饰，让文字、间距与色彩像自然树影一样舒展，阅读与浏览都毫不费力。',
  },
  {
    icon: '🎈',
    title: '生动轻盈的微动效',
    subtitle: 'Playful Motion & Delight',
    desc: '轻微弹跳、物理阻尼与平滑过渡，让每次点击和滑动都充满像真实触碰小物件一般的乐趣。',
  },
  {
    icon: '☕',
    title: '温度与人情味',
    subtitle: 'Warmth & Human Touch',
    desc: '技术代码虽然冷静，但用心做出的产品能够传递善意与陪伴，让人感到放松和被尊重。',
  },
]

const activePillar = ref(0)

// 数字滚动动画
interface StatItem {
  end: number
  suffix: string
  label: string
  current: string
}

const stats = ref<StatItem[]>([
  { end: 3, suffix: '+', label: '年写代码与设计', current: '0+' },
  { end: 365, suffix: '+', label: '天保持日常探索', current: '0+' },
  { end: 100, suffix: '%', label: '对好玩事物的热爱', current: '0%' },
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

  if (cardRef.value) {
    bindTilt(cardRef.value)
  }

  if (statsRef.value) {
    counterObserver.observe(statsRef.value)
  }
})
</script>

<template>
  <section id="about" class="section" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">关于我与日常</h2>
        <p class="section-subtitle">写写代码，看看世界，用平和好奇的心态做出让自己和别人都感到舒服的体验</p>
      </div>

      <div class="about-grid">
        <!-- 左侧：多维拱门肖像壁龛 -->
        <div class="about-avatar-col reveal-left">
          <div class="avatar-ceramic-niche tile-card">
            <div class="niche-ambient-halo" aria-hidden="true"></div>
            <div class="avatar-portrait-wrap">
              <svg viewBox="0 0 48 48" width="100%" height="100%" class="avatar-svg">
                <circle cx="24" cy="24" r="24" fill="#4A7356" />
                <path d="M10 44 C10 35, 17 33, 24 33 C31 33, 38 35, 38 44 Z" fill="#2D4634" />
                <path d="M14 44 C14 36, 18 34, 24 34 C30 34, 34 36, 34 44 Z" fill="#588157" />
                <path d="M22 34 L24 37 L26 34 Z" fill="#FFFFFF" />
                <circle cx="24" cy="24" r="10.5" fill="#ffd3b6" />
                <path d="M15 21 Q19 25 24 20 Q29 25 33 21 Q30 14 24 14 Q18 14 15 21 Z" fill="#2E1C14" />
                <circle cx="20.5" cy="23.5" r="1.5" fill="#131716" />
                <circle cx="27.5" cy="23.5" r="1.5" fill="#131716" />
                <ellipse cx="18.5" cy="26.5" rx="2.2" ry="1.2" fill="#ff7979" opacity="0.65" />
                <ellipse cx="29.5" cy="26.5" rx="2.2" ry="1.2" fill="#ff7979" opacity="0.65" />
                <path d="M22 26.5 Q24 28.5 26 26.5" stroke="#b33939" stroke-width="1.2" stroke-linecap="round" fill="none" />
                <!-- 标志性深红便帽 (Red Beanie) -->
                <path d="M12 18 C12 8, 36 8, 36 18 Z" fill="#C85A48" />
                <rect x="11" y="16" width="26" height="4.5" rx="2.2" fill="#A84434" />
              </svg>
            </div>

            <div class="avatar-foot-badge">
              <span class="foot-dot"></span>
              <span class="foot-text">生活在杭州 · 喜欢晴天与音乐</span>
            </div>
          </div>
        </div>

        <!-- 右侧：工坊画案与三大柱石 -->
        <div class="about-info-col reveal-right">
          <div ref="cardRef" class="tile-card about-card tilt-shine">
            <div class="about-card-header">
              <span class="card-kicker">🌱 关于 · ABOUT ME</span>
              <h3 class="about-heading">你好，我是 var</h3>
            </div>

            <p class="about-bio">
              一名热爱前端交互与创意的开发者。比起严肃沉闷的教条和繁琐架构，我更喜欢把日常里的灵感写成充满自然呼吸感的小玩意——干净的代码、舒服的配色与顺手好用的微交互。
            </p>

            <!-- 三大关注点交互微视窗 -->
            <div class="craft-pillars-wrap">
              <div class="pillars-nav" role="tablist">
                <button
                  v-for="(pillar, pi) in pillars"
                  :key="pillar.title"
                  class="pillar-tab"
                  :class="{ active: activePillar === pi }"
                  @click="activePillar = pi"
                  role="tab"
                  :aria-selected="activePillar === pi"
                >
                  <span class="pillar-tab-icon">{{ pillar.icon }}</span>
                  <span class="pillar-tab-title">{{ pillar.title }}</span>
                </button>
              </div>
              <div class="pillar-detail-box">
                <div class="pillar-detail-top">
                  <span class="pillar-subtitle">{{ pillars[activePillar].subtitle }}</span>
                </div>
                <p class="pillar-desc">{{ pillars[activePillar].desc }}</p>
              </div>
            </div>

            <!-- 统计数字 — 3 格实体微浮台 -->
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
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: 140px 140px var(--radius) var(--radius);
  box-shadow: var(--tile-shadow);
  padding: 38px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}

.avatar-ceramic-niche:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
  border-color: var(--color-border-hover);
}

.niche-ambient-halo {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgba(62, 107, 72, 0.12) 0%, transparent 70%);
  filter: blur(30px);
  pointer-events: none;
}

.avatar-portrait-wrap {
  width: 170px;
  height: 170px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(45, 65, 52, 0.12);
  border: 3px solid rgba(62, 107, 72, 0.2);
  margin-bottom: 1.5rem;
  position: relative;
  z-index: 2;
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease);
}

.avatar-ceramic-niche:hover .avatar-portrait-wrap {
  transform: scale(1.04);
  border-color: var(--color-forest);
}

.avatar-foot-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  color: var(--color-text-light);
  font-weight: 500;
  position: relative;
  z-index: 2;
}

.foot-dot {
  width: 6px;
  height: 6px;
  background: var(--color-forest);
  border-radius: 50%;
  box-shadow: 0 0 6px var(--color-forest);
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
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  box-shadow: var(--tile-shadow);
}

.about-card-header {
  margin-bottom: 1.2rem;
}

.card-kicker {
  display: inline-block;
  font-family: var(--font-sans);
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--color-forest);
  letter-spacing: 0.04em;
  margin-bottom: 0.4rem;
}

.about-heading {
  font-family: var(--font-sans);
  font-size: 1.85rem;
  font-weight: 700;
  color: var(--color-ink);
  letter-spacing: -0.01em;
}

.about-bio {
  font-size: 0.98rem;
  line-height: 1.85;
  color: var(--color-text-light);
  margin-bottom: 1.2rem;
  font-weight: 400;
}

/* 三大关注点交互微视窗 */
.craft-pillars-wrap {
  margin: 1.2rem 0 1.5rem;
}

.pillars-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}

.pillar-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  color: var(--color-text-light);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 500;
  transition: border-color var(--transition), background-color var(--transition), color var(--transition), transform var(--transition);
}

.pillar-tab:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 2px;
}

.pillar-tab:hover {
  background: #FFFFFF;
  border-color: var(--color-forest);
  color: var(--color-forest);
}

.pillar-tab.active {
  border-color: var(--color-forest);
  background: var(--color-forest);
  color: #FFFFFF;
  box-shadow: 0 4px 12px var(--color-forest-glow);
}

.pillar-tab-icon {
  font-size: 0.95rem;
}

.pillar-detail-box {
  padding: 18px 22px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 3px rgba(45, 65, 52, 0.04);
}

.pillar-subtitle {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--color-forest);
  letter-spacing: 0.04em;
  margin-bottom: 4px;
  display: block;
  font-weight: 600;
}

.pillar-desc {
  font-size: 0.92rem;
  color: var(--color-ink);
  line-height: 1.7;
}

/* 统计数据 — 3 格实体微浮台 */
.about-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 1.6rem;
  padding-top: 1.6rem;
  border-top: 1px solid var(--border-light);
}

.stat-tile {
  background: var(--color-surface-sunken);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  transition: transform var(--transition), border-color var(--transition), background-color var(--transition);
}

.stat-tile:hover {
  transform: translateY(-2px);
  background: #FFFFFF;
  border-color: var(--color-forest);
  box-shadow: 0 6px 16px rgba(45, 65, 52, 0.06);
}

.stat-number {
  font-family: var(--font-mono);
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--color-forest);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  transition: color var(--transition);
}

.stat-tile:hover .stat-number {
  color: var(--color-forest-light);
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

  .pillars-nav {
    grid-template-columns: 1fr;
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
