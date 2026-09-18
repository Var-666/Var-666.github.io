<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useParticles } from '@/composables/useParticles'
import { useTypewriter } from '@/composables/useTypewriter'
import { useTextScramble } from '@/composables/useTextScramble'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init: initParticles } = useParticles()

const mottos = [
  '以代码编织创意，用设计诠释自然',
  '探索技术与艺术的交汇之处',
  '化繁为简，回归本真',
]

const { displayText, start: startTypewriter } = useTypewriter(mottos, 90, 45, 2800)
const { output: scrambledName, scramble } = useTextScramble()

// 鼠标视差 — 多层元素以不同速度移动产生景深
const mouseX = ref(0)
const mouseY = ref(0)

const contentStyle = computed(() => ({
  transform: `translate(${mouseX.value * -15}px, ${mouseY.value * -10}px)`,
}))

const ornamentStyle = computed(() => ({
  transform: `translate(${mouseX.value * -25}px, ${mouseY.value * -20}px)`,
}))

const float1Style = computed(() => ({
  transform: `translate(${mouseX.value * 20}px, ${mouseY.value * 12}px)`,
}))

const float2Style = computed(() => ({
  transform: `translate(${mouseX.value * -30}px, ${mouseY.value * -25}px)`,
}))

const float3Style = computed(() => ({
  transform: `translate(${mouseX.value * 12}px, ${mouseY.value * -18}px)`,
}))

const float4Style = computed(() => ({
  transform: `translate(${mouseX.value * -18}px, ${mouseY.value * 28}px)`,
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

    <!-- 主要内容 (微视差层) -->
    <div class="hero-content" :style="contentStyle">
      <!-- 身份徽章 -->
      <div class="hero-chip">
        <span class="chip-dot"></span>
        <span class="chip-text">全栈创造者与数字手艺人</span>
      </div>

      <!-- 签名大字 (交互解码) -->
      <h1
        class="hero-name"
        @mouseenter="onNameEnter"
        @mouseleave="onNameLeave"
      >{{ scrambledName || 'var' }}</h1>

      <p class="hero-tagline">以手艺人心态雕琢代码，构建沉静而富有生命力的实体数字体验</p>

      <!-- 瓷砖终端打字机 -->
      <div class="hero-terminal-tile">
        <div class="terminal-bar">
          <div class="terminal-dots">
            <span class="dot dot-close"></span>
            <span class="dot dot-min"></span>
            <span class="dot dot-expand"></span>
          </div>
          <span class="terminal-title">var@craft-studio ~ motto</span>
        </div>
        <div class="terminal-body">
          <span class="terminal-prompt">&gt;_</span>
          <span class="terminal-text">{{ displayText }}</span>
          <span class="terminal-cursor">▌</span>
        </div>
      </div>

      <!-- 行动按键行 -->
      <div class="hero-actions">
        <button class="tile-btn-primary" @click="scrollToSection('#now')">
          <span>此时此刻 · 近况</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button class="tile-btn-secondary" @click="scrollToSection('#cabin')">
          <span>漫步小木屋 🌲</span>
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
  background-image: radial-gradient(var(--color-grout) 1.2px, transparent 1.2px);
  background-size: 32px 32px;
  overflow: hidden;
  border-bottom: 1px solid var(--color-grout);
  padding: 100px 24px 80px;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

/* 内容主区域 */
.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 780px;
  margin: 0 auto;
  transition: transform 0.4s ease-out;
}

/* 身份徽章 */
.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  background: var(--color-surface);
  border: 1px solid var(--color-grout);
  border-radius: var(--radius-xs);
  box-shadow: var(--tile-shadow);
  margin-bottom: 1.5rem;
  opacity: 0;
  animation: fadeInDown 0.7s var(--ease) 0.15s forwards;
}

.chip-dot {
  width: 7px;
  height: 7px;
  background: var(--color-glaze-celadon);
  border-radius: 50%;
  animation: pulse-dot 2.5s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.3); opacity: 0.6; }
}

.chip-text {
  font-size: 0.82rem;
  font-weight: 500;
  color: var(--color-text-light);
  letter-spacing: 0.04em;
}

/* 签名大字 */
.hero-name {
  font-family: var(--font-serif);
  font-size: clamp(3.8rem, 11vw, 7.8rem);
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1;
  margin-bottom: 1.2rem;
  color: var(--color-ink);
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.3s forwards;
  transition: transform 0.25s var(--ease), color 0.25s var(--ease);
  cursor: pointer;
  user-select: none;
}

.hero-name:hover {
  color: var(--color-glaze-celadon);
  transform: scale(1.02);
}

/* 标语副标题 */
.hero-tagline {
  font-size: clamp(1rem, 2.2vw, 1.18rem);
  font-weight: 400;
  color: var(--color-text-light);
  line-height: 1.6;
  max-width: 580px;
  margin: 0 auto 2.2rem;
  text-wrap: balance;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.45s forwards;
}

/* 瓷砖终端框 (Ceramic Terminal Tile) */
.hero-terminal-tile {
  background: var(--color-surface);
  border: 1px solid var(--color-grout);
  border-radius: var(--radius);
  box-shadow: var(--tile-shadow);
  max-width: 560px;
  margin: 0 auto 2.5rem;
  overflow: hidden;
  text-align: left;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.6s forwards;
  transition: transform var(--transition), box-shadow var(--transition);
}

.hero-terminal-tile:hover {
  transform: translateY(-2px);
  box-shadow: var(--tile-shadow-hover);
}

.terminal-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 9px 14px;
  background: var(--color-bg-alt);
  border-bottom: 1px solid var(--color-grout);
}

.terminal-dots {
  display: flex;
  gap: 6px;
}

.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  display: inline-block;
}

.dot-close { background: #E06C75; }
.dot-min { background: #E5C07B; }
.dot-expand { background: #98C379; }

.terminal-title {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-text-lighter);
}

.terminal-body {
  padding: 14px 18px;
  font-family: var(--font-mono);
  font-size: 0.96rem;
  color: var(--color-ink);
  display: flex;
  align-items: center;
  min-height: 52px;
}

.terminal-prompt {
  color: var(--color-glaze-celadon);
  font-weight: 700;
  margin-right: 10px;
}

.terminal-text {
  flex: 1;
  letter-spacing: 0.02em;
}

.terminal-cursor {
  color: var(--color-terracotta);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 操作按键组 */
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.75s forwards;
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
  color: var(--color-glaze-celadon);
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
    font-size: clamp(3rem, 15vw, 4.8rem);
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
  .hero-actions .tile-btn-secondary {
    width: 100%;
  }
}
</style>
