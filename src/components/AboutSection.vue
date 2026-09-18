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
    icon: '🪞',
    title: '反重力构型',
    subtitle: 'ANTI-GRAVITY ARCHITECTURE',
    desc: '打破扁平矩形盒子的平庸束缚。在非欧几何与三维微景深中，让界面化为具有浮游质量与失重呼吸感的交互雕塑。',
  },
  {
    icon: '⏳',
    title: '融化的时空切片',
    subtitle: 'THE MELTING CONTINUUM',
    desc: '汲取达利相对论钟盘的启发，毫秒级动效不仅是平滑缓冲，而是将时间的流逝凝固为液态水银般的诗意轨迹。',
  },
  {
    icon: '🌌',
    title: '声画量子通感',
    subtitle: 'ONEIRIC SYNESTHESIA',
    desc: '跨越感官维度。傅里叶声频在视野中激起引力水纹，微交互触觉产生声学回响，实现眼耳心通感的超现实沉浸。',
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
  { end: 3, suffix: '+', label: '恒星年 · 深度编程与美学构想', current: '0+' },
  { end: 365, suffix: '+', label: '天文学日 · 跨维度日常探索', current: '0+' },
  { end: 100, suffix: '%', label: '纯度 · 超现实创造欲望', current: '0%' },
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
        <h2 class="section-title">形而上空间 · 关于我</h2>
        <p class="section-subtitle">在虚实镜像与相对论时空之间，探求代码所能抵达的超现实艺术边界</p>
      </div>

      <div class="about-grid">
        <!-- 左侧：形而上拱门肖像壁龛 (De Chirico Arcade Niche) -->
        <div class="about-avatar-col reveal-left">
          <div class="avatar-ceramic-niche surreal-portal-frame">
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
              <span class="foot-text">现实驻留：杭州 · 漫游于以太之间</span>
            </div>
          </div>
        </div>

        <!-- 右侧：形而上画案与三大超现实造物悖论 -->
        <div class="about-info-col reveal-right">
          <div ref="cardRef" class="tile-card about-card tilt-shine surreal-portal-frame">
            <div class="about-card-header">
              <span class="card-kicker">✦ PARADOX // 形而上回廊</span>
              <h3 class="about-heading">我是 var · 探索虚实界限</h3>
            </div>

            <p class="about-bio">
              在理性逻辑与超现实想象的交汇处构建界面。我迷恋德·基里科的深邃投影、马格利特的错位天空与达利融化的时间感——将代码雕琢为兼具失重质感、量子通感与生命律动的数字交互艺术品。
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
  grid-template-columns: 320px 1fr;
  gap: 3.5rem;
  align-items: stretch;
}

/* 形而上拱门肖像壁龛 (De Chirico Arcade Niche) */
.about-avatar-col {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.avatar-ceramic-niche {
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.22);
  border-radius: 160px 160px var(--radius) var(--radius);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1);
  padding: 44px 24px 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  position: relative;
  overflow: hidden;
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}

.avatar-ceramic-niche:hover {
  transform: translateY(-4px);
  box-shadow: 0 32px 70px rgba(0, 0, 0, 0.7), 0 0 35px rgba(92, 225, 230, 0.2);
  border-color: rgba(92, 225, 230, 0.45);
}

.niche-ambient-halo {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(92, 225, 230, 0.22) 0%, rgba(214, 93, 177, 0.12) 45%, transparent 70%);
  filter: blur(35px);
  pointer-events: none;
}

.avatar-portrait-wrap {
  width: 176px;
  height: 176px;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.6), 0 0 25px rgba(92, 225, 230, 0.25);
  border: 2px solid rgba(92, 225, 230, 0.4);
  margin-bottom: 1.8rem;
  position: relative;
  z-index: 2;
  transition: transform 0.4s var(--ease-spring), border-color 0.4s var(--ease), box-shadow 0.4s var(--ease);
}

.avatar-ceramic-niche:hover .avatar-portrait-wrap {
  transform: scale(1.05) rotate(1deg);
  border-color: var(--color-ether-cyan);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 35px rgba(92, 225, 230, 0.45);
}

.avatar-foot-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: rgba(10, 11, 22, 0.75);
  border: 1px solid rgba(92, 225, 230, 0.2);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 500;
  position: relative;
  z-index: 2;
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.foot-dot {
  width: 6px;
  height: 6px;
  background: var(--color-ether-cyan);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--color-ether-cyan);
}

/* 右侧信息瓷砖卡片 — 形而上画案 */
.about-info-col {
  display: flex;
}

.about-card {
  padding: 3rem;
  width: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.18);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.about-card-header {
  margin-bottom: 1.2rem;
}

.card-kicker {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--color-ether-cyan);
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 12px rgba(92, 225, 230, 0.4);
}

.about-heading {
  font-family: var(--font-serif);
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--color-ink);
  letter-spacing: -0.01em;
}

.about-bio {
  font-size: 1.02rem;
  line-height: 1.9;
  color: var(--color-text-muted);
  margin-bottom: 1.5rem;
  font-weight: 400;
}

/* 三大关注点交互微视窗 */
.craft-pillars-wrap {
  margin: 1.2rem 0 1.8rem;
}

.pillars-nav {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.pillar-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  background: rgba(10, 11, 22, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.84rem;
  font-weight: 500;
  transition: all 0.3s var(--ease);
}

.pillar-tab:focus-visible {
  outline: 2px solid var(--color-ether-cyan);
  outline-offset: 2px;
}

.pillar-tab:hover {
  background: rgba(92, 225, 230, 0.08);
  border-color: rgba(92, 225, 230, 0.3);
  color: #FFFFFF;
}

.pillar-tab.active {
  border-color: var(--color-ether-cyan);
  background: linear-gradient(135deg, rgba(92, 225, 230, 0.22), rgba(214, 93, 177, 0.18));
  color: #FFFFFF;
  box-shadow: 0 0 20px rgba(92, 225, 230, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.2);
}

.pillar-tab-icon {
  font-size: 1rem;
}

.pillar-detail-box {
  padding: 20px 24px;
  background: rgba(10, 11, 22, 0.7);
  border: 1px solid rgba(92, 225, 230, 0.15);
  border-radius: var(--radius);
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.4);
}

.pillar-subtitle {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--color-solar-gold);
  letter-spacing: 0.06em;
  margin-bottom: 6px;
  display: block;
  font-weight: 600;
}

.pillar-desc {
  font-size: 0.94rem;
  color: var(--color-text);
  line-height: 1.75;
}

/* 统计数据 — 3 座悬浮形而上基石 */
.about-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-top: 1.6rem;
  padding-top: 1.6rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.stat-tile {
  background: rgba(10, 11, 22, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 6px;
  transition: transform 0.3s var(--ease-spring), border-color 0.3s var(--ease), box-shadow 0.3s var(--ease);
}

.stat-tile:hover {
  transform: translateY(-4px);
  background: rgba(18, 20, 41, 0.85);
  border-color: rgba(92, 225, 230, 0.4);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5), 0 0 20px rgba(92, 225, 230, 0.18);
}

.stat-number {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-ether-cyan);
  text-shadow: 0 0 15px rgba(92, 225, 230, 0.4);
  font-variant-numeric: tabular-nums;
  line-height: 1.1;
  display: inline-block;
  transition: color var(--transition), transform 0.3s var(--ease-spring);
}

.stat-tile:hover .stat-number {
  color: #FFFFFF;
  text-shadow: 0 0 20px rgba(92, 225, 230, 0.7);
}

.stat-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-weight: 400;
  letter-spacing: 0.02em;
}

/* 响应式 */
@media (max-width: 900px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .avatar-ceramic-niche {
    border-radius: var(--radius-lg);
    padding: 32px 20px;
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
    padding: 14px 20px;
  }
}
</style>
