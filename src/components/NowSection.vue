<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useTilt } from '@/composables/useTilt'
import { useLiveStatus } from '@/composables/useLiveStatus'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const sectionRef = ref<HTMLElement | null>(null)
const cardRefs = ref<HTMLElement[]>([])
const { observeAll } = useScrollReveal()
const { bind: bindTilt } = useTilt({ max: 6, scale: 1.02, speed: 400 })
const { timeStr, dateStr, city, weather, temp, currentActivity, activityIcon, isWorkingHour, isAutoLocated } = useLiveStatus()
const { isPlaying: isAudioPlaying, selectTrack, togglePlay: toggleAudioPlay, setExpand } = useAudioPlayer()

function handleMusicCardClick() {
  if (!isAudioPlaying.value) {
    selectTrack(0, true)
  } else {
    setExpand(true)
  }
}

function handlePlayBtnClick(e: Event) {
  e.stopPropagation()
  if (!isAudioPlaying.value) {
    selectTrack(0, true)
  } else {
    toggleAudioPlay()
  }
}

function handleExpandPlayerClick(e: Event) {
  e.stopPropagation()
  setExpand(true)
}

interface TimelineItem {
  date: string
  tag: string
  title: string
  detail: string
  highlight?: string
}

const changelog: TimelineItem[] = [
  {
    date: '2026.09',
    tag: '造物',
    title: '个人主页上线 GitHub Pages',
    detail: '重构了全站动效系统与 3D 景深交互，融入大地色系与自制 Canvas 粒子。',
    highlight: 'Vue 3 + TypeScript 严格工程化落地',
  },
  {
    date: '2026.08',
    tag: '实验',
    title: '探索 Web Audio API 声学水纹',
    detail: '调用实时傅里叶频域变换，将声音涟漪化为动态水波，完成「清泉流响」原型。',
    highlight: '频域 FFT 实时可视化管线',
  },
  {
    date: '2026.07',
    tag: '构思',
    title: '启动「知行笔记」本地优先架构',
    detail: '调研 CRDT 与客户端 IndexedDB 瞬时存储，解决现代笔记软件臃肿延迟痛点。',
    highlight: 'Local-First 本地优先数据同步',
  },
  {
    date: '2026.05',
    tag: '沉淀',
    title: '归整全套 TypeScript 严格工程规范',
    detail: '梳理通用 Composable 状态库与设计系统组件，提升全栈模块复用率。',
    highlight: '单例状态模式与严格类型安全',
  },
]

const expandedTimelineIdx = ref<number | null>(0)

function toggleTimeline(idx: number) {
  expandedTimelineIdx.value = expandedTimelineIdx.value === idx ? null : idx
}

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
        <h2 class="section-title">此时此刻</h2>
        <p class="section-subtitle">
          记录当下的状态、最近在读的书、循环的音乐与近期的折腾记录
        </p>
      </div>

      <!-- 实时控制台 -->
      <div class="live-console-card tile-card tilt-shine reveal">
        <div class="console-grid">
          <!-- 当地时间 -->
          <div class="console-block">
            <span class="console-label">当地时间</span>
            <div class="console-time-wrap">
              <span class="console-time">{{ timeStr || '15:28:00' }}</span>
              <span class="console-date">{{ dateStr }}</span>
            </div>
          </div>

          <!-- 地理与气象 -->
          <div class="console-block">
            <div class="console-label-row">
              <span class="console-label">坐标</span>
              <span v-if="isAutoLocated" class="auto-badge" title="已通过网络实时解析位置">实时定位</span>
            </div>
            <div class="console-val-row">
              <span class="geo-pin">📍</span>
              <span class="console-val-main">{{ city }}</span>
              <span class="console-tag">{{ weather }} · {{ temp }}</span>
            </div>
          </div>

          <!-- 当前状态 -->
          <div class="console-block">
            <span class="console-label">当前状态</span>
            <div class="console-val-row">
              <span class="live-status-dot" :class="{ working: isWorkingHour }"></span>
              <span class="console-val-main">{{ currentActivity }}</span>
              <span class="activity-emoji">{{ activityIcon }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 四大近况卡片 -->
      <div class="now-grid">
        <!-- 1. 在读书籍 -->
        <div
          :ref="(el) => { if (el) cardRefs[0] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-1"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">📖</span>
              <span>在读书籍</span>
            </div>
            <span class="book-edition-tag">原研哉 · 著</span>
          </div>
          <h3 class="now-card-title">《设计中的设计》</h3>
          <p class="now-card-author">日本平面设计大师与无印良品艺术总监理念集</p>
          <div class="book-progress-bar">
            <div class="progress-fill" style="width: 74%"></div>
          </div>
          <p class="now-card-quote">
            “白并不是一种颜色，而是一种感觉的容纳。把多余的视觉噪音去掉，信息本身才能发出清晰的声音。”
          </p>
        </div>

        <!-- 2. 本周单曲循环 -->
        <div
          :ref="(el) => { if (el) cardRefs[1] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-2 interactive-music-card"
          role="button"
          tabindex="0"
          aria-label="试听坂本龙一 andata 或展开声学唱机"
          @click="handleMusicCardClick"
          @keydown.enter="handleMusicCardClick"
          @keydown.space.prevent="handleMusicCardClick"
          title="点击试听 / 展开声学唱机"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">{{ isAudioPlaying ? '🎵' : '🎧' }}</span>
              <span>{{ isAudioPlaying ? '正在播放' : '单曲循环' }}</span>
            </div>
            <div class="audio-waves" :class="{ playing: isAudioPlaying }">
              <span class="wave-bar w-1"></span>
              <span class="wave-bar w-2"></span>
              <span class="wave-bar w-3"></span>
              <span class="wave-bar w-4"></span>
              <span class="wave-bar w-5"></span>
            </div>
          </div>

          <!-- 唱盘微展台 -->
          <div class="vinyl-mini-stage">
            <div class="mini-vinyl-disc" :class="{ spinning: isAudioPlaying }">
              <div class="mini-vinyl-grooves"></div>
              <div class="mini-vinyl-center">
                <span class="vinyl-center-dot"></span>
              </div>
            </div>
            <div class="vinyl-meta-info">
              <h3 class="now-card-title">andata</h3>
              <p class="now-card-author">坂本龙一 · 《async》 / Ambient</p>
              <div class="mini-vinyl-actions">
                <button
                  class="mini-vinyl-btn primary"
                  @click.stop="handlePlayBtnClick"
                  :aria-label="isAudioPlaying ? '暂停' : '播放'"
                >
                  <span>{{ isAudioPlaying ? '❚❚ 暂停' : '▶ 试听' }}</span>
                </button>
                <button
                  class="mini-vinyl-btn secondary"
                  @click.stop="handleExpandPlayerClick"
                  aria-label="展开完整播放器"
                >
                  <span>展开播放器 ↗</span>
                </button>
              </div>
            </div>
          </div>

          <p class="now-card-desc">
            写代码时很喜欢的背景音乐。钢琴与环境采样交织，克制又深邃，适合让人静下心来进入专注状态。
          </p>
        </div>

        <!-- 3. 技术试验田 -->
        <div
          :ref="(el) => { if (el) cardRefs[2] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-3"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">⚡</span>
              <span>正在探索</span>
            </div>
          </div>
          <h3 class="now-card-title">本地优先与音频实验</h3>
          <p class="now-card-author">Web Audio · Local-First · Canvas Shaders</p>
          <p class="now-card-desc">
            研究利用 Web Audio API 实时合成声音波形反馈，结合 CRDT 和客户端 IndexedDB 尝试无依赖断网可用的笔记架构。
          </p>
        </div>

        <!-- 4. 日常生活感受 -->
        <div
          :ref="(el) => { if (el) cardRefs[3] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-4"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">🌿</span>
              <span>生活随想</span>
            </div>
          </div>
          <h3 class="now-card-title">西湖边的夜走与宣纸微粒</h3>
          <p class="now-card-author">杭州 · 漫游随笔</p>
          <p class="now-card-desc">
            偶尔在北山街和断桥附近散步吹晚风。也很喜欢手工粗纹纸吸墨的纹理，与屏幕前冷硬的像素有种奇妙的互补感。
          </p>
        </div>
      </div>

      <!-- 近期足迹 -->
      <div class="timeline-wrap tile-card reveal">
        <div class="timeline-header">
          <h3 class="timeline-title">近期足迹</h3>
          <span class="timeline-sub">记录每一步探索的痕迹（点击展开详情）</span>
        </div>

        <div class="timeline-list">
          <div
            v-for="(item, idx) in changelog"
            :key="idx"
            class="timeline-item"
            :class="{ expanded: expandedTimelineIdx === idx }"
            @click="toggleTimeline(idx)"
            role="button"
            tabindex="0"
            @keydown.enter="toggleTimeline(idx)"
            @keydown.space.prevent="toggleTimeline(idx)"
          >
            <div class="timeline-point">
              <span class="point-core"></span>
            </div>
            <div class="timeline-content">
              <div class="item-meta">
                <span class="item-date">{{ item.date }}</span>
                <span class="item-tag">{{ item.tag }}</span>
                <span v-if="item.highlight" class="item-highlight-tag">{{ item.highlight }}</span>
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
  background: transparent;
  position: relative;
}

/* 实时控制台 */
.live-console-card {
  padding: 2.2rem 2.8rem;
  margin-bottom: 3.5rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--tile-shadow);
  position: relative;
  overflow: hidden;
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
  gap: 8px;
}

.console-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-accent);
  letter-spacing: 0.04em;
}

.console-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border: 1px solid rgba(91, 140, 110, 0.2);
  font-weight: 500;
}

.console-time-wrap {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.console-time {
  font-family: var(--font-mono);
  font-size: 2.2rem;
  font-weight: 700;
  color: var(--color-ink);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.console-date {
  font-size: 0.88rem;
  color: var(--color-text-lighter);
}

.console-val-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.geo-pin {
  font-size: 1rem;
}

.console-val-main {
  font-family: var(--font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-ink);
}

.console-tag {
  font-size: 0.82rem;
  padding: 4px 12px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-light);
}

.live-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 0 0 rgba(91, 140, 110, 0.5);
  animation: pulse-ring-green 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

.live-status-dot.working {
  background: var(--color-amber);
  box-shadow: 0 0 0 0 rgba(200, 148, 74, 0.5);
  animation: pulse-ring-amber 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

@keyframes pulse-ring-green {
  0% { box-shadow: 0 0 0 0 rgba(91, 140, 110, 0.5); }
  70% { box-shadow: 0 0 0 8px rgba(91, 140, 110, 0); }
  100% { box-shadow: 0 0 0 0 rgba(91, 140, 110, 0); }
}

@keyframes pulse-ring-amber {
  0% { box-shadow: 0 0 0 0 rgba(200, 148, 74, 0.5); }
  70% { box-shadow: 0 0 0 8px rgba(200, 148, 74, 0); }
  100% { box-shadow: 0 0 0 0 rgba(200, 148, 74, 0); }
}

.activity-emoji {
  font-size: 1.15rem;
}

/* 四大近况卡片 */
.now-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.8rem;
  margin-bottom: 3.5rem;
}

.now-card {
  padding: 2.2rem;
  display: flex;
  flex-direction: column;
  position: relative;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--tile-shadow);
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease), box-shadow 0.35s var(--ease);
}

.now-card:hover {
  transform: translateY(-3px);
  border-color: rgba(91, 140, 110, 0.3);
  box-shadow: var(--tile-shadow-hover);
}

.now-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
}

.tile-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  background: var(--color-accent-soft);
  border: 1px solid rgba(91, 140, 110, 0.18);
  border-radius: var(--radius-full);
  color: var(--color-accent);
  font-size: 0.8rem;
  font-weight: 500;
}

.now-card-icon {
  font-size: 1rem;
}

.book-edition-tag {
  font-size: 0.8rem;
  color: var(--color-text-lighter);
}

.now-card-title {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-ink);
  margin-bottom: 0.35rem;
  transition: color var(--transition);
}

.now-card:hover .now-card-title {
  color: var(--color-accent);
}

.now-card-author {
  font-size: 0.86rem;
  color: var(--color-text-lighter);
  margin-bottom: 1.1rem;
}

.book-progress-bar {
  width: 100%;
  height: 6px;
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
  font-size: 0.94rem;
  line-height: 1.85;
  color: var(--color-text-light);
  padding-left: 14px;
  border-left: 2px solid var(--color-accent);
  font-style: italic;
}

.now-card-desc {
  font-size: 0.94rem;
  line-height: 1.8;
  color: var(--color-text-light);
  font-weight: 400;
}

/* 唱盘微展台 */
.vinyl-mini-stage {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 1.1rem 0;
  padding: 14px 16px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}

.mini-vinyl-disc {
  width: 64px;
  height: 64px;
  min-width: 64px;
  border-radius: 50%;
  background: radial-gradient(circle, #383A38 0%, #252826 55%, #181A18 100%);
  position: relative;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.15);
}

.mini-vinyl-disc.spinning {
  animation: vinyl-spin 6s linear infinite;
}

@keyframes vinyl-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.mini-vinyl-grooves {
  position: absolute;
  inset: 6px;
  border-radius: 50%;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  pointer-events: none;
}

.mini-vinyl-center {
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: var(--color-amber);
  display: flex;
  align-items: center;
  justify-content: center;
}

.vinyl-center-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #181A18;
}

.vinyl-meta-info {
  flex: 1;
  min-width: 0;
}

.vinyl-meta-info .now-card-title {
  margin-bottom: 2px;
  font-size: 1.15rem;
}

.vinyl-meta-info .now-card-author {
  margin-bottom: 8px;
  font-size: 0.8rem;
}

.mini-vinyl-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.mini-vinyl-btn {
  padding: 6px 14px;
  font-size: 0.78rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  transition: all 0.25s var(--ease);
}

.mini-vinyl-btn.primary {
  background: var(--color-accent);
  color: #FFFFFF;
  border: none;
}

.mini-vinyl-btn.primary:hover {
  background: var(--color-accent-dark);
  transform: translateY(-1px);
}

.mini-vinyl-btn.secondary {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.mini-vinyl-btn.secondary:hover {
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

/* 音频波形 */
.audio-waves {
  display: flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 14px;
}

.wave-bar {
  width: 2px;
  background: var(--color-accent);
  border-radius: 1px;
  height: 4px;
  transition: height 0.3s var(--ease);
}

.audio-waves.playing .wave-bar {
  animation: wave-jump 1s ease-in-out infinite alternate;
}

.w-1 { height: 5px; animation-delay: 0.1s; }
.w-2 { height: 12px; animation-delay: 0.3s; }
.w-3 { height: 8px; animation-delay: 0.2s; }
.w-4 { height: 14px; animation-delay: 0.4s; }
.w-5 { height: 9px; animation-delay: 0.15s; }

@keyframes wave-jump {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

.interactive-music-card {
  cursor: pointer;
}

.interactive-music-card:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

/* 近期足迹 */
.timeline-wrap {
  padding: 2.8rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--tile-shadow);
}

.timeline-header {
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid var(--color-border);
}

.timeline-title {
  font-family: var(--font-serif);
  font-size: 1.45rem;
  font-weight: 700;
  color: var(--color-ink);
  margin-bottom: 4px;
}

.timeline-sub {
  font-size: 0.86rem;
  color: var(--color-text-lighter);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  position: relative;
  padding-left: 1.8rem;
}

.timeline-list::before {
  content: '';
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 6px;
  width: 2px;
  background: var(--color-border);
}

.timeline-item {
  position: relative;
  padding: 14px 18px;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition: transform 0.25s var(--ease), background-color 0.25s var(--ease), border-color 0.25s var(--ease);
}

.timeline-item:hover {
  transform: translateX(4px);
  background: var(--color-bg-alt);
}

.timeline-item.expanded {
  background: var(--color-bg-alt);
  border-color: rgba(91, 140, 110, 0.2);
}

.timeline-point {
  position: absolute;
  left: -1.8rem;
  top: 20px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #FFFFFF;
  border: 2px solid var(--color-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--ease-spring), border-color 0.25s var(--ease-spring);
}

.timeline-item:hover .timeline-point,
.timeline-item.expanded .timeline-point {
  transform: scale(1.25);
  border-color: var(--color-accent-dark);
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
  margin-bottom: 6px;
  flex-wrap: wrap;
}

.item-date {
  font-family: var(--font-mono);
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--color-amber);
}

.item-tag {
  font-size: 0.74rem;
  padding: 2px 10px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-text-lighter);
}

.item-highlight-tag {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  padding: 2px 10px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-radius: var(--radius-full);
  border: 1px solid rgba(91, 140, 110, 0.18);
}

.item-title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-ink);
  margin-bottom: 6px;
  transition: color var(--transition);
}

.timeline-item:hover .item-title,
.timeline-item.expanded .item-title {
  color: var(--color-accent);
}

.item-detail {
  font-size: 0.92rem;
  line-height: 1.75;
  color: var(--color-text-light);
  font-weight: 400;
}

@media (max-width: 900px) {
  .console-grid { grid-template-columns: 1fr; gap: 1.8rem; }
  .now-grid { grid-template-columns: 1fr; }
  .live-console-card { padding: 2rem 1.6rem; }
  .now-card { padding: 2rem 1.6rem; }
  .timeline-wrap { padding: 2rem 1.6rem; }
  .vinyl-mini-stage { flex-direction: column; align-items: flex-start; }
}
</style>
