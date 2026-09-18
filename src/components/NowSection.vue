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
      <!-- 标题：达利相对论时空仪 -->
      <div class="section-header reveal">
        <div class="surreal-kicker">✦ CONTINUUM // 达利相对论时空仪</div>
        <h2 class="section-title">此时此刻 · 梦境切片</h2>
        <p class="section-subtitle">
          「时间不是均质的机械指针，而是随意识流淌与凝结的梦境切片」—— 记录当前维度的引力读数、专注焦点与世界线跃迁
        </p>
      </div>

      <!-- 实时时空浑天仪控制台 (Celestial Astrolabe & Telemetry) -->
      <div class="live-console-card tile-card tilt-shine surreal-portal-frame reveal">
        <div class="astrolabe-backdrop" aria-hidden="true">
          <div class="orbit-ring ring-1"></div>
          <div class="orbit-ring ring-2"></div>
        </div>
        <div class="console-grid">
          <!-- 维度时间与时区 -->
          <div class="console-block">
            <span class="console-label">✦ 当地天文时间 // LOCAL TIME</span>
            <div class="console-time-wrap">
              <span class="console-time">{{ timeStr || '15:28:00' }}</span>
              <span class="console-date">{{ dateStr }}</span>
            </div>
          </div>

          <!-- 地理与以太气象 -->
          <div class="console-block">
            <div class="console-label-row">
              <span class="console-label">✦ 现实锚点 // DIMENSION</span>
              <span v-if="isAutoLocated" class="auto-badge" title="已通过以太网络实时解析真实座标">以太定位</span>
            </div>
            <div class="console-val-row">
              <span class="geo-pin">🌐</span>
              <span class="console-val-main">{{ city }}</span>
              <span class="console-tag">{{ weather }} · {{ temp }}</span>
            </div>
          </div>

          <!-- 当前存在状态 -->
          <div class="console-block">
            <span class="console-label">✦ 意识同调态 // STATUS</span>
            <div class="console-val-row">
              <span class="live-status-dot" :class="{ working: isWorkingHour }"></span>
              <span class="console-val-main">{{ currentActivity }}</span>
              <span class="activity-emoji">{{ activityIcon }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 四大近况视窗 (Four Surreal Dream Slices) -->
      <div class="now-grid">
        <!-- 1. 在读经卷 -->
        <div
          :ref="(el) => { if (el) cardRefs[0] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-1 surreal-portal-frame"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">📖</span>
              <span>在读经卷</span>
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

        <!-- 2. 本周单曲循环 (反重力天体唱盘视听卡) -->
        <div
          :ref="(el) => { if (el) cardRefs[1] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-2 interactive-music-card surreal-portal-frame"
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
              <span class="now-card-icon">{{ isAudioPlaying ? '🪐' : '🎧' }}</span>
              <span>{{ isAudioPlaying ? '声波共振中' : '天体单曲循环' }}</span>
            </div>
            <div class="audio-waves" :class="{ playing: isAudioPlaying }">
              <span class="wave-bar w-1"></span>
              <span class="wave-bar w-2"></span>
              <span class="wave-bar w-3"></span>
              <span class="wave-bar w-4"></span>
              <span class="wave-bar w-5"></span>
            </div>
          </div>

          <!-- 反重力唱盘微展台 -->
          <div class="vinyl-mini-stage">
            <div class="mini-vinyl-disc" :class="{ spinning: isAudioPlaying }">
              <div class="mini-vinyl-grooves"></div>
              <div class="mini-vinyl-center">
                <span class="vinyl-center-dot"></span>
              </div>
            </div>
            <div class="vinyl-meta-info">
              <h3 class="now-card-title">andata</h3>
              <p class="now-card-author">坂本龙一 · 《async》 / Ambient 纯音</p>
              <div class="mini-vinyl-actions">
                <button
                  class="mini-vinyl-btn primary"
                  @click.stop="handlePlayBtnClick"
                  :aria-label="isAudioPlaying ? '暂停' : '播放'"
                >
                  <span>{{ isAudioPlaying ? '❚❚ 凝固音符' : '▶ 释放声波' }}</span>
                </button>
                <button
                  class="mini-vinyl-btn secondary"
                  @click.stop="handleExpandPlayerClick"
                  aria-label="展开完整声学唱机"
                >
                  <span>展开唱盘 ↗</span>
                </button>
              </div>
            </div>
          </div>

          <p class="now-card-desc">
            写代码时最喜欢的背景律动。钢琴与环境噪音交织，失重、专注而深邃，让人迅速遁入无杂质的心流梦境。
          </p>
        </div>

        <!-- 3. 技术试验田 -->
        <div
          :ref="(el) => { if (el) cardRefs[2] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-3 surreal-portal-frame"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">🔮</span>
              <span>量子炼金所</span>
            </div>
          </div>
          <h3 class="now-card-title">本地优先与声学合成</h3>
          <p class="now-card-author">Web Audio · Local-First · Canvas Shaders</p>
          <p class="now-card-desc">
            深入探索利用 Web Audio API 实时合成通感声学反馈，配合 CRDT 与 IndexedDB 构建无视断网的永恒客户端。
          </p>
        </div>

        <!-- 4. 日常生活感受 -->
        <div
          :ref="(el) => { if (el) cardRefs[3] = el as HTMLElement }"
          class="now-card tile-card tilt-shine reveal-scale delay-4 surreal-portal-frame"
        >
          <div class="now-card-top">
            <div class="tile-chip">
              <span class="now-card-icon">🌙</span>
              <span>现实游荡</span>
            </div>
          </div>
          <h3 class="now-card-title">西湖边的夜气与宣纸微粒</h3>
          <p class="now-card-author">杭州 · 漫游行思</p>
          <p class="now-card-desc">
            深宵常在北山街与断桥孤山独行。迷恋手工粗纹宣纸吸收墨汁的毛细瞬间，与纯数码屏幕的冷光形成奇妙的互质对照。
          </p>
        </div>
      </div>

      <!-- 近期足迹世界线 (Worldline Leaps & Chronicle) -->
      <div class="timeline-wrap tile-card surreal-portal-frame reveal">
        <div class="timeline-header">
          <div class="surreal-kicker">✦ WORLDLINE // 星宿纪事</div>
          <h3 class="timeline-title">世界线跃迁与更迭记录</h3>
          <span class="timeline-sub">真实的时间刻度，记录每一步探索的痕迹（点击查看详情）</span>
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
  border-top: 1px solid rgba(92, 225, 230, 0.12);
  border-bottom: 1px solid rgba(92, 225, 230, 0.12);
}

.surreal-kicker {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  color: var(--color-ether-cyan);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 12px rgba(92, 225, 230, 0.5);
}

/* 实时时空浑天仪控制台 (Celestial Astrolabe & Telemetry) */
.live-console-card {
  padding: 2.4rem 3rem;
  margin-bottom: 3.5rem;
  background: rgba(18, 20, 41, 0.75);
  border: 1px solid rgba(92, 225, 230, 0.22);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  position: relative;
  overflow: hidden;
}

.astrolabe-backdrop {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.orbit-ring {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.ring-1 {
  width: 520px;
  height: 520px;
  right: -140px;
  top: -210px;
  border: 1px dashed rgba(92, 225, 230, 0.16);
  animation: astrolabe-spin 70s linear infinite;
}

.ring-2 {
  width: 320px;
  height: 320px;
  right: -40px;
  top: -110px;
  border: 1px dashed rgba(247, 178, 103, 0.15);
  animation: astrolabe-spin 45s linear infinite reverse;
}

@keyframes astrolabe-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.console-grid {
  display: grid;
  grid-template-columns: 1.2fr 1fr 1.2fr;
  gap: 2.5rem;
  align-items: center;
  position: relative;
  z-index: 2;
}

.console-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.console-label {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--color-ether-cyan);
  letter-spacing: 0.08em;
  text-shadow: 0 0 10px rgba(92, 225, 230, 0.35);
}

.console-label-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.auto-badge {
  font-family: var(--font-mono);
  font-size: 0.68rem;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: rgba(92, 225, 230, 0.12);
  color: var(--color-ether-cyan);
  border: 1px solid rgba(92, 225, 230, 0.35);
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
  color: #FFFFFF;
  text-shadow: 0 0 20px rgba(92, 225, 230, 0.45);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.console-date {
  font-size: 0.88rem;
  color: var(--color-text-muted);
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
  font-family: var(--font-sans);
  font-size: 1.15rem;
  font-weight: 600;
  color: #FFFFFF;
}

.console-tag {
  font-size: 0.8rem;
  padding: 4px 12px;
  background: rgba(10, 11, 22, 0.65);
  border: 1px solid rgba(92, 225, 230, 0.18);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
}

.live-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-ether-cyan);
  box-shadow: 0 0 0 0 rgba(92, 225, 230, 0.6);
  animation: pulse-ring-cyan 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

.live-status-dot.working {
  background: var(--color-solar-gold);
  box-shadow: 0 0 0 0 rgba(247, 178, 103, 0.6);
  animation: pulse-ring-gold 2.2s infinite cubic-bezier(0.4, 0, 0.6, 1);
}

@keyframes pulse-ring-cyan {
  0% { box-shadow: 0 0 0 0 rgba(92, 225, 230, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(92, 225, 230, 0); }
  100% { box-shadow: 0 0 0 0 rgba(92, 225, 230, 0); }
}

@keyframes pulse-ring-gold {
  0% { box-shadow: 0 0 0 0 rgba(247, 178, 103, 0.7); }
  70% { box-shadow: 0 0 0 10px rgba(247, 178, 103, 0); }
  100% { box-shadow: 0 0 0 0 rgba(247, 178, 103, 0); }
}

.activity-emoji {
  font-size: 1.15rem;
}

/* 四大近况视窗 (Four Surreal Dream Slices) */
.now-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.8rem;
  margin-bottom: 3.5rem;
}

.now-card {
  padding: 2.4rem;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.18);
  border-radius: var(--radius);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease), box-shadow 0.35s var(--ease);
}

.now-card:hover {
  transform: translateY(-5px);
  border-color: rgba(92, 225, 230, 0.45);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(92, 225, 230, 0.2);
}

.now-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.3rem;
}

.tile-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  background: rgba(92, 225, 230, 0.1);
  border: 1px solid rgba(92, 225, 230, 0.25);
  border-radius: var(--radius-full);
  color: var(--color-ether-cyan);
  font-size: 0.8rem;
  font-weight: 500;
}

.now-card-icon {
  font-size: 1.05rem;
}

.book-edition-tag {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--color-solar-gold);
}

.now-card-title {
  font-family: var(--font-serif);
  font-size: 1.45rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 0.35rem;
  transition: color var(--transition);
}

.now-card:hover .now-card-title {
  color: var(--color-ether-cyan);
  text-shadow: 0 0 15px rgba(92, 225, 230, 0.4);
}

.now-card-author {
  font-size: 0.86rem;
  color: var(--color-text-muted);
  margin-bottom: 1.1rem;
}

.book-progress-bar {
  width: 100%;
  height: 6px;
  background: rgba(10, 11, 22, 0.7);
  border: 1px solid rgba(92, 225, 230, 0.15);
  border-radius: var(--radius-full);
  margin-bottom: 1.3rem;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #5CE1E6, #D65DB1);
  border-radius: var(--radius-full);
  box-shadow: 0 0 12px rgba(92, 225, 230, 0.5);
  transition: width 1.2s var(--ease);
}

.now-card-quote {
  font-family: var(--font-serif);
  font-size: 0.96rem;
  line-height: 1.85;
  color: rgba(240, 242, 253, 0.9);
  padding-left: 14px;
  border-left: 2px solid var(--color-ether-cyan);
  font-style: italic;
}

.now-card-desc {
  font-size: 0.94rem;
  line-height: 1.8;
  color: var(--color-text-muted);
  font-weight: 400;
}

/* 反重力唱盘微展台 */
.vinyl-mini-stage {
  display: flex;
  align-items: center;
  gap: 18px;
  margin: 1.2rem 0;
  padding: 16px 18px;
  background: rgba(10, 11, 22, 0.65);
  border: 1px solid rgba(92, 225, 230, 0.16);
  border-radius: var(--radius);
}

.mini-vinyl-disc {
  width: 72px;
  height: 72px;
  min-width: 72px;
  border-radius: 50%;
  background: radial-gradient(circle, #25284A 0%, #13152B 55%, #0A0B16 100%);
  position: relative;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7), 0 0 15px rgba(92, 225, 230, 0.25);
  border: 1px solid rgba(92, 225, 230, 0.35);
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
  border: 1px dashed rgba(92, 225, 230, 0.25);
  pointer-events: none;
}

.mini-vinyl-center {
  position: absolute;
  inset: 22px;
  border-radius: 50%;
  background: linear-gradient(135deg, #F7B267, #D65DB1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 10px rgba(247, 178, 103, 0.6);
}

.vinyl-center-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0A0B16;
}

.vinyl-meta-info {
  flex: 1;
  min-width: 0;
}

.vinyl-meta-info .now-card-title {
  margin-bottom: 2px;
  font-size: 1.2rem;
}

.vinyl-meta-info .now-card-author {
  margin-bottom: 10px;
  font-size: 0.8rem;
}

.mini-vinyl-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.mini-vinyl-btn {
  padding: 7px 16px;
  font-size: 0.78rem;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
  transition: all 0.3s var(--ease);
}

.mini-vinyl-btn.primary {
  background: linear-gradient(135deg, #5CE1E6, #35B4BA);
  color: #0A0B16;
  font-weight: 700;
  border: none;
  box-shadow: 0 0 15px rgba(92, 225, 230, 0.4);
}

.mini-vinyl-btn.primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 0 25px rgba(92, 225, 230, 0.7);
}

.mini-vinyl-btn.secondary {
  background: rgba(18, 20, 41, 0.8);
  border: 1px solid rgba(92, 225, 230, 0.25);
  color: var(--color-ether-cyan);
}

.mini-vinyl-btn.secondary:hover {
  background: rgba(92, 225, 230, 0.12);
  border-color: var(--color-ether-cyan);
  color: #FFFFFF;
  transform: translateY(-2px);
}

/* 音频波形跳动动画 */
.audio-waves {
  display: flex;
  align-items: flex-end;
  gap: 3px;
  height: 16px;
}

.wave-bar {
  width: 2.5px;
  background: var(--color-ether-cyan);
  border-radius: 1px;
  height: 5px;
  box-shadow: 0 0 6px rgba(92, 225, 230, 0.7);
  transition: height 0.3s var(--ease), opacity 0.3s var(--ease);
}

.audio-waves.playing .wave-bar {
  animation: wave-jump 1s ease-in-out infinite alternate;
}

.w-1 { height: 6px; animation-delay: 0.1s; }
.w-2 { height: 14px; animation-delay: 0.3s; }
.w-3 { height: 9px; animation-delay: 0.2s; }
.w-4 { height: 16px; animation-delay: 0.4s; }
.w-5 { height: 10px; animation-delay: 0.15s; }

@keyframes wave-jump {
  0% { transform: scaleY(0.3); }
  100% { transform: scaleY(1); }
}

.interactive-music-card {
  cursor: pointer;
}

.interactive-music-card:focus-visible {
  outline: 2px solid var(--color-ether-cyan);
  outline-offset: 3px;
}

.interactive-music-card:hover {
  border-color: var(--color-ether-cyan);
}

/* 世界线跃迁与更迭记录 */
.timeline-wrap {
  padding: 3rem;
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.2);
  border-radius: var(--radius-lg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.timeline-header {
  margin-bottom: 2rem;
  padding-bottom: 1.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.timeline-title {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  font-weight: 700;
  color: #FFFFFF;
  margin-bottom: 4px;
}

.timeline-sub {
  font-size: 0.86rem;
  color: var(--color-text-muted);
}

.timeline-list {
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  position: relative;
  padding-left: 1.8rem;
}

.timeline-list::before {
  content: '';
  position: absolute;
  top: 6px;
  bottom: 6px;
  left: 6px;
  width: 2px;
  background: linear-gradient(to bottom, #5CE1E6, #D65DB1, transparent);
  box-shadow: 0 0 8px rgba(92, 225, 230, 0.4);
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
  transform: translateX(6px);
  background: rgba(10, 11, 22, 0.6);
  border-color: rgba(92, 225, 230, 0.25);
}

.timeline-item.expanded {
  background: rgba(10, 11, 22, 0.75);
  border-color: rgba(92, 225, 230, 0.35);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.timeline-point {
  position: absolute;
  left: -1.8rem;
  top: 20px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #0A0B16;
  border: 2px solid var(--color-ether-cyan);
  box-shadow: 0 0 10px rgba(92, 225, 230, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.25s var(--ease-spring), box-shadow 0.25s var(--ease-spring), border-color 0.25s var(--ease-spring);
}

.timeline-item:hover .timeline-point,
.timeline-item.expanded .timeline-point {
  box-shadow: 0 0 15px var(--color-ether-cyan);
  transform: scale(1.3);
  border-color: #FFFFFF;
}

.point-core {
  width: 4px;
  height: 4px;
  background: var(--color-ether-cyan);
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
  color: var(--color-solar-gold);
}

.item-tag {
  font-size: 0.74rem;
  padding: 2px 10px;
  background: rgba(10, 11, 22, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  color: var(--color-text-muted);
}

.item-highlight-tag {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  padding: 2px 10px;
  background: rgba(92, 225, 230, 0.12);
  color: var(--color-ether-cyan);
  border-radius: var(--radius-full);
  border: 1px solid rgba(92, 225, 230, 0.3);
}

.item-title {
  font-family: var(--font-serif);
  font-size: 1.15rem;
  font-weight: 600;
  color: #FFFFFF;
  margin-bottom: 6px;
  transition: color var(--transition);
}

.timeline-item:hover .item-title,
.timeline-item.expanded .item-title {
  color: var(--color-ether-cyan);
}

.item-detail {
  font-size: 0.92rem;
  line-height: 1.75;
  color: var(--color-text-muted);
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
