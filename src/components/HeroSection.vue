<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useParticles } from '@/composables/useParticles'
import { useTypewriter } from '@/composables/useTypewriter'
import { useTextScramble } from '@/composables/useTextScramble'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init: initParticles } = useParticles()

const mottos = [
  '在阳光与微风里，写下有温度的代码',
  '保持好奇心，把日常灵感变成有趣的作品',
  '化繁为简，享受随性自由的造物时光',
  '放轻松，听首歌，漫步在自然与代码之间',
]

const { displayText, start: startTypewriter } = useTypewriter(mottos, 90, 45, 2800)
const { output: scrambledName, scramble } = useTextScramble()
const { isPlaying: isAudioPlaying, selectTrack, togglePlay: toggleAudioPlay } = useAudioPlayer()

function handleAudioQuickToggle() {
  if (!isAudioPlaying.value) {
    selectTrack(0, true)
  } else {
    toggleAudioPlay()
  }
}

// 鼠标视差 — 多层元素以不同速度移动产生景深
const mouseX = ref(0)
const mouseY = ref(0)

const contentStyle = computed(() => ({
  transform: `translate(${mouseX.value * -15}px, ${mouseY.value * -10}px)`,
}))

function handleMouseMove(e: MouseEvent) {
  const { innerWidth, innerHeight } = window
  mouseX.value = (e.clientX / innerWidth - 0.5) * 2
  mouseY.value = (e.clientY / innerHeight - 0.5) * 2
}

let nameHoverTimeout: ReturnType<typeof setTimeout> | null = null

function onNameEnter() {
  scramble('var', 600)
}

function onNameLeave() {
  if (nameHoverTimeout) clearTimeout(nameHoverTimeout)
  nameHoverTimeout = setTimeout(() => {
    scramble('var', 400)
  }, 100)
}

function onNameClick() {
  scramble('var', 800)
}

onMounted(() => {
  if (canvasRef.value) {
    initParticles(canvasRef.value)
  }
  startTypewriter()

  // 初始加载时文字解码效果
  scramble('var', 1500)

  window.addEventListener('mousemove', handleMouseMove, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMouseMove)
  if (nameHoverTimeout) clearTimeout(nameHoverTimeout)
})

function scrollToAbout() {
  document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' })
}

function scrollToSection(selector: string) {
  document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <section id="hero" class="hero">
    <!-- 粒子画布 -->
    <canvas ref="canvasRef" class="hero-canvas"></canvas>

    <!-- 舞台环境光斑 -->
    <div class="hero-ambient-glow" aria-hidden="true"></div>

    <!-- 主要内容 (微视差层) -->
    <div class="hero-content" :style="contentStyle">
      <!-- 身份微章 -->
      <div class="hero-chip">
        <span class="chip-sparkle">🌿</span>
        <span class="chip-text">独立开发 · 创意交互 · 随风造物</span>
      </div>

      <!-- 签名大字 (交互解码与流体拉伸) -->
      <h1
        class="hero-name"
        @click="onNameClick"
        @mouseenter="onNameEnter"
        @mouseleave="onNameLeave"
        title="点击触发字形重构"
      >{{ scrambledName || 'var' }}</h1>

      <p class="hero-tagline">写写代码，做做设计，喜欢捣鼓自然温润、有生命力的数字小玩意</p>

      <!-- 日光随想笺 (Sunlit Note Card) -->
      <div class="hero-sunlit-note tile-card tilt-shine">
        <div class="note-header">
          <div class="note-pin">
            <span class="pin-leaf">🍃</span>
            <span class="note-label">晨光便签</span>
          </div>
          <span class="note-tag">today's thought</span>
        </div>
        <div class="note-body">
          <span class="note-quote-mark">“</span>
          <span class="note-text">{{ displayText }}</span>
          <span class="note-cursor">▌</span>
          <span class="note-quote-mark">”</span>
        </div>
      </div>

      <!-- 行动按键行与声学胶囊 -->
      <div class="hero-actions">
        <button class="tile-btn-primary" @click="scrollToSection('#now')">
          <span>看看近况 ☕</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button class="tile-btn-secondary" @click="scrollToSection('#cabin')">
          <span>漫步小木屋 🌲</span>
        </button>
        <button
          class="hero-audio-pill"
          :class="{ active: isAudioPlaying }"
          @click="handleAudioQuickToggle"
          :aria-label="isAudioPlaying ? '暂停背景音乐' : '放首歌听'"
          :title="isAudioPlaying ? '暂停背景音乐' : '放首歌听'"
        >
          <span class="audio-pill-icon">{{ isAudioPlaying ? '🎵' : '🎧' }}</span>
          <span class="audio-pill-text">{{ isAudioPlaying ? '旋律流淌中' : '放首歌听' }}</span>
          <span class="audio-wave-mini" :class="{ playing: isAudioPlaying }">
            <i></i><i></i><i></i>
          </span>
        </button>
      </div>
    </div>

    <!-- 底部滚动引导 -->
    <button class="scroll-indicator" @click="scrollToAbout" aria-label="向下探索">
      <span class="scroll-text">向下探索</span>
      <span class="scroll-arrow">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </span>
    </button>
  </section>
</template>

<style scoped>
.hero {
  position: relative;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-base);
  background-image: radial-gradient(rgba(45, 65, 52, 0.04) 1.2px, transparent 1.2px);
  background-size: 32px 32px;
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  padding: 110px 24px 85px;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

/* 舞台环境光斑 */
.hero-ambient-glow {
  position: absolute;
  top: 38%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 680px;
  height: 420px;
  background: radial-gradient(circle, rgba(217, 155, 75, 0.12) 0%, rgba(62, 107, 72, 0.08) 50%, transparent 75%);
  pointer-events: none;
  z-index: 2;
  filter: blur(50px);
}

/* 内容主区域 */
.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 820px;
  margin: 0 auto;
  transition: transform 0.4s ease-out;
}

/* 身份微章 */
.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: var(--color-surface-sunken);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-full);
  box-shadow: 0 2px 8px rgba(45, 65, 52, 0.04);
  margin-bottom: 1.6rem;
  opacity: 0;
  animation: fadeInDown 0.7s var(--ease) 0.15s forwards;
}

.chip-sparkle {
  font-size: 0.95rem;
}

.chip-text {
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--color-text-light);
  letter-spacing: 0.02em;
}

/* 签名大字 */
.hero-name {
  font-family: var(--font-sans);
  font-size: clamp(4.2rem, 12vw, 8rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
  margin-bottom: 1.2rem;
  color: var(--color-ink);
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.3s forwards;
  transition: transform 0.28s var(--ease-spring), color 0.28s var(--ease), text-shadow 0.28s var(--ease);
  cursor: pointer;
  user-select: none;
}

.hero-name:hover {
  color: var(--color-forest);
  transform: scale(1.03);
  text-shadow: 0 0 32px rgba(62, 107, 72, 0.2);
}

.hero-name:active {
  transform: scale(0.98);
}

/* 标语副标题 */
.hero-tagline {
  font-size: clamp(1rem, 2.2vw, 1.18rem);
  font-weight: 400;
  color: var(--color-text-light);
  line-height: 1.65;
  max-width: 600px;
  margin: 0 auto 2.4rem;
  text-wrap: balance;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.45s forwards;
}

/* 日光随想笺 (Sunlit Note Card) */
.hero-sunlit-note {
  background: #FFFFFF;
  border: 1px solid var(--border-light);
  border-radius: var(--radius);
  box-shadow: var(--tile-shadow);
  max-width: 580px;
  margin: 0 auto 2.5rem;
  overflow: hidden;
  text-align: left;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.6s forwards;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}

.hero-sunlit-note:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
  border-color: var(--color-border-hover);
}

.note-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 18px;
  background: #FAFBF9;
  border-bottom: 1px solid var(--border-light);
}

.note-pin {
  display: flex;
  align-items: center;
  gap: 7px;
}

.pin-leaf {
  font-size: 0.95rem;
}

.note-label {
  font-family: var(--font-sans);
  font-size: 0.78rem;
  color: var(--color-forest);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.note-tag {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--color-text-lighter);
}

.note-body {
  padding: 16px 20px;
  font-family: var(--font-serif);
  font-size: 1.02rem;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  min-height: 56px;
}

.note-quote-mark {
  color: var(--color-forest);
  font-weight: 700;
  margin: 0 4px;
  font-size: 1.15rem;
}

.note-text {
  flex: 1;
  letter-spacing: 0.02em;
}

.note-cursor {
  color: var(--color-forest);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 操作按键组与声学胶囊 */
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.75s forwards;
}

.hero-audio-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 22px;
  font-size: 0.92rem;
  font-weight: 500;
  color: var(--color-ink);
  background: #FFFFFF;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(45, 65, 52, 0.05);
  transition: transform var(--transition), border-color var(--transition), background-color var(--transition), color var(--transition), box-shadow var(--transition);
}

.hero-audio-pill:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 3px;
}

.hero-audio-pill:hover {
  border-color: var(--color-forest);
  color: var(--color-forest);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(45, 65, 52, 0.1);
}

.hero-audio-pill.active {
  border-color: var(--color-forest);
  background: rgba(62, 107, 72, 0.08);
  color: var(--color-forest);
  font-weight: 600;
}

.audio-wave-mini {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.audio-wave-mini i {
  width: 2px;
  height: 4px;
  background: currentColor;
  border-radius: 1px;
  display: block;
  transition: height 0.2s;
}

.audio-wave-mini.playing i:nth-child(1) { animation: wave-jump 0.8s ease-in-out infinite alternate; }
.audio-wave-mini.playing i:nth-child(2) { animation: wave-jump 0.8s ease-in-out 0.25s infinite alternate; }
.audio-wave-mini.playing i:nth-child(3) { animation: wave-jump 0.8s ease-in-out 0.5s infinite alternate; }

@keyframes wave-jump {
  0% { height: 3px; }
  100% { height: 12px; }
}

/* 底部滚动引导 */
.scroll-indicator {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--color-text-lighter);
  font-size: 0.78rem;
  transition: color var(--transition), transform 0.24s;
  opacity: 0;
  animation: fadeInUpCenter 0.8s var(--ease) 0.9s forwards;
}

.scroll-indicator:hover {
  color: var(--color-amber);
  transform: translate(-50%, -3px);
}

.scroll-text {
  font-weight: 500;
  letter-spacing: 0.06em;
}

.scroll-arrow {
  animation: subtleBounce 2s ease-in-out infinite;
}

@keyframes subtleBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}

/* 入场过渡 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUpCenter {
  from { opacity: 0; transform: translate(-50%, 20px); }
  to { opacity: 1; transform: translate(-50%, 0); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-12px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 响应式 */
@media (max-width: 768px) {
  .hero {
    padding: 85px 16px 60px;
    min-height: 90vh;
  }
  .hero-name {
    font-size: clamp(3.2rem, 15vw, 5.2rem);
  }
  .hero-tagline {
    font-size: 0.95rem;
    margin-bottom: 1.8rem;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }
  .hero-actions .tile-btn-primary,
  .hero-actions .tile-btn-secondary,
  .hero-actions .hero-audio-pill {
    width: 100%;
    justify-content: center;
  }
}
</style>
