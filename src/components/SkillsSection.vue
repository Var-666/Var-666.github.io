<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'

const sectionRef = ref<HTMLElement | null>(null)
const cardRefs = ref<HTMLElement[]>([])
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 8, scale: 1.02, speed: 350 })

interface Skill {
  name: string
  percent: number
  icon: string
}

const skills: Skill[] = [
  { name: 'Vue.js', percent: 92, icon: '🌿' },
  { name: 'TypeScript', percent: 88, icon: '📘' },
  { name: 'React', percent: 85, icon: '⚛️' },
  { name: 'Node.js', percent: 82, icon: '🟢' },
  { name: 'CSS / 动画', percent: 90, icon: '🎨' },
  { name: 'UI/UX 设计', percent: 78, icon: '✏️' },
  { name: 'Python', percent: 75, icon: '🐍' },
  { name: 'Docker', percent: 70, icon: '🐳' },
]

const RING_RADIUS = 42
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

function getLevel(percent: number): string {
  if (percent >= 90) return '精通'
  if (percent >= 80) return '熟练'
  if (percent >= 70) return '常用'
  return '学习中'
}

function getStrokeDashoffset(percent: number): number {
  return RING_CIRCUMFERENCE - (RING_CIRCUMFERENCE * percent) / 100
}

onMounted(async () => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-scale', sectionRef.value)
  }

  await nextTick()

  // 为每个技能卡片绑定 3D 倾斜
  cardRefs.value.forEach((el) => {
    if (el) bindTilt(el)
  })
})
</script>

<template>
  <section id="skills" class="section section-alt" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">技能专长</h2>
        <p class="section-subtitle">不断精进，持续成长</p>
      </div>

      <div class="skills-grid">
        <div
          v-for="(skill, index) in skills"
          :key="skill.name"
          :ref="(el) => { if (el) cardRefs[index] = el as HTMLElement }"
          class="skill-card tilt-shine reveal-scale"
          :class="`delay-${(index % 6) + 1}`"
        >
          <!-- 背景光晕 -->
          <div class="skill-glow-bg"></div>

          <!-- 环形进度 SVG -->
          <div class="skill-ring">
            <svg viewBox="0 0 100 100">
              <circle
                cx="50" cy="50" :r="RING_RADIUS"
                fill="none" stroke="rgba(0,0,0,0.05)" stroke-width="5"
              />
              <circle
                class="ring-progress"
                cx="50" cy="50" :r="RING_RADIUS"
                fill="none" stroke="var(--color-accent)" stroke-width="5"
                stroke-linecap="round"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="getStrokeDashoffset(skill.percent)"
                transform="rotate(-90 50 50)"
              />
              <!-- 发光重影 -->
              <circle
                class="ring-glow"
                cx="50" cy="50" :r="RING_RADIUS"
                fill="none" stroke="var(--color-accent)" stroke-width="8"
                stroke-linecap="round"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="getStrokeDashoffset(skill.percent)"
                transform="rotate(-90 50 50)"
                filter="blur(6px)"
                opacity="0"
              />
            </svg>
            <span class="ring-icon">{{ skill.icon }}</span>
          </div>

          <div class="skill-info">
            <span class="skill-name">{{ skill.name }}</span>
            <span class="skill-percent">{{ skill.percent }}%</span>
          </div>

          <!-- 发光标签 -->
          <div class="skill-glow-tag">
            <span>{{ getLevel(skill.percent) }}</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.skills-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

.skill-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  padding: 2rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
  overflow: hidden;
  cursor: default;
  transition: border-color 0.3s, box-shadow 0.3s;
}

/* 顶部光晕背景 */
.skill-glow-bg {
  position: absolute;
  top: -40%;
  left: 50%;
  transform: translateX(-50%);
  width: 120%;
  height: 80%;
  background: radial-gradient(
    ellipse at center,
    var(--color-accent-glow) 0%,
    transparent 70%
  );
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
  z-index: 0;
}

.skill-card:hover .skill-glow-bg {
  opacity: 1;
}

.skill-card:hover {
  border-color: rgba(124, 140, 110, 0.35);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.08),
    0 0 40px var(--color-accent-glow);
}

/* 环形进度 */
.skill-ring {
  position: relative;
  width: 90px;
  height: 90px;
  z-index: 1;
}

.skill-ring svg { width: 100%; height: 100%; }

.ring-progress {
  transition: stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1);
}

.ring-glow {
  transition: opacity 0.4s;
}

.skill-card:hover .ring-glow {
  opacity: 0.4;
}

/* 进度条在滚入视口前隐藏 */
.reveal-scale:not(.revealed) .ring-progress,
.reveal-scale:not(.revealed) .ring-glow {
  stroke-dashoffset: 263.89 !important;
}

.ring-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  transition: transform 0.3s var(--ease-spring);
}

.skill-card:hover .ring-icon {
  transform: translate(-50%, -50%) scale(1.2);
}

/* 技能信息 */
.skill-info {
  text-align: center;
  z-index: 1;
}

.skill-name {
  display: block;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text);
  margin-bottom: 2px;
}

.skill-percent {
  font-family: 'Courier New', monospace;
  font-size: 0.85rem;
  color: var(--color-accent);
  font-weight: 600;
}

/* 发光标签 (Uiverse.io 风格) */
.skill-glow-tag {
  position: absolute;
  bottom: -100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 6px 16px;
  background: var(--color-accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: var(--radius-full);
  white-space: nowrap;
  transition: all 0.4s var(--ease-spring);
  box-shadow: 0 4px 16px var(--color-accent-glow-strong);
  letter-spacing: 0.05em;
  z-index: 2;
}

.skill-card:hover .skill-glow-tag {
  bottom: 12px;
}

/* 响应式 */
@media (max-width: 1024px) {
  .skills-grid { grid-template-columns: repeat(3, 1fr); }
}

@media (max-width: 768px) {
  .skills-grid { grid-template-columns: repeat(2, 1fr); gap: 1rem; }
  .skill-card { padding: 1.5rem 1rem; }
  .skill-ring { width: 75px; height: 75px; }
}

@media (max-width: 480px) {
  .skills-grid { grid-template-columns: 1fr 1fr; }
}
</style>
