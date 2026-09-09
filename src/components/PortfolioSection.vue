<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'
import BaseModal from '@/components/BaseModal.vue'

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
  details: string
  highlights: string[]
}

const projects: Project[] = [
  {
    id: 1, title: '山水画廊', emoji: '🏔️',
    desc: '中国山水画数字艺术平台，沉浸式浏览传统与现代的融合之作。',
    tags: ['Vue.js', 'Canvas', '艺术'],
    color: 'linear-gradient(135deg, #7C8C6E, #9AAB8B)',
    details: '将中国传统山水画艺术搬到数字世界，通过 Canvas WebGL 实现高清缩放、虚拟画卷滚动和沉浸式鉴赏体验。支持按朝代、风格、画家分类浏览。',
    highlights: ['Canvas WebGL 高清渲染', '虚拟画卷无限滚动', '按朝代/风格智能分类'],
  },
  {
    id: 2, title: '知行笔记', emoji: '📝',
    desc: '极简主义效率笔记应用，让思考回归纯粹，用最少的操作记录最重要的想法。',
    tags: ['TypeScript', 'IndexedDB'],
    color: 'linear-gradient(135deg, #C4A882, #D4C4A8)',
    details: '本地优先架构的现代笔记应用，使用 IndexedDB 实现毫秒级本地存储，CRDT 算法保障多设备同步。极简的编辑界面让思维不被工具打断。',
    highlights: ['IndexedDB 本地优先存储', 'CRDT 冲突自动合并', 'Markdown 实时双栏预览'],
  },
  {
    id: 3, title: '四季食谱', emoji: '🍃',
    desc: '根据时令食材推荐应季食谱，跟随自然的节奏享受美食。',
    tags: ['React', 'Node.js', 'API'],
    color: 'linear-gradient(135deg, #8B9D83, #A3B596)',
    details: '融合二十四节气与现代营养学的智能食谱平台。根据当季时令推荐最新鲜的食材搭配，同时提供卡路里分析和膳食平衡建议。',
    highlights: ['二十四节气食材图谱', '智能营养分析引擎', 'React + Node.js 全栈'],
  },
  {
    id: 4, title: '微风天气', emoji: '🌤️',
    desc: '简约优雅的天气预报应用，以视觉化的方式呈现气象数据之美。',
    tags: ['Vue.js', '动画', 'API'],
    color: 'linear-gradient(135deg, #9AAFB2, #B5C7C9)',
    details: '用数据可视化让天气变得可感知。动态背景随天气状态变化，每种天气都有独特的粒子动画效果。72 小时逐时预报 + 7 天趋势图。',
    highlights: ['天气粒子动效系统', '动态渐变背景适配', 'Open-Meteo API 集成'],
  },
  {
    id: 5, title: '竹林博客', emoji: '🎋',
    desc: '自然风格的个人博客系统，在竹林间书写技术与生活的感悟。',
    tags: ['Nuxt.js', 'Markdown'],
    color: 'linear-gradient(135deg, #6B7F5E, #8A9F7C)',
    details: '基于 Nuxt.js 的 SSG 博客系统，支持 MDX 增强 Markdown 写作。自研阅读进度指示器、代码块主题切换和目录导航。',
    highlights: ['Nuxt.js SSG 静态生成', 'MDX 交互式文章', '自研目录树与阅读进度'],
  },
  {
    id: 6, title: '清泉音乐', emoji: '🎵',
    desc: '沉浸式音乐播放体验，以流水般的界面让音乐自然流淌。',
    tags: ['Web Audio', 'Canvas'],
    color: 'linear-gradient(135deg, #A89278, #C4AD93)',
    details: '使用 Web Audio API 实现实时频谱分析与声音可视化，结合 Canvas 绘制动态水波纹音频频谱。支持本地文件播放和在线流媒体。',
    highlights: ['Web Audio 实时频谱', 'Canvas 水波纹可视化', '傅里叶变换声学分析'],
  },
]

const selectedProject = ref<Project | null>(null)
const modalOpen = ref(false)

function openProject(project: Project) {
  selectedProject.value = project
  modalOpen.value = true
}

function closeModal() {
  modalOpen.value = false
}

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
          @click="openProject(project)"
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

  <!-- 项目详情弹窗 -->
  <BaseModal :open="modalOpen" @close="closeModal">
    <div v-if="selectedProject" class="project-detail">
      <div class="detail-header" :style="{ background: selectedProject.color }">
        <span class="detail-emoji">{{ selectedProject.emoji }}</span>
      </div>
      <div class="detail-body">
        <h2 class="detail-title">{{ selectedProject.title }}</h2>
        <div class="detail-tags">
          <span v-for="tag in selectedProject.tags" :key="tag" class="detail-tag">{{ tag }}</span>
        </div>
        <p class="detail-desc">{{ selectedProject.details }}</p>
        <div class="detail-highlights">
          <h4 class="highlights-label">技术亮点</h4>
          <ul class="highlights-list">
            <li v-for="h in selectedProject.highlights" :key="h">{{ h }}</li>
          </ul>
        </div>
      </div>
    </div>
  </BaseModal>
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

/* 悬浮遮罩 — 减淡透明度 */
.card-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 1.5rem;
  background: linear-gradient(to top, rgba(30, 30, 30, 0.55) 0%, transparent 60%);
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
  padding: 10px 24px;
  font-size: 0.9rem;
  color: white;
  background: rgba(124, 140, 110, 0.65);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: var(--radius-full);
  transform: translateY(12px);
  transition: all 0.4s var(--ease-spring);
  letter-spacing: 0.05em;
}

.portfolio-card:hover .card-view-btn {
  transform: translateY(0);
}

.card-view-btn:hover {
  background: var(--color-accent);
  border-color: var(--color-accent-light);
  box-shadow: 0 4px 20px rgba(124, 140, 110, 0.4);
}

/* 模态框内容 */
.project-detail {
  overflow: hidden;
}

.detail-header {
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.detail-emoji {
  font-size: 3.5rem;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
}

.detail-body {
  padding: 2rem 2.5rem 2.5rem;
}

.detail-title {
  font-family: var(--font-serif);
  font-size: 1.8rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 1rem;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 1.5rem;
}

.detail-tag {
  padding: 4px 14px;
  font-size: 0.8rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  border-radius: var(--radius-full);
  font-weight: 500;
}

.detail-desc {
  font-size: 1rem;
  line-height: 1.9;
  color: var(--color-text-light);
  margin-bottom: 2rem;
  font-weight: 300;
}

.highlights-label {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.8rem;
}

.highlights-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.highlights-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 0.95rem;
  color: var(--color-text-light);
  font-weight: 300;
}

.highlights-list li::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  flex-shrink: 0;
}

/* 响应式 */
@media (max-width: 1024px) {
  .portfolio-grid { grid-template-columns: repeat(2, 1fr); }
}

@media (max-width: 600px) {
  .portfolio-grid { grid-template-columns: 1fr; }
  .card-header { height: 110px; }
  .detail-body { padding: 1.5rem; }
  .detail-header { height: 120px; }
}
</style>
