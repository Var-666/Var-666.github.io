<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useParticles } from '@/composables/useParticles'
import { useTypewriter } from '@/composables/useTypewriter'
import { useTextScramble } from '@/composables/useTextScramble'
import { useAudioPlayer } from '@/composables/useAudioPlayer'

const canvasRef = ref<HTMLCanvasElement | null>(null)
const { init: initParticles } = useParticles()

const mottos = [
  '白昼在星空深处燃烧，代码在虚实之间漂浮',
  '时间融化在梦境与界面的裂隙中',
  '在不可测的算法海洋里，打捞超现实的诗意',
  '超越平庸重力，以形而上光影编织数字实体',
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
      <!-- 身份星象微章 -->
      <div class="hero-chip">
        <span class="chip-sparkle">✦</span>
        <span class="chip-text">DIMENSION // 0.0.1 · 虚实之门与超现实空间</span>
      </div>

      <!-- 签名大字 (交互解码、流体金属与虚空倒影) -->
      <div class="hero-name-container">
        <h1
          class="hero-name"
          @click="onNameClick"
          @mouseenter="onNameEnter"
          @mouseleave="onNameLeave"
          title="轻触触发时空折叠"
        >{{ scrambledName || 'var' }}</h1>
        <div class="hero-name-reflection" aria-hidden="true">{{ scrambledName || 'var' }}</div>
      </div>

      <p class="hero-tagline">在形而上空间与非欧几何间，构筑超越平庸重力的数字梦境</p>

      <!-- 白昼之门与星空之窗 (The Portal of Dual Horizons · 马格利特错位之窗) -->
      <div class="surreal-window-portal surreal-portal-frame surreal-arch tilt-shine">
        <div class="portal-sky-backdrop">
          <div class="portal-cloud pc-1"></div>
          <div class="portal-cloud pc-2"></div>
          <div class="portal-constellation">✦ · ✧ · ✦</div>
        </div>
        <div class="portal-glass-pane">
          <div class="portal-header">
            <div class="portal-eye">
              <span class="portal-eye-icon">👁️</span>
              <span class="portal-label">白昼之窗 · ONEIRIC PORTAL</span>
            </div>
            <span class="portal-coord">φ 30°15'N · λ 120°10'E</span>
          </div>
          <div class="portal-body">
            <span class="portal-quote-mark">“</span>
            <span class="portal-text">{{ displayText }}</span>
            <span class="portal-cursor">▌</span>
            <span class="portal-quote-mark">”</span>
          </div>
        </div>
      </div>

      <!-- 行动按键行与天体发声球 -->
      <div class="hero-actions">
        <button class="tile-btn-primary" @click="scrollToSection('#now')">
          <span>探索时空仪 ✦</span>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        <button class="tile-btn-secondary" @click="scrollToSection('#cabin')">
          <span>漫步小木屋 🌲</span>
        </button>
        <button
          class="hero-audio-orb"
          :class="{ active: isAudioPlaying }"
          @click="handleAudioQuickToggle"
          :aria-label="isAudioPlaying ? '暂停天体旋律' : '唤醒天体发声球'"
          :title="isAudioPlaying ? '暂停天体旋律' : '唤醒天体发声球'"
        >
          <div class="orb-ring" :class="{ spinning: isAudioPlaying }"></div>
          <span class="orb-core">
            <span v-if="!isAudioPlaying">🪐</span>
            <span v-else>✨</span>
          </span>
          <span class="orb-text">{{ isAudioPlaying ? '以太共振中' : '发声天体' }}</span>
          <span class="orb-wave-bars" :class="{ playing: isAudioPlaying }">
            <i></i><i></i><i></i>
          </span>
        </button>
      </div>
    </div>

    <!-- 底部滚动引导 -->
    <button class="scroll-indicator" @click="scrollToAbout" aria-label="向下探索">
      <span class="scroll-text">进入形而上回廊</span>
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
  background-image:
    radial-gradient(rgba(92, 225, 230, 0.08) 1.2px, transparent 1.2px),
    radial-gradient(circle at 50% 20%, rgba(92, 225, 230, 0.1) 0%, transparent 60%);
  background-size: 36px 36px, 100% 100%;
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

/* 舞台环境超现实光斑 */
.hero-ambient-glow {
  position: absolute;
  top: 36%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 750px;
  height: 460px;
  background: radial-gradient(circle, rgba(92, 225, 230, 0.18) 0%, rgba(214, 93, 177, 0.12) 40%, rgba(247, 178, 103, 0.08) 70%, transparent 85%);
  pointer-events: none;
  z-index: 2;
  filter: blur(70px);
}

/* 内容主区域 */
.hero-content {
  position: relative;
  z-index: 3;
  text-align: center;
  max-width: 860px;
  margin: 0 auto;
  transition: transform 0.4s ease-out;
}

/* 身份星象微章 */
.hero-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 18px;
  background: rgba(92, 225, 230, 0.08);
  border: 1px solid rgba(92, 225, 230, 0.28);
  border-radius: var(--radius-full);
  box-shadow: 0 0 20px rgba(92, 225, 230, 0.18);
  margin-bottom: 1.6rem;
  opacity: 0;
  animation: fadeInDown 0.7s var(--ease) 0.15s forwards;
}

.chip-sparkle {
  color: var(--color-solar-gold);
  font-size: 0.95rem;
}

.chip-text {
  font-family: var(--font-mono);
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-ether-cyan);
  letter-spacing: 0.06em;
}

/* 签名大字容器与虚空倒影 */
.hero-name-container {
  position: relative;
  display: inline-block;
  margin-bottom: 1rem;
}

.hero-name {
  font-family: var(--font-sans);
  font-size: clamp(4.6rem, 14vw, 8.8rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 0.95;
  background: linear-gradient(135deg, #FFFFFF 0%, #C4EDFB 30%, #5CE1E6 65%, #F7B267 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 32px rgba(92, 225, 230, 0.4));
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.3s forwards;
  transition: transform 0.32s var(--ease-spring), filter 0.32s var(--ease);
  cursor: pointer;
  user-select: none;
}

.hero-name:hover {
  transform: scale(1.04) rotate(-0.5deg);
  filter: drop-shadow(0 0 45px rgba(92, 225, 230, 0.65)) drop-shadow(0 0 15px rgba(247, 178, 103, 0.4));
}

.hero-name:active {
  transform: scale(0.97);
}

/* 水镜虚空倒影 (Surreal Lake Reflection) */
.hero-name-reflection {
  position: absolute;
  top: 76%;
  left: 0;
  right: 0;
  font-family: var(--font-sans);
  font-size: clamp(4.6rem, 14vw, 8.8rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 0.95;
  transform: scaleY(-0.65);
  opacity: 0.18;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(92, 225, 230, 0.8) 0%, transparent 75%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: blur(2.5px);
  user-select: none;
}

/* 标语副标题 */
.hero-tagline {
  font-size: clamp(1.05rem, 2.2vw, 1.22rem);
  font-weight: 400;
  color: var(--color-text-light);
  line-height: 1.65;
  max-width: 620px;
  margin: 0 auto 2.6rem;
  text-wrap: balance;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.45s forwards;
}

/* ── 白昼之门与星空之窗 (Surreal Dual Horizon Window) ── */
.surreal-window-portal {
  position: relative;
  max-width: 620px;
  margin: 0 auto 2.8rem;
  border-radius: 130px 130px 18px 18px;
  overflow: hidden;
  box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.85), 0 0 36px rgba(92, 225, 230, 0.2);
  border: 1px solid rgba(92, 225, 230, 0.3);
  text-align: left;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.6s forwards;
  transition: transform var(--transition), box-shadow var(--transition), border-color var(--transition);
}

.surreal-window-portal:hover {
  transform: translateY(-3px);
  box-shadow: 0 32px 80px -10px rgba(92, 225, 230, 0.25), 0 0 45px rgba(92, 225, 230, 0.35);
  border-color: rgba(92, 225, 230, 0.6);
}

/* 窗内晴空与漂浮云层 (马格利特错位之景) */
.portal-sky-backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #0E1D3A 0%, #15264E 45%, #243B6E 100%);
  overflow: hidden;
  z-index: 1;
}

.portal-cloud {
  position: absolute;
  border-radius: 50%;
  filter: blur(14px);
  background: radial-gradient(ellipse at center, rgba(162, 210, 255, 0.35) 0%, rgba(92, 225, 230, 0.12) 60%, transparent 85%);
  pointer-events: none;
}

.portal-cloud.pc-1 {
  width: 240px;
  height: 110px;
  top: 15%;
  left: -20px;
  animation: cloud-drift 24s ease-in-out infinite alternate;
}

.portal-cloud.pc-2 {
  width: 300px;
  height: 130px;
  bottom: 5%;
  right: -30px;
  animation: cloud-drift 30s ease-in-out 4s infinite alternate-reverse;
}

.portal-constellation {
  position: absolute;
  top: 16px;
  right: 24px;
  font-size: 0.72rem;
  color: rgba(247, 178, 103, 0.65);
  letter-spacing: 0.3em;
}

@keyframes cloud-drift {
  0% { transform: translateX(0); }
  100% { transform: translateX(50px); }
}

.portal-glass-pane {
  position: relative;
  z-index: 2;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  background: rgba(12, 15, 34, 0.65);
}

.portal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-bottom: 1px solid rgba(92, 225, 230, 0.15);
  background: rgba(255, 255, 255, 0.03);
}

.portal-eye {
  display: flex;
  align-items: center;
  gap: 8px;
}

.portal-eye-icon {
  font-size: 1rem;
}

.portal-label {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--color-ether-cyan);
  font-weight: 600;
  letter-spacing: 0.06em;
}

.portal-coord {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: rgba(240, 242, 253, 0.5);
}

.portal-body {
  padding: 20px 24px;
  font-family: var(--font-serif);
  font-size: 1.05rem;
  color: #F0F2FD;
  display: flex;
  align-items: center;
  min-height: 64px;
  line-height: 1.6;
}

.portal-quote-mark {
  color: var(--color-solar-gold);
  font-weight: 700;
  margin: 0 4px;
  font-size: 1.2rem;
}

.portal-text {
  flex: 1;
  letter-spacing: 0.02em;
}

.portal-cursor {
  color: var(--color-ether-cyan);
  animation: blink 1s step-end infinite;
  margin-left: 2px;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 操作按键组与天体发声球 */
.hero-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  flex-wrap: wrap;
  opacity: 0;
  animation: fadeInUp 0.8s var(--ease) 0.75s forwards;
}

/* 天体发声球 (Celestial Acoustic Orb) */
.hero-audio-orb {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 12px 24px;
  font-size: 0.92rem;
  font-weight: 500;
  color: #F0F2FD;
  background: rgba(20, 23, 50, 0.78);
  border: 1px solid rgba(92, 225, 230, 0.3);
  border-radius: var(--radius-full);
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 0 16px rgba(92, 225, 230, 0.2);
  transition: transform var(--transition), border-color var(--transition), background-color var(--transition), box-shadow var(--transition);
}

.hero-audio-orb:focus-visible {
  outline: 2px solid var(--color-ether-cyan);
  outline-offset: 3px;
}

.hero-audio-orb:hover {
  border-color: var(--color-ether-cyan);
  color: #FFFFFF;
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(92, 225, 230, 0.35), 0 0 20px rgba(92, 225, 230, 0.3);
}

.hero-audio-orb.active {
  border-color: var(--color-solar-gold);
  background: rgba(30, 36, 76, 0.85);
  box-shadow: 0 0 24px rgba(247, 178, 103, 0.4);
}

.orb-core {
  font-size: 1rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.orb-wave-bars {
  display: inline-flex;
  align-items: flex-end;
  gap: 2.5px;
  height: 12px;
}

.orb-wave-bars i {
  width: 2.5px;
  height: 4px;
  background: var(--color-ether-cyan);
  border-radius: 1px;
  display: block;
  transition: height 0.2s;
}

.orb-wave-bars.playing i {
  background: var(--color-solar-gold);
}

.orb-wave-bars.playing i:nth-child(1) { animation: wave-jump 0.8s ease-in-out infinite alternate; }
.orb-wave-bars.playing i:nth-child(2) { animation: wave-jump 0.8s ease-in-out 0.25s infinite alternate; }
.orb-wave-bars.playing i:nth-child(3) { animation: wave-jump 0.8s ease-in-out 0.5s infinite alternate; }

@keyframes wave-jump {
  0% { height: 3px; }
  100% { height: 13px; }
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
  color: var(--color-ether-cyan);
  transform: translate(-50%, -3px);
}

.scroll-text {
  font-family: var(--font-serif);
  font-weight: 500;
  letter-spacing: 0.08em;
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
    padding: 95px 16px 65px;
    min-height: 92vh;
  }
  .hero-name {
    font-size: clamp(3.4rem, 16vw, 5.4rem);
  }
  .hero-name-reflection {
    display: none;
  }
  .hero-tagline {
    font-size: 0.96rem;
    margin-bottom: 2rem;
  }
  .surreal-window-portal {
    border-radius: 90px 90px 14px 14px;
  }
  .hero-actions {
    flex-direction: column;
    width: 100%;
    max-width: 320px;
    margin: 0 auto;
  }
  .hero-actions .tile-btn-primary,
  .hero-actions .tile-btn-secondary,
  .hero-actions .hero-audio-orb {
    width: 100%;
    justify-content: center;
  }
}
</style>
