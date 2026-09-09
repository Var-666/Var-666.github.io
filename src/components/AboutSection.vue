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
  { end: 5, suffix: '+', label: '年经验', current: '0+' },
  { end: 30, suffix: '+', label: '已完成项目', current: '0+' },
  { end: 100, suffix: '%', label: '创作热情', current: '0%' },
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
        <h2 class="section-title">关于我</h2>
        <p class="section-subtitle">一个热爱自然与创造的开发者</p>
      </div>

      <div class="about-grid">
        <!-- 左侧：头像区域 -->
        <div class="about-avatar reveal-left">
          <div class="avatar-frame">
            <div class="avatar-placeholder">
              <div class="avatar-inner">
                <span class="avatar-char">V</span>
              </div>
            </div>
            <!-- 脉冲光环 -->
            <div class="avatar-ring"></div>
            <div class="avatar-ring ring-2"></div>
            <!-- 浮动装饰点 -->
            <div class="avatar-dot dot-1"></div>
            <div class="avatar-dot dot-2"></div>
            <div class="avatar-dot dot-3"></div>
          </div>
        </div>

        <!-- 右侧：信息卡片 — 3D 倾斜 + 光泽 -->
        <div class="about-info reveal-right">
          <div ref="cardRef" class="glass-card about-card tilt-shine">
            <p class="about-greeting">你好，世界 <span class="wave">👋</span></p>
            <h3 class="about-name">
              我是 <em>var</em>
            </h3>
            <p class="about-bio">
              一名充满热情的全栈开发者与设计师，专注于创建简约而富有表现力的数字体验。
              我相信好的设计如同自然一般——简洁、和谐、充满生命力。
            </p>
            <p class="about-bio">
              每一行代码都是对美的追求，每一个像素都承载着对细节的关注。
              我享受在技术与艺术之间寻找平衡，让数字世界也能感受到自然的呼吸。
            </p>

            <!-- 统计数字 — 滚动计数 -->
            <div class="about-stats" ref="statsRef">
              <div
                v-for="(stat, index) in stats"
                :key="stat.label"
                class="stat-item"
              >
                <span class="stat-number">{{ stat.current }}</span>
                <span class="stat-label">{{ stat.label }}</span>
                <div v-if="index < stats.length - 1" class="stat-divider"></div>
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
  grid-template-columns: 1fr 1.6fr;
  gap: 4rem;
  align-items: center;
}

/* 头像 */
.about-avatar {
  display: flex;
  justify-content: center;
}

.avatar-frame {
  position: relative;
  width: 260px;
  height: 260px;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-bg-alt), var(--color-bg));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 10px 40px rgba(0, 0, 0, 0.06),
    inset 0 -4px 12px rgba(0, 0, 0, 0.03);
  transition: all 0.4s var(--ease);
}

.avatar-placeholder:hover {
  box-shadow:
    0 10px 40px rgba(124, 140, 110, 0.15),
    0 0 60px rgba(124, 140, 110, 0.08),
    inset 0 -4px 12px rgba(0, 0, 0, 0.03);
  transform: scale(1.03);
}

.avatar-inner {
  width: 130px;
  height: 130px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-accent), var(--color-accent-light));
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.4s var(--ease-spring);
}

.avatar-placeholder:hover .avatar-inner {
  transform: scale(1.08) rotate(-5deg);
}

.avatar-char {
  font-family: 'Courier New', monospace;
  font-size: 3.5rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
}

/* 脉冲光环 */
.avatar-ring {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 1px solid var(--color-accent-light);
  opacity: 0.3;
  animation: slowSpin 25s linear infinite;
}

.ring-2 {
  inset: -24px;
  border-style: dashed;
  border-color: rgba(196, 168, 130, 0.2);
  animation-direction: reverse;
  animation-duration: 35s;
}

/* 浮动装饰点 */
.avatar-dot {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  animation: float-dot 4s ease-in-out infinite;
}

.dot-1 { top: 10%; right: 0; animation-delay: 0s; }
.dot-2 { bottom: 5%; left: 5%; animation-delay: 1.3s; opacity: 0.6; width: 4px; height: 4px; }
.dot-3 { top: 50%; right: -8px; animation-delay: 2.6s; opacity: 0.4; width: 5px; height: 5px; background: var(--color-warm); }

@keyframes float-dot {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-8px) scale(1.2); }
}

@keyframes slowSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 信息卡片 */
.about-card {
  padding: 3rem;
}

.about-greeting {
  font-size: 1rem;
  color: var(--color-accent);
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.wave {
  display: inline-block;
  animation: wave 2.5s ease-in-out infinite;
  transform-origin: 70% 70%;
}

@keyframes wave {
  0%, 100% { transform: rotate(0deg); }
  10% { transform: rotate(14deg); }
  20% { transform: rotate(-8deg); }
  30% { transform: rotate(14deg); }
  40% { transform: rotate(-4deg); }
  50% { transform: rotate(10deg); }
  60%, 100% { transform: rotate(0deg); }
}

.about-name {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  color: var(--color-text);
}

.about-name em {
  font-style: normal;
  font-family: 'Courier New', monospace;
  color: var(--color-accent);
  font-size: 2rem;
  letter-spacing: 0.05em;
}

.about-bio {
  font-size: 1.05rem;
  line-height: 1.9;
  color: var(--color-text-light);
  margin-bottom: 1.2rem;
  font-weight: 300;
}

.about-bio:last-of-type {
  margin-bottom: 2rem;
}

/* 统计数据 */
.about-stats {
  display: flex;
  align-items: center;
  gap: 0;
  padding-top: 2rem;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex: 1;
  position: relative;
}

.stat-number {
  font-family: 'Courier New', monospace;
  font-size: 2rem;
  font-weight: 700;
  color: var(--color-accent);
  transition: color 0.3s;
}

.stat-item:hover .stat-number {
  color: var(--color-accent-dark);
  transform: scale(1.1);
}

.stat-label {
  font-size: 0.85rem;
  color: var(--color-text-lighter);
  font-weight: 400;
}

.stat-divider {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 1px;
  height: 40px;
  background: rgba(0, 0, 0, 0.08);
}

/* 响应式 */
@media (max-width: 768px) {
  .about-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }

  .avatar-frame {
    width: 200px;
    height: 200px;
  }

  .avatar-inner {
    width: 100px;
    height: 100px;
  }

  .avatar-char {
    font-size: 2.5rem;
  }

  .about-card {
    padding: 2rem;
  }

  .stat-number {
    font-size: 1.5rem;
  }
}
</style>
