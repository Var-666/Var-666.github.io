<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'

const sectionRef = ref<HTMLElement | null>(null)
const cardRefs = ref<HTMLElement[]>([])
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 12, scale: 1.04, speed: 300 })

interface Project {
  id: number
  title: string
  desc: string
  tags: string[]
  color: string
  emoji: string
}

const projects: Project[] = [
  {
    id: 1, title: '山水画廊', emoji: '🏔️',
    desc: '中国山水画数字艺术平台，沉浸式浏览传统与现代的融合之作。',
    tags: ['Vue.js', 'Canvas', '艺术'],
    color: 'linear-gradient(135deg, #7C8C6E, #9AAB8B)',
  },
  {
    id: 2, title: '知行笔记', emoji: '📝',
    desc: '极简主义效率笔记应用，让思考回归纯粹，用最少的操作记录最重要的想法。',
    tags: ['TypeScript', 'IndexedDB'],
    color: 'linear-gradient(135deg, #C4A882, #D4C4A8)',
  },
  {
    id: 3, title: '四季食谱', emoji: '🍃',
    desc: '根据时令食材推荐应季食谱，跟随自然的节奏享受美食。',
    tags: ['React', 'Node.js', 'API'],
    color: 'linear-gradient(135deg, #8B9D83, #A3B596)',
  },
  {
    id: 4, title: '微风天气', emoji: '🌤️',
    desc: '简约优雅的天气预报应用，以视觉化的方式呈现气象数据之美。',
    tags: ['Vue.js', '动画', 'API'],
    color: 'linear-gradient(135deg, #9AAFB2, #B5C7C9)',
  },
  {
    id: 5, title: '竹林博客', emoji: '🎋',
    desc: '自然风格的个人博客系统，在竹林间书写技术与生活的感悟。',
    tags: ['Nuxt.js', 'Markdown'],
    color: 'linear-gradient(135deg, #6B7F5E, #8A9F7C)',
  },
  {
    id: 6, title: '清泉音乐', emoji: '🎵',
    desc: '沉浸式音乐播放体验，以流水般的界面让音乐自然流淌。',
    tags: ['Web Audio', 'Canvas'],
    color: 'linear-gradient(135deg, #A89278, #C4AD93)',
  },
]

/** 鼠标跟随光晕 + 3D 倾斜共同作用 */
function handleMouseMove(event: MouseEvent) {
  const card = event.currentTarget as HTMLElement
  const rect = card.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  card.style.setProperty('--mouse-x', `${x}px`)
  card.style.setProperty('--mouse-y', `${y}px`)
}

function handleMouseLeave(event: MouseEvent) {
  const card = event.currentTarget as HTMLElement
  card.style.removeProperty('--mouse-x')
  card.style.removeProperty('--mouse-y')
}

onMounted(async () => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-scale', sectionRef.value)
  }

  await nextTick()

  // 为每个卡片绑定 3D 倾斜
  cardRefs.value.forEach((el) => {
    if (el) bindTilt(el)
  })
})
</script>

<template>
  <section id="portfolio" class="section" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">精选作品</h2>
        <p class="section-subtitle">每一件作品都是一次探索</p>
      </div>

      <div class="portfolio-grid">
        <div
          v-for="(project, index) in projects"
          :key="project.id"
          :ref="(el) => { if (el) cardRefs[index] = el as HTMLElement }"
          class="portfolio-card reveal-scale"
          :class="`delay-${(index % 6) + 1}`"
          @mousemove="handleMouseMove"
          @mouseleave="handleMouseLeave"
        >
          <!-- 鼠标跟随光晕 -->
          <div class="card-glow"></div>

          <!-- 光芒扫过效果 -->
          <div class="card-shine"></div>

          <!-- 顶部装饰色带 -->
          <div class="card-header" :style="{ background: project.color }">
            <span class="card-emoji">{{ project.emoji }}</span>
            <div class="card-header-pattern">
              <div class="pattern-line"></div>
              <div class="pattern-line"></div>
              <div class="pattern-line"></div>
            </div>
          </div>

          <!-- 卡片内容 -->
          <div class="card-body">
            <h3 class="card-title">{{ project.title }}</h3>
            <p class="card-desc">{{ project.desc }}</p>
            <div class="card-tags">
              <span v-for="tag in project.tags" :key="tag" class="card-tag">
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 悬浮按钮 -->
          <div class="card-overlay">
            <span class="card-view-btn">
              查看详情
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}

.portfolio-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius);
  overflow: hidden;
  cursor: pointer;
  --mouse-x: 50%;
  --mouse-y: 50%;
}

.portfolio-card:hover {
  border-color: rgba(124, 140, 110, 0.3);
}

/* 鼠标跟随光晕 */
.card-glow {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.4s ease;
  background: radial-gradient(
    350px circle at var(--mouse-x) var(--mouse-y),
    var(--color-accent-glow),
    transparent 65%
  );
  z-index: 1;
  pointer-events: none;
}

.portfolio-card:hover .card-glow {
  opacity: 1;
}

/* 光芒扫过 */
.card-shine {
  position: absolute;
  inset: -30%;
  width: 160%;
  height: 160%;
  background: linear-gradient(
    105deg,
    transparent 40%,
    rgba(255, 255, 255, 0.06) 45%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.06) 55%,
    transparent 60%
  );
  transform: translateX(-100%) rotate(-5deg);
  pointer-events: none;
  z-index: 6;
  opacity: 0;
}

.portfolio-card:hover .card-shine {
  opacity: 1;
  animation: card-shine-sweep 0.8s ease-in-out;
}

@keyframes card-shine-sweep {
  0% { transform: translateX(-100%) rotate(-5deg); }
  100% { transform: translateX(100%) rotate(-5deg); }
}

/* 顶部装饰 */
.card-header {
  height: 140px;
  position: relative;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-emoji {
  font-size: 2.5rem;
  position: relative;
  z-index: 2;
  filter: grayscale(0.2);
  transition: transform 0.4s var(--ease-spring), filter 0.3s;
}

.portfolio-card:hover .card-emoji {
  transform: scale(1.25) rotate(-5deg);
  filter: grayscale(0);
}

.card-header-pattern {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 18px;
  padding: 0 30px;
  opacity: 0.15;
}

.pattern-line {
  height: 1px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: var(--radius-full);
}

.pattern-line:nth-child(1) { width: 60%; }
.pattern-line:nth-child(2) { width: 80%; align-self: flex-end; }
.pattern-line:nth-child(3) { width: 45%; }

/* 卡片主体 */
.card-body {
  padding: 1.5rem;
  position: relative;
  z-index: 2;
}

.card-title {
  font-family: var(--font-serif);
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.75rem;
  transition: color 0.3s;
}

.portfolio-card:hover .card-title {
  color: var(--color-accent-dark);
}

.card-desc {
  font-size: 0.9rem;
  color: var(--color-text-light);
  line-height: 1.7;
  margin-bottom: 1rem;
  font-weight: 300;
}

.card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.card-tag {
  padding: 4px 12px;
  font-size: 0.75rem;
  color: var(--color-accent-dark);
  background: rgba(124, 140, 110, 0.1);
  border: 1px solid rgba(124, 140, 110, 0.2);
  border-radius: var(--radius-full);
  font-weight: 500;
  letter-spacing: 0.03em;
  transition: all 0.3s;
}

.portfolio-card:hover .card-tag {
  background: rgba(124, 140, 110, 0.15);
  border-color: rgba(124, 140, 110, 0.3);
}

/* 悬浮遮罩 */
.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(30, 30, 30, 0.65);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  opacity: 0;
  transition: opacity 0.4s ease;
  z-index: 7;
}

.portfolio-card:hover .card-overlay {
  opacity: 1;
}

.card-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 28px;
  font-size: 0.95rem;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: var(--radius-full);
  transform: translateY(12px);
  transition: all 0.4s var(--ease-spring);
  letter-spacing: 0.05em;
}

.portfolio-card:hover .card-view-btn {
  transform: translateY(0);
}

.card-view-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.5);
  box-shadow: 0 4px 20px rgba(124, 140, 110, 0.3);
}

/* 响应式 */
@media (max-width: 1024px) {
  .portfolio-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .portfolio-grid { grid-template-columns: 1fr; }
  .card-header { height: 110px; }
}
</style>
