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
</script>

<template>
  <section id="hero" class="hero">
    <!-- 粒子画布 -->
    <canvas ref="canvasRef" class="hero-canvas"></canvas>

    <!-- 渐变叠加层 -->
    <div class="hero-overlay"></div>

    <!-- 视差浮动装饰元素 -->
    <div class="hero-floats">
      <div class="float-el float-1" :style="float1Style"></div>
      <div class="float-el float-2" :style="float2Style"></div>
      <div class="float-el float-3" :style="float3Style"></div>
      <div class="float-el float-4" :style="float4Style"></div>
      <div class="float-el float-5" :style="float1Style"></div>
    </div>

    <!-- 装饰同心圆 (视差层) -->
    <div class="hero-ornament" :style="ornamentStyle">
      <svg width="70" height="70" viewBox="0 0 70 70" fill="none">
        <circle cx="35" cy="35" r="33" stroke="rgba(154,171,139,0.25)" stroke-width="0.8" stroke-dasharray="4 6" />
        <circle cx="35" cy="35" r="22" stroke="rgba(154,171,139,0.4)" stroke-width="0.8" />
        <circle cx="35" cy="35" r="4" fill="rgba(154,171,139,0.7)" />
      </svg>
    </div>

    <!-- 主要内容 (视差层) -->
    <div class="hero-content" :style="contentStyle">
      <div class="hero-tag">
        <span class="tag-dot"></span>
        <span>Full-Stack Developer</span>
      </div>

      <h1
        class="hero-name"
        @mouseenter="onNameEnter"
        @mouseleave="onNameLeave"
      >{{ scrambledName || 'var' }}</h1>

      <p class="hero-title">创意开发者 · 设计师</p>

      <div class="hero-typewriter">
        <span class="typewriter-prefix">~ </span>
        <span class="typewriter-text">{{ displayText }}</span>
        <span class="typewriter-cursor">▌</span>
      </div>
    </div>

    <!-- 波浪分隔过渡 -->
    <div class="hero-wave">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 72" preserveAspectRatio="none">
        <path d="M0,36 C240,72 480,0 720,36 C960,72 1200,0 1440,36 L1440,72 L0,72 Z" fill="#F5F0EB"/>
      </svg>
    </div>

    <!-- 滚动引导 -->
    <button class="scroll-indicator" @click="scrollToAbout" aria-label="向下滚动">
      <span class="scroll-text">向下探索</span>
      <span class="scroll-arrow">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
  background: linear-gradient(160deg, #1a1a2e 0%, #1e1e1e 40%, #2a2a2a 100%);
  overflow: hidden;
}

.hero-canvas {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 0%, rgba(30, 30, 30, 0.6) 100%);
  z-index: 2;
  pointer-events: none;
}

.hero-floats {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  overflow: hidden;
}

.float-el {
  position: absolute;
  border-radius: 50%;
  right: 12%;
  width: 80px;
  height: 80px;
  border: 1px solid rgba(154, 171, 139, 0.08);
}

.float-3 {
  bottom: 32%;
  left: 18%;
  width: 45px;
  height: 45px;
  border: 1px solid rgba(196, 168, 130, 0.1);
}

.float-4 {
  bottom: 18%;
  right: 22%;
  width: 5px;
  height: 5px;
  background: rgba(196, 168, 130, 0.5);
  box-shadow: 0 0 10px rgba(196, 168, 130, 0.3);
}

.float-5 {
  top: 55%;
  left: 75%;
  width: 100px;
  height: 100px;
  border: 1px solid rgba(124, 140, 110, 0.05);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  animation: morph 15s ease-in-out infinite;
}

@keyframes morph {
  0%, 100% { border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; }
  25% { border-radius: 58% 42% 75% 25% / 76% 46% 54% 24%; }
  50% { border-radius: 50% 50% 33% 67% / 55% 27% 73% 45%; }
  75% { border-radius: 33% 67% 58% 42% / 63% 68% 32% 37%; }
}

/* 装饰同心圆 */
.hero-ornament {
  position: absolute;
  top: 50%;
  left: 50%;
  margin-left: -35px;
  margin-top: -180px;
  z-index: 3;
  opacity: 0;
  animation: fadeInDown 1s ease 0.3s forwards;
  transition: transform 0.4s ease-out;
}

.hero-ornament svg {
  animation: slowSpin 25s linear infinite;
}

@keyframes slowSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 内容 */
.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  color: var(--color-text-inv);
  transition: transform 0.4s ease-out;
}

/* 开发者标签 */
.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: rgba(124, 140, 110, 0.12);
  border: 1px solid rgba(124, 140, 110, 0.2);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--color-accent-light);
  letter-spacing: 0.1em;
  margin-bottom: 2rem;
  opacity: 0;
  animation: fadeInDown 0.8s ease 0.2s forwards;
}

.tag-dot {
  width: 6px;
  height: 6px;
  background: #4ade80;
  border-radius: 50%;
  animation: pulse-dot 2s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.4); }
  50% { opacity: 0.7; box-shadow: 0 0 0 6px rgba(74, 222, 128, 0); }
}

/* 名字 — 悬浮时触发文字解码 */
.hero-name {
  font-family: 'Courier New', monospace;
  font-size: clamp(4rem, 14vw, 11rem);
  font-weight: 700;
  letter-spacing: 0.12em;
  margin-right: -0.12em;
  margin-bottom: 0.6rem;
  opacity: 0;
  background: linear-gradient(135deg, #F5F0EB 0%, #D4C4A8 40%, #9AAB8B 70%, #F5F0EB 100%);
  background-size: 300% 300%;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  animation: fadeInUp 1s ease 0.5s forwards, shimmer 8s ease infinite 1.5s;
  transition: filter 0.3s ease, transform 0.3s ease;
  user-select: none;
}

.hero-name:hover {
  filter: drop-shadow(0 0 30px rgba(124, 140, 110, 0.5))
          drop-shadow(0 0 60px rgba(124, 140, 110, 0.2));
  transform: scale(1.04);
}

@keyframes shimmer {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}

/* 头衔 */
.hero-title {
  font-size: 0.9rem;
  font-weight: 300;
  color: rgba(245, 240, 235, 0.45);
  letter-spacing: 0.3em;
  margin-right: -0.3em;
  text-transform: uppercase;
  margin-bottom: 2.5rem;
  opacity: 0;
  animation: fadeInUp 1s ease 0.7s forwards;
}

/* 打字机 — 终端风格 */
.hero-typewriter {
  font-size: 1.1rem;
  font-weight: 300;
  color: var(--color-accent-light);
  min-height: 2em;
  opacity: 0;
  animation: fadeInUp 1s ease 0.9s forwards;
  font-family: 'Courier New', var(--font-sans);
}

.typewriter-prefix {
  color: var(--color-accent);
  opacity: 0.6;
}

.typewriter-text {
  letter-spacing: 0.03em;
}

.typewriter-cursor {
  display: inline-block;
  margin-left: 1px;
  color: var(--color-accent);
  animation: blink 1s step-end infinite;
  font-weight: 400;
  font-size: 1rem;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 滚动引导 */
.scroll-indicator {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translate(-50%, 0);
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: rgba(245, 240, 235, 0.4);
  font-size: 0.8rem;
  transition: color var(--transition), transform 0.3s;
  opacity: 0;
  animation: fadeInUpCenter 1s ease 1.2s forwards;
}

.scroll-indicator:hover {
  color: var(--color-accent-light);
  transform: translate(-50%, -4px);
}

.scroll-text {
  font-weight: 300;
  letter-spacing: 0.15em;
  margin-right: -0.15em;
}

.scroll-arrow {
  animation: bounce 2s ease-in-out infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(8px); }
}

/* 入场动画 */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(25px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes fadeInUpCenter {
  from {
    opacity: 0;
    transform: translate(-50%, 25px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-15px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 响应式 */
@media (max-width: 768px) {
  .hero-name {
    font-size: 4rem;
    letter-spacing: 0.1em;
  }
  .hero-title { font-size: 1rem; letter-spacing: 0.15em; }
  .hero-typewriter { font-size: 0.95rem; padding: 0 20px; }
  .hero-floats { display: none; }
}

@media (max-width: 480px) {
  .hero-name { font-size: 3rem; }
  .hero-title { font-size: 0.9rem; }
}
</style>
