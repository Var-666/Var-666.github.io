<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useTextScramble } from '@/composables/useTextScramble'

const { output: displayName, scramble } = useTextScramble()
const mouseX = ref(-500)
const mouseY = ref(-500)
const isHovered = ref(false)

function onMouseMove(e: MouseEvent) {
  mouseX.value = e.clientX
  mouseY.value = e.clientY
}

function handleInteract() {
  scramble('var', 700)
}

onMounted(() => {
  displayName.value = 'var'
  window.addEventListener('mousemove', onMouseMove, { passive: true })
  // 初次进入页面时轻微扰动解码呈现
  setTimeout(() => {
    scramble('var', 800)
  }, 300)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', onMouseMove)
})
</script>

<template>
  <main class="name-stage">
    <!-- 跟随光标的微妙柔和光晕 -->
    <div
      class="ambient-glow"
      :style="{
        transform: `translate3d(${mouseX}px, ${mouseY}px, 0)`
      }"
      aria-hidden="true"
    ></div>

    <!-- 纯粹居中的名字画幅 -->
    <div class="name-container">
      <h1
        class="name-text"
        :class="{ 'is-active': isHovered }"
        @mouseenter="() => { isHovered = true; handleInteract(); }"
        @mouseleave="isHovered = false"
        @click="handleInteract"
        title="轻触扰动"
      >
        {{ displayName || 'var' }}
      </h1>
    </div>
  </main>
</template>

<style scoped>
.name-stage {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--c-bg, #FAF8F5);
  overflow: hidden;
  user-select: none;
}

.ambient-glow {
  position: absolute;
  top: -220px;
  left: -220px;
  width: 440px;
  height: 440px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(91, 140, 110, 0.12) 0%, rgba(200, 148, 74, 0.05) 45%, transparent 70%);
  pointer-events: none;
  filter: blur(45px);
  will-change: transform;
  transition: transform 0.12s ease-out;
}

.name-container {
  position: relative;
  z-index: 10;
  text-align: center;
}

.name-text {
  font-family: var(--f-serif, 'Noto Serif SC', 'Songti SC', serif);
  font-size: clamp(5.5rem, 25vw, 19rem);
  font-weight: 700;
  color: var(--c-text, #2C2C2E);
  letter-spacing: -0.04em;
  line-height: 0.95;
  margin: 0;
  padding: 0;
  cursor: pointer;
  transition: color 0.4s var(--ease, ease), transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
  will-change: transform, color;
}

.name-text:hover {
  transform: scale(1.04);
  color: var(--c-accent, #5B8C6E);
}

.name-text:active {
  transform: scale(0.97);
}
</style>
