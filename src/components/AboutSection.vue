<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'

const sectionRef = ref<HTMLElement | null>(null)
const cardRef = ref<HTMLElement | null>(null)
const statsRef = ref<HTMLElement | null>(null)
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 8, scale: 1.02, speed: 400 })

// 我在意的美学悖论
interface CraftPillar {
  icon: string
  title: string
  subtitle: string
  desc: string
}

const pillars: CraftPillar[] = [
  {
    icon: '🎨',
    title: '界面与交互',
    subtitle: '用心做好每个细节',
    desc: '相信好的界面不需要说明书。追求流畅自然的交互体验，让用户感觉一切都恰到好处——动效不多不少，布局舒服透气。',
  },
  {
    icon: '🔧',
    title: '工程与工具',
    subtitle: '把代码当手艺来打磨',
    desc: '喜欢在 TypeScript 的严格约束下写出灵活的代码。注重组件复用、状态管理的优雅，以及构建工具链的效率。',
  },
  {
    icon: '🎵',
    title: '声音与空间',
    subtitle: '探索代码的更多可能',
    desc: '对 Web Audio API 和 Three.js 保持好奇。试着把声音变成看得见的波纹，把平面的网页变成可以走进去的空间。',
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
  { end: 3, suffix: '+', label: '年编程经验', current: '0+' },
  { end: 365, suffix: '+', label: '天持续学习', current: '0+' },
  { end: 100, suffix: '%', label: '热情和好奇心', current: '0%' },
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
        <h2 class="section-title">关于我</h2>
        <p class="section-subtitle">一个喜欢把想法做出来的人，对界面、声音和空间有自己的偏好</p>
      </div>

      <div class="about-grid">
        <!-- 左侧：形而上拱门肖像壁龛 (De Chirico Arcade Niche) -->
        <div class="about-avatar-col reveal-left">
          <div class="avatar-ceramic-niche">
            <div class="niche-ambient-halo" aria-hidden="true"></div>
            <div class="avatar-portrait-wrap">
              <svg viewBox="0 0 48 48" width="100%" height="100%" class="avatar-svg">
                <circle cx="24" cy="24" r="24" fill="#151B3D" />
                <!-- 日月双蚀光环 -->
                <circle cx="24" cy="24" r="21" fill="none" stroke="#5CE1E6" stroke-width="1" stroke-dasharray="3 3" opacity="0.6" />
                <path d="M10 44 C10 35, 17 33, 24 33 C31 33, 38 35, 38 44 Z" fill="#1E2752" />
                <path d="M14 44 C14 36, 18 34, 24 34 C30 34, 34 36, 34 44 Z" fill="#2E3C75" />
                <path d="M22 34 L24 37 L26 34 Z" fill="#FFFFFF" />
                <circle cx="24" cy="24" r="10.5" fill="#F4D3BD" />
                <path d="M15 21 Q19 25 24 20 Q29 25 33 21 Q30 14 24 14 Q18 14 15 21 Z" fill="#1A1C28" />
                <circle cx="20.5" cy="23.5" r="1.5" fill="#0A0B16" />
                <circle cx="27.5" cy="23.5" r="1.5" fill="#0A0B16" />
                <ellipse cx="18.5" cy="26.5" rx="2.2" ry="1.2" fill="#E24A68" opacity="0.6" />
                <ellipse cx="29.5" cy="26.5" rx="2.2" ry="1.2" fill="#E24A68" opacity="0.6" />
                <path d="M22 26.5 Q24 28.5 26 26.5" stroke="#E24A68" stroke-width="1.2" stroke-linecap="round" fill="none" />
                <!-- 标志性深红便帽 (异化为超现实玫瑰绯红) -->
                <path d="M12 18 C12 8, 36 8, 36 18 Z" fill="#E24A68" />
                <rect x="11" y="16" width="26" height="4.5" rx="2.2" fill="#C23652" />
              </svg>
            </div>

            <div class="avatar-foot-badge">
              <span class="foot-dot"></span>
              <span class="foot-text">坐标：杭州</span>
            </div>
          </div>
        </div>

        <!-- 右侧：形而上画案与三大超现实造物悖论 -->
        <div class="about-info-col reveal-right">
          <div ref="cardRef" class="tile-card about-card tilt-shine">
            <div class="about-card-header">
              <span class="card-kicker">关于</span>
              <h3 class="about-heading">我是 var</h3>
            </div>

            <p class="about-bio">
              写前端代码三年多了，从一开始就对「东西做出来好不好用、好不好看」特别在意。现在主要用 Vue + TypeScript 做项目，业余时间折腾声音可视化和 3D 小场景。住在杭州，喜欢深夜写代码时放一首坂本龙一。
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

            <!-- 统计数字 — 3 座悬浮形而上基石 -->
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
  grid-template-columns: 280px 1fr;
  gap: 3.5rem;
  align-items: stretch;
}

.about-avatar-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.avatar-ceramic-niche {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--tile-shadow);
  padding: 40px 24px 28px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform var(--transition), box-shadow var(--transition);
}

.avatar-ceramic-niche:hover {
  transform: translateY(-3px);
  box-shadow: var(--tile-shadow-hover);
}

.niche-ambient-halo {
  display: none;
}

.avatar-portrait-wrap {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 3px solid var(--color-surface);
  outline: 1px solid var(--color-border);
  margin-bottom: 1.5rem;
  transition: transform 0.4s var(--ease-spring);
}

.avatar-ceramic-niche:hover .avatar-portrait-wrap {
  transform: scale(1.04);
}

.avatar-foot-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--color-accent-soft);
  border: 1px solid rgba(91, 140, 110, 0.15);
  border-radius: var(--radius-full);
  font-size: 0.82rem;
  color: var(--color-accent);
  font-weight: 500;
}

.foot-dot {
  width: 6px;
  height: 6px;
  background: var(--color-accent);
  border-radius: 50%;
}

.about-info-col {
  display: flex;
}

.about-card {
  padding: 2.5rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.about-card-header {
  margin-bottom: 1rem;
}

.card-kicker {
  display: inline-block;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--color-accent);
  margin-bottom: 0.4rem;
}

.about-heading {
  font-family: var(--font-serif);
  font-size: 1.9rem;
  font-weight: 700;
  color: var(--color-ink);
}

.about-bio {
  font-size: 1rem;
  line-height: 1.9;
  color: var(--color-text-light);
  margin-bottom: 1.5rem;
}

.craft-pillars-wrap {
  margin: 1rem 0 1.5rem;
}

.pillars-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.pillar-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: var(--color-bg-alt);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  color: var(--color-text-light);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  transition: all 0.3s var(--ease);
}

.pillar-tab:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.pillar-tab:hover {
  background: var(--color-accent-soft);
  border-color: rgba(91, 140, 110, 0.2);
  color: var(--color-ink);
}

.pillar-tab.active {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
  color: var(--color-accent-dark);
  font-weight: 600;
}

.pillar-tab-icon {
  font-size: 1rem;
}

.pillar-detail-box {
  padding: 18px 22px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.pillar-subtitle {
  font-size: 0.82rem;
  color: var(--color-amber);
  margin-bottom: 6px;
  display: block;
  font-weight: 600;
}

.pillar-desc {
  font-size: 0.94rem;
  color: var(--color-text);
  line-height: 1.75;
}

.about-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}

.stat-tile {
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border-subtle);
  border-radius: var(--radius);
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  transition: transform 0.3s var(--ease-spring), border-color 0.3s var(--ease);
}

.stat-tile:hover {
  transform: translateY(-3px);
  border-color: var(--color-accent);
}

.stat-number {
  font-family: var(--font-mono);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  display: inline-block;
  transition: color var(--transition), transform 0.3s var(--ease-spring);
}

.stat-tile:hover .stat-number {
  color: var(--color-accent-dark);
}

.stat-label {
  font-size: 0.78rem;
  color: var(--color-text-lighter);
}

@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .avatar-ceramic-niche {
    padding: 28px 20px;
    max-width: 280px;
    margin: 0 auto;
  }
  .avatar-portrait-wrap {
    width: 130px;
    height: 130px;
  }
  .about-card {
    padding: 2rem 1.5rem;
  }
  .pillars-nav {
    grid-template-columns: 1fr;
  }
  .about-stats-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .stat-tile {
    flex-direction: row;
    justify-content: space-between;
    padding: 12px 18px;
  }
}
</style>
