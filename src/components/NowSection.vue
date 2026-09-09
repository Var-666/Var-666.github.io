<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'
import { useLiveStatus } from '@/composables/useLiveStatus'

const sectionRef = ref<HTMLElement | null>(null)
const cardRefs = ref<HTMLElement[]>([])
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 6, scale: 1.02, speed: 400 })
const { timeStr, dateStr, city, weather, temp, currentActivity, activityIcon, isWorkingHour, isAutoLocated } = useLiveStatus()

interface TimelineItem {
  date: string
  tag: string
  title: string
  detail: string
}

const changelog: TimelineItem[] = [
  {
    date: '2026.09',
    tag: '造物',
    title: '个人主页上线 GitHub Pages',
    detail: '重构了全站动效系统与 3D 景深交互，融入大地色系与自制 Canvas 粒子。',
  },
  {
    date: '2026.08',
    tag: '实验',
    title: '探索 Web Audio API 声学水纹',
    detail: '调用实时傅里叶频域变换，将声音涟漪化为动态水波，完成「清泉流响」原型。',
  },
  {
    date: '2026.07',
    tag: '构思',
    title: '启动「知行笔记」本地优先架构',
    detail: '调研 CRDT 与客户端 IndexedDB 瞬时存储，解决现代笔记软件臃肿延迟痛点。',
  },
  {
    date: '2026.05',
    tag: '沉淀',
    title: '归整全套 TypeScript 严格工程规范',
    detail: '梳理通用 Composable 状态库与设计系统组件，提升全栈模块复用率。',
  },
]

const cardAccents = [
  'var(--color-accent)',
  'var(--color-warm)',
  'rgba(154, 171, 139, 0.7)',
  'var(--color-accent-light)',
]

onMounted(async () => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-left, .reveal-right, .reveal-scale', sectionRef.value)
  }

  await nextTick()

  cardRefs.value.forEach((el) => {
    if (el) bindTilt(el)
  })
})
</script>

<template>
  <section id="now" class="section section-now" ref="sectionRef">
    <div class="container">
      <!-- 标题 -->
      <div class="section-header reveal">
        <span class="section-index">( 02 ) 此时此刻 · NOW</span>
        <h2 class="section-title">活在当下的呼吸感</h2>
        <p class="section-subtitle">
          受 Derek Sivers 的 /now 理念启发 · 记录我当前的实时状态与近况足迹
        </p>
      </div>

      <!-- 实时生命体征控制台 (Live Status Console) -->
      <div class="live-console-card glass-card tilt-shine reveal">
        <div class="console-grid">
          <!-- 实时时间与时区 -->
          <div class="console-block">
            <span class="console-label">当地时间 ( LOCAL )</span>
            <div class="console-time-wrap">
              <span class="console-time">{{ timeStr || '15:28:00' }}</span>
              <span class="console-date">{{ dateStr }}</span>
            </div>
          </div>

          <!-- 地理与气象 -->
          <div class="console-block">
            <div class="console-label-row">
              <span class="console-label">身处之所 ( LOCATION )</span>
              <span v-if="isAutoLocated" class="auto-badge" title="已通过真实 IP 与气象 API 实时解析">实时定位</span>
            </div>
            <div class="console-val-row">
              <span class="geo-pin">📍</span>
              <span class="console-val-main">{{ city }}</span>
              <span class="console-tag">{{ weather }} · {{ temp }}</span>
            </div>
          </div>

          <!-- 当前在线状态 -->
          <div class="console-block">
            <span class="console-label">当前活跃状态 ( STATUS )</span>
            <div class="console-val-row">
              <span class="live-status-dot" :class="{ working: isWorkingHour }"></span>
              <span class="console-val-main">{{ currentActivity }}</span>
              <span class="activity-emoji">{{ activityIcon }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 四大近况视窗 (Four Focus Windows) -->
      <div class="now-grid">
        <!-- 1. 在读书目 -->
        <div
          :ref="(el) => { if (el) cardRefs[0] = el as HTMLElement }"
          class="now-card glass-card tilt-shine reveal-scale delay-1"
        >
          <div class="now-card-accent" :style="{ background: cardAccents[0] }"></div>
          <div class="now-card-top">
            <span class="now-card-icon">📖</span>
            <span class="now-card-tag">正在阅读</span>
          </div>
          <h3 class="now-card-title">《设计中的设计》</h3>
          <p class="now-card-author">原研哉 · 著</p>
          <div class="book-progress-bar">
            <div class="progress-fill" style="width: 74%"></div>
          </div>
          <p class="now-card-quote">
            "白并不是一种颜色，而是一种感觉的容纳。把多余的视觉噪音去掉，信息本身才能发出清晰的声音。"
          </p>
        </div>

        <!-- 2. 本周单曲循环 -->
        <div
          :ref="(el) => { if (el) cardRefs[1] = el as HTMLElement }"
          class="now-card glass-card tilt-shine reveal-scale delay-2"
        >
          <div class="now-card-accent" :style="{ background: cardAccents[1] }"></div>
          <div class="now-card-top">
            <span class="now-card-icon">🎧</span>
            <span class="now-card-tag">本周单曲循环</span>
            <div class="audio-waves">
              <span class="wave-bar w-1"></span>
              <span class="wave-bar w-2"></span>
              <span class="wave-bar w-3"></span>
              <span class="wave-bar w-4"></span>
            </div>
          </div>
          <h3 class="now-card-title">andata</h3>
          <p class="now-card-author">坂本龙一 · 《async》 / Ambient 纯音</p>
          <p class="now-card-desc">
            写代码时最喜欢的背景律动。钢琴与环境噪音交织，平静、专注而深邃，能让人迅速进入无杂质的心流状态。
          </p>
        </div>

        <!-- 3. 技术试验田 -->
        <div
          :ref="(el) => { if (el) cardRefs[2] = el as HTMLElement }"
          class="now-card glass-card tilt-shine reveal-scale delay-3"
        >
          <div class="now-card-accent" :style="{ background: cardAccents[2] }"></div>
          <div class="now-card-top">
            <span class="now-card-icon">🔬</span>
            <span class="now-card-tag">技术试验田</span>
          </div>
          <h3 class="now-card-title">本地优先与声学合成</h3>
          <p class="now-card-author">Web Audio · Local-First · Canvas</p>
          <p class="now-card-desc">
            最近在深入琢磨如何用 Web Audio API 做轻量声学交互，以及用 IndexedDB 让 Web 应用在离线状态下也有原生客户端般的毫秒级响应。
          </p>
        </div>

        <!-- 4. 日常生活感受 -->
        <div
          :ref="(el) => { if (el) cardRefs[3] = el as HTMLElement }"
          class="now-card glass-card tilt-shine reveal-scale delay-4"
        >
          <div class="now-card-accent" :style="{ background: cardAccents[3] }"></div>
          <div class="now-card-top">
            <span class="now-card-icon">🌿</span>
            <span class="now-card-tag">生活琐事</span>
          </div>
          <h3 class="now-card-title">西湖边的秋风与旧纸</h3>
          <p class="now-card-author">杭州 · 日常漫步</p>
          <p class="now-card-desc">
            适逢初秋，周末喜欢在北山路和湖边骑行吹风。最近迷上了收集不同触感的手工宣纸与木质铅笔，感受物理介质带来的踏实感。
          </p>
        </div>
      </div>

      <!-- 近期足迹时间流 (Changelog & Activity Stream) -->
      <div class="timeline-wrap glass-card reveal">
        <div class="timeline-header">
          <h3 class="timeline-title">近期足迹与更迭 ( Footprints )</h3>
          <span class="timeline-sub">真实的时间刻度，记录每一步探索</span>
        </div>

        <div class="timeline-list">
          <div
            v-for="(item, idx) in changelog"
            :key="idx"
            class="timeline-item"
          >
            <div class="timeline-point">
              <span class="point-core"></span>
            </div>
            <div class="timeline-content">
              <div class="item-meta">
                <span class="item-date">{{ item.date }}</span>
                <span class="item-tag">{{ item.tag }}</span>
              </div>
              <h4 class="item-title">{{ item.title }}</h4>
              <p class="item-detail">{{ item.detail }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-now {
  background: var(--color-bg-alt);
  position: relative;
}

/* 小标签索引 */
.section-index {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.78rem;
  color: var(--color-accent);
  letter-spacing: 0.1em;
  margin-bottom: 0.8rem;
  opacity: 0.7;
}

/* 实时监控卡片 */
.live-console-card {
  padding: 2.2rem 2.8rem;
  margin-bottom: 3.5rem;
}

.console-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.2fr;
  gap: 2.5rem;
  align-items: center;
}

.console-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.console-label {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.console-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-badge {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 1px 7px;
  border-radius: var(--radius-xs);
  background: rgba(16, 185, 129, 0.1);
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.25);
  font-weight: 500;
}

.console-time-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.console-time {
  font-family: var(--font-mono);
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.02em;
}

.console-date {
  font-size: 0.88rem;
  color: var(--color-text-light);
}

.console-val-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.geo-pin {
  font-size: 1.1rem;
}

.console-val-main {
  font-family: var(--font-serif);
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text);
}

.console-tag {
  font-size: 0.76rem;
  padding: 2px 10px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-full);
  color: var(--color-text-light);
}

.live-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5);
  animation: pulse-ring 2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

.live-status-dot.working {
  background: #059669;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
  70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.activity-emoji {
  font-size: 1.1rem;
}

/* 四大近况卡片 */
.now-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
  margin-bottom: 3.5rem;
}

.now-card {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
}

.now-card:hover {
  border-color: rgba(124, 140, 110, 0.3);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.08),
    0 0 30px var(--color-accent-glow);
}

/* 顶部色调装饰线 */
.now-card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: var(--radius) var(--radius) 0 0;
  opacity: 0.7;
  transition: opacity 0.3s;
}

.now-card:hover .now-card-accent {
  opacity: 1;
}

.now-card-top {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 1rem;
}

.now-card-icon {
  font-size: 1.2rem;
  transition: transform 0.3s var(--ease-spring);
}

.now-card:hover .now-card-icon {
  transform: scale(1.2) rotate(-5deg);
}

.now-card-tag {
  font-size: 0.74rem;
  padding: 2px 8px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: var(--radius-xs);
  font-weight: 500;
}

.now-card-title {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 0.2rem;
  transition: color 0.3s;
}

.now-card:hover .now-card-title {
  color: var(--color-accent-dark);
}

.now-card-author {
  font-size: 0.84rem;
  color: var(--color-text-lighter);
  margin-bottom: 1rem;
}

.book-progress-bar {
  width: 100%;
  height: 4px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-full);
  margin-bottom: 1.2rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  transition: width 1.2s var(--ease);
}

.now-card-quote {
  font-family: var(--font-serif);
  font-size: 0.92rem;
  line-height: 1.85;
  color: var(--color-text-light);
  font-style: italic;
  padding-left: 12px;
  border-left: 2px solid var(--color-warm);
}

.now-card-desc {
  font-size: 0.94rem;
  line-height: 1.9;
  color: var(--color-text-light);
  font-weight: 300;
}

/* 音频波形跳动动画 */
.audio-waves {
  margin-left: auto;
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}

.wave-bar {
  width: 2.5px;
  background: var(--color-accent);
  border-radius: 1px;
  animation: wave-jump 1s ease-in-out infinite alternate;
}

.w-1 { height: 6px; animation-delay: 0.1s; }
.w-2 { height: 14px; animation-delay: 0.3s; }
.w-3 { height: 9px; animation-delay: 0.2s; }
.w-4 { height: 16px; animation-delay: 0.4s; }

@keyframes wave-jump {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

/* 足迹时间流 */
.timeline-wrap {
  padding: 2.5rem;
}

.timeline-header {
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--border-light);
}

.timeline-title {
  font-family: var(--font-serif);
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
}

.timeline-sub {
  font-size: 0.82rem;
  color: var(--color-text-lighter);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
  position: relative;
  padding-left: 1.6rem;
}

.timeline-list::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 5px;
  width: 1.5px;
  background: var(--border-medium);
}

.timeline-item {
  position: relative;
  transition: transform 0.3s var(--ease);
}

.timeline-item:hover {
  transform: translateX(4px);
}

.timeline-point {
  position: absolute;
  left: -1.6rem;
  top: 5px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-bg);
  border: 2px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s var(--ease-spring);
}

.timeline-item:hover .timeline-point {
  border-color: var(--color-accent-light);
  box-shadow: 0 0 0 4px var(--color-accent-glow);
  transform: scale(1.2);
}

.point-core {
  width: 4px;
  height: 4px;
  background: var(--color-accent);
  border-radius: 50%;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.item-date {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-warm);
}

.item-tag {
  font-size: 0.72rem;
  padding: 1px 8px;
  background: var(--color-bg-alt);
  border-radius: var(--radius-xs);
  color: var(--color-text-lighter);
}

.item-title {
  font-family: var(--font-serif);
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 4px;
  transition: color 0.3s;
}

.timeline-item:hover .item-title {
  color: var(--color-accent-dark);
}

.item-detail {
  font-size: 0.88rem;
  line-height: 1.7;
  color: var(--color-text-light);
  font-weight: 300;
}

@media (max-width: 900px) {
  .console-grid { grid-template-columns: 1fr; gap: 1.5rem; }
  .now-grid { grid-template-columns: 1fr; }
  .live-console-card { padding: 1.6rem; }
  .timeline-wrap { padding: 1.6rem; }
}
</style>
