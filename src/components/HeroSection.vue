<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useParticles } from '@/composables/useParticles'
import { useTypewriter } from '@/composables/useTypewriter'
import { useTextScramble } from '@/composables/useTextScramble'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init: initParticles } = useParticles()

const mottos = [
  '好的界面应该像呼吸一样自然，让人忘记它的存在',
  '代码是手艺，把粗糙的想法磨成光滑的体验',
  '在键盘和画布之间找到属于自己的节奏',
  '每一行代码都是一次小小的创造',
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

    <!-- 舞台环境超现实光斑 -->
    <div class="hero-ambient-glow" aria-hidden="true"></div>

    <!-- 主要内容 (微视差层) -->
    <div class="hero-content" :style="contentStyle">
      <!-- 身份微章 -->
      <div class="hero-chip">
        <span class="chip-sparkle">◆</span>
        <span class="chip-text">创意开发者 · 杭州</span>
      </div>

      <!-- 签名大字 (交互解码) -->
      <div class="hero-name-container">
        <h1
          class="hero-name"
          @click="onNameClick"
          @mouseenter="onNameEnter"
          @mouseleave="onNameLeave"
          title="轻触变换字符"
        >{{ scrambledName || 'var' }}</h1>
      </div>

      <p class="hero-tagline">喜欢写代码、做界面、折腾声音和 3D，用技术把想法变成看得见的东西</p>

      <!-- 打字机窗口 -->
      <div class="typewriter-card tilt-shine">
        <div class="typewriter-body">
          <span class="typewriter-quote">“</span>
          <span class="typewriter-text">{{ displayText }}</span>
          <span class="typewriter-cursor">▌</span>
          <span class="typewriter-quote">”</span>
        </div>
      </div>

      <!-- 行动按键行与音频播放 -->
      <div class="hero-actions">
        <button class="tile-btn-primary" @click="scrollToSection('#now')">
          <span>看看最近在做什么</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button class="tile-btn-secondary" @click="scrollToSection('#cabin')">
          <span>逛逛小木屋 🌲</span>
        </button>
        <button
          class="hero-audio-btn"
          :class="{ active: isAudioPlaying }"
          @click="handleAudioQuickToggle"
          :aria-label="isAudioPlaying ? '暂停音乐' : '播放音乐'"
          :title="isAudioPlaying ? '暂停音乐' : '播放音乐'"
        >
          <span class="audio-icon">{{ isAudioPlaying ? '⏸' : '▶' }}</span>
          <span class="audio-label">{{ isAudioPlaying ? '播放中' : '听首歌' }}</span>
          <span class="audio-bars" :class="{ playing: isAudioPlaying }">
            <i></i><i></i><i></i>
          </span>
        </button>
      </div>
    </div>

    <!-- 底部滚动引导 -->
    <button class="scroll-indicator" @click="scrollToAbout" aria-label="向下探索">
      <span class="scroll-text">往下看</span>
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
  overflow: hidden;
  border-bottom: 1px solid var(--color-border);
  padding: 120px 24px 95px;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.hero-ambient-glow {
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 600px;
  height: 380px;
  background: radial-gradient(circle, rgba(91, 140, 110, 0.08) 0%, rgba(200, 148, 74, 0.05) 50%, transparent 80%);
  pointer-events: none;
  z-index: 2;
  filter: blur(60px);
}

.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 780px;
  margin: 0 auto;
  transition: transform 0.4s ease-out;
}

.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: var(--color-accent-soft);
  border: 1px solid rgba(91, 140, 110, 0.2);
  border-radius: var(--radius-full);
  margin-bottom: 1.6rem;
  opacity: 0;
  animation: fadeInDown 0.7s var(--ease) 0.15s forwards;
}

.chip-sparkle {
  color: var(--color-accent);
  font-size: 0.75rem;
}

.chip-text {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-accent);
  letter-spacing: 0.02em;
}

.hero-name-container {
  position: relative;
  display: inline-block;
  margin-bottom: 1rem;
}

.hero-name {
  font-family: var(--font-serif);
  font-size: clamp(4.2rem, 13vw, 8rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.95;
  color: var(--color-ink);
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.3s forwards;
  transition: transform 0.32s var(--ease-spring);
  cursor: pointer;
  user-select: none;
}

.hero-name:hover {
  transform: scale(1.03);
}

.hero-name:active {
  transform: scale(0.97);
}

.hero-tagline {
  font-size: clamp(1rem, 2vw, 1.15rem);
  font-weight: 400;
  color: var(--color-text-light);
  line-height: 1.7;
  max-width: 540px;
  margin: 0 auto 2.4rem;
  text-wrap: balance;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.45s forwards;
}

/* 打字机窗口 */
.typewriter-card {
  max-width: 560px;
  margin: 0 auto 2.8rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--tile-shadow);
  text-align: left;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.6s forwards;
  transition: transform var(--transition), box-shadow var(--transition);
}

.typewriter-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
}

.typewriter-body {
  padding: 18px 24px;
  font-family: var(--font-serif);
  font-size: 1rem;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  min-height: 56px;
  line-height: 1.7;
}

.typewriter-quote {
  color: var(--color-amber);
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0 4px;
}

.typewriter-text {
  flex: 1;
}

.typewriter-cursor {
  color: var(--color-accent);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.75s forwards;
}

.hero-audio-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-light);
  background: rgba(0, 0, 0, 0.03);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: transform var(--transition), border-color var(--transition), background-color var(--transition), color var(--transition);
}

.hero-audio-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

.hero-audio-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
  transform: translateY(-1px);
}

.hero-audio-btn.active {
  border-color: var(--color-amber);
  color: var(--color-amber);
  background: rgba(200, 148, 74, 0.08);
}

.audio-icon {
  font-size: 0.8rem;
}

.audio-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.audio-bars i {
  width: 2px;
  height: 4px;
  background: var(--color-text-lighter);
  border-radius: 1px;
  display: block;
  transition: height 0.2s;
}

.audio-bars.playing i {
  background: var(--color-amber);
}

.audio-bars.playing i:nth-child(1) { animation: wave-bar 0.8s ease-in-out infinite alternate; }
.audio-bars.playing i:nth-child(2) { animation: wave-bar 0.8s ease-in-out 0.25s infinite alternate; }
.audio-bars.playing i:nth-child(3) { animation: wave-bar 0.8s ease-in-out 0.5s infinite alternate; }

@keyframes wave-bar {
  0% { height: 3px; }
  100% { height: 12px; }
}

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
  color: var(--color-accent);
  transform: translate(-50%, -3px);
}

.scroll-text {
  font-weight: 500;
  letter-spacing: 0.04em;
}

.scroll-arrow {
  animation: subtleBounce 2s ease-in-out infinite;
}

@keyframes subtleBounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(5px); }
}

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

@media (max-width: 768px) {
  .hero {
    padding: 95px 16px 65px;
    min-height: 92vh;
  }
  .hero-name {
    font-size: clamp(3.2rem, 16vw, 5rem);
  }
  .hero-tagline {
    font-size: 0.96rem;
    margin-bottom: 2rem;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
    max-width: 300px;
    margin: 0 auto;
  }
  .hero-actions .tile-btn-primary,
  .hero-actions .tile-btn-secondary,
  .hero-actions .hero-audio-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
