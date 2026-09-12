<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const cursorX = ref(0)
const cursorY = ref(0)
const ringX = ref(0)
const ringY = ref(0)
const isHover = ref(false)
const isPress = ref(false)
const isVisible = ref(false)

let rafId: number | null = null

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function onMove(e: MouseEvent) {
  cursorX.value = e.clientX
  cursorY.value = e.clientY
  if (!isVisible.value) isVisible.value = true

  const t = e.target as HTMLElement
  isHover.value = !!t.closest(
    'a, button, [data-hover], .skill-tag, .social-btn, .nav-link, .mobile-link, input, textarea'
  )
}

function animate() {
  ringX.value = lerp(ringX.value, cursorX.value, 0.10)
  ringY.value = lerp(ringY.value, cursorY.value, 0.10)
  rafId = requestAnimationFrame(animate)
}

function onDown() { isPress.value = true }
function onUp() { isPress.value = false }
function onLeaveDoc() { isVisible.value = false }
function onEnterDoc() { isVisible.value = true }

onMounted(() => {
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mousedown', onDown)
  document.addEventListener('mouseup', onUp)
  document.documentElement.addEventListener('mouseleave', onLeaveDoc)
  document.documentElement.addEventListener('mouseenter', onEnterDoc)
  animate()
})

onUnmounted(() => {
  document.removeEventListener('mousemove', onMove)
  document.removeEventListener('mousedown', onDown)
  document.removeEventListener('mouseup', onUp)
  document.documentElement.removeEventListener('mouseleave', onLeaveDoc)
  document.documentElement.removeEventListener('mouseenter', onEnterDoc)
  if (rafId) cancelAnimationFrame(rafId)
})
</script>

<template>
  <div class="custom-cursor" :class="{ visible: isVisible }" aria-hidden="true">
    <!-- 即时跟随的小圆点 -->
    <div
      class="cursor-dot"
      :class="{ hover: isHover, press: isPress }"
      :style="{ transform: `translate(${cursorX}px, ${cursorY}px)` }"
    />
    <!-- 延迟跟随的光环 -->
    <div
      class="cursor-ring"
      :class="{ hover: isHover, press: isPress }"
      :style="{ transform: `translate(${ringX}px, ${ringY}px)` }"
    />
  </div>
</template>

<style scoped>
.custom-cursor {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 99999;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.4s;
}

.custom-cursor.visible {
  opacity: 1;
}

/* 即时圆点 */
.cursor-dot {
  position: fixed;
  top: -4px;
  left: -4px;
  width: 8px;
  height: 8px;
  background: var(--color-accent);
  border-radius: 50%;
  will-change: transform;
  transition: width 0.35s var(--ease-spring),
              height 0.35s var(--ease-spring),
              top 0.35s var(--ease-spring),
              left 0.35s var(--ease-spring),
              opacity 0.3s;
  z-index: 2;
}

.cursor-dot.hover {
  width: 0;
  height: 0;
  top: 0;
  left: 0;
  opacity: 0;
}

/* 跟随光环 */
.cursor-ring {
  position: fixed;
  top: -22px;
  left: -22px;
  width: 44px;
  height: 44px;
  border: 1.5px solid rgba(124, 140, 110, 0.45);
  border-radius: 50%;
  will-change: transform;
  transition: width 0.45s var(--ease-spring),
              height 0.45s var(--ease-spring),
              top 0.45s var(--ease-spring),
              left 0.45s var(--ease-spring),
              border-color 0.3s,
              background-color 0.3s,
              backdrop-filter 0.3s;
  z-index: 1;
}

.cursor-ring.hover {
  width: 64px;
  height: 64px;
  top: -32px;
  left: -32px;
  border-color: var(--color-accent);
  background-color: rgba(124, 140, 110, 0.06);
  backdrop-filter: blur(2px);
}

.cursor-ring.press {
  width: 36px;
  height: 36px;
  top: -18px;
  left: -18px;
  border-color: var(--color-accent-light);
}

/* 仅桌面端展示 */
@media (hover: none), (max-width: 768px) {
  .custom-cursor {
    display: none !important;
  }
}
</style>
