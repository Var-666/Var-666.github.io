<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLiveStatus } from '@/composables/useLiveStatus'

const { timeStr, city } = useLiveStatus()

const scrolled = ref(false)
const isHidden = ref(false)
const mobileMenuOpen = ref(false)
const scrollProgress = ref(0)
const activeSection = ref('hero')

let lastScrollY = 0
const SCROLL_DELTA_THRESHOLD = 6 // 小抖动不触发，防止滚动吸附震颤

const navLinks = [
  { label: '首页', href: '#hero', id: 'hero' },
  { label: '关于', href: '#about', id: 'about' },
  { label: '近况', href: '#now', id: 'now' },
  { label: '技能', href: '#skills', id: 'skills' },
  { label: '小木屋 🌲', href: '#cabin', id: 'cabin' },
  { label: '联系', href: '#contact', id: 'contact' },
]

function handleScroll() {
  const currentY = window.scrollY
  scrolled.value = currentY > 40

  // 向下滚动缩小并自动滑出视口，向上滑动立即平滑浮现
  if (!mobileMenuOpen.value) {
    if (currentY <= 60) {
      isHidden.value = false
    } else if (currentY > lastScrollY + SCROLL_DELTA_THRESHOLD && currentY > 100) {
      // 正在向下滚动
      isHidden.value = true
    } else if (currentY < lastScrollY - SCROLL_DELTA_THRESHOLD) {
      // 正在向上轻微滚动
      isHidden.value = false
    }
  } else {
    isHidden.value = false
  }

  lastScrollY = Math.max(0, currentY)

  // 滚动进度条
  const total = document.documentElement.scrollHeight - window.innerHeight
  scrollProgress.value = total > 0 ? (currentY / total) * 100 : 0

  // 活跃板块检测
  const sections = ['contact', 'cabin', 'skills', 'now', 'about', 'hero']
  for (const id of sections) {
    const el = document.getElementById(id)
    if (el && el.getBoundingClientRect().top <= 150) {
      activeSection.value = id
      break
    }
  }
}

function scrollTo(href: string) {
  mobileMenuOpen.value = false
  const el = document.querySelector(href)
  el?.scrollIntoView({ behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
})
</script>

<template>
  <nav class="navbar" :class="{ scrolled, hidden: isHidden, 'menu-open': mobileMenuOpen }">
    <div class="nav-container container">
      <!-- Logo -->
      <a class="nav-logo" href="#hero" @click.prevent="scrollTo('#hero')">
        <span class="logo-icon">🌿</span>
        <span class="logo-text">var</span>
      </a>

      <!-- Desktop Links -->
      <ul class="nav-links">
        <li v-for="link in navLinks" :key="link.href">
          <a
            :href="link.href"
            class="nav-link"
            :class="{ active: activeSection === link.id }"
            @click.prevent="scrollTo(link.href)"
          >
            {{ link.label }}
          </a>
        </li>
      </ul>

      <!-- 实时微胶囊 (Live Pulse Pill) -->
      <button class="nav-live-pill" @click="scrollTo('#now')" aria-label="查看当前实时近况与生活状态" title="查看当前实时近况与生活状态">
        <span class="live-pulse-dot"></span>
        <span class="live-clock">{{ timeStr || '15:28' }}</span>
        <span class="live-city">{{ city }}</span>
      </button>

      <!-- Mobile Toggle -->
      <button
        class="mobile-toggle"
        :class="{ active: mobileMenuOpen }"
        @click="mobileMenuOpen = !mobileMenuOpen"
        aria-label="切换菜单"
        :aria-expanded="mobileMenuOpen"
      >
        <span></span>
        <span></span>
        <span></span>
      </button>
    </div>

    <!-- 滚动进度条 -->
    <div class="scroll-progress-track">
      <div
        class="scroll-progress-bar"
        :style="{ width: scrollProgress + '%' }"
      ></div>
    </div>

    <!-- Mobile Menu -->
    <div class="mobile-menu" :class="{ open: mobileMenuOpen }">
      <a
        v-for="link in navLinks"
        :key="link.href"
        :href="link.href"
        class="mobile-link"
        @click.prevent="scrollTo(link.href)"
      >
        {{ link.label }}
      </a>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  height: var(--nav-height);
  display: flex;
  align-items: center;
  background: rgba(248, 247, 242, 0.88);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(45, 65, 52, 0.08);
  transition: transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
              height 0.24s var(--ease),
              background-color 0.24s var(--ease),
              box-shadow 0.24s var(--ease),
              border-color 0.24s var(--ease);
  will-change: transform, height;
}

/* 向下滚动自动滑出视口 */
.navbar.hidden {
  transform: translateY(-100%);
}

/* 滚动紧凑态 */
.navbar.scrolled {
  height: 56px;
  background: rgba(255, 255, 255, 0.94);
  border-bottom: 1px solid rgba(45, 65, 52, 0.1);
  box-shadow: 0 4px 20px -2px rgba(45, 65, 52, 0.08);
}

.navbar.scrolled .logo-icon {
  width: 28px;
  height: 28px;
  font-size: 0.9rem;
}

.navbar.scrolled .logo-text {
  font-size: 1.15rem;
}

.navbar.scrolled .nav-link {
  padding: 5px 12px;
  font-size: 0.86rem;
}

.navbar.scrolled .nav-live-pill {
  padding: 4px 10px;
  font-size: 0.74rem;
}

.nav-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
}

/* Logo */
.nav-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1.2rem;
  color: var(--color-ink);
  transition: color var(--transition);
  z-index: 10;
}

.logo-icon {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-surface-sunken);
  color: var(--color-forest);
  border-radius: var(--radius-sm);
  font-size: 1.1rem;
  box-shadow: 0 2px 8px rgba(45, 65, 52, 0.08);
  transition: transform var(--transition-spring), background-color var(--transition-spring);
}

.nav-logo:hover .logo-icon {
  transform: rotate(-6deg) scale(1.08);
}

.nav-logo:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 4px;
}

.logo-text {
  letter-spacing: 0.02em;
  font-family: var(--font-sans);
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--color-ink);
}

/* Desktop Links */
.nav-links {
  display: flex;
  gap: 6px;
  align-items: center;
}

.nav-link {
  padding: 6px 14px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--color-text-light);
  border-radius: var(--radius-full);
  transition: color var(--transition), background-color var(--transition);
  letter-spacing: 0.01em;
  position: relative;
}

.nav-link:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 2px;
}

.nav-link:hover {
  color: var(--color-forest);
  background: rgba(62, 107, 72, 0.06);
}

/* 活跃链接指示 */
.nav-link.active {
  color: var(--color-forest);
  font-weight: 600;
  background: rgba(62, 107, 72, 0.09);
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 12px;
  height: 2px;
  background: var(--color-forest);
  border-radius: var(--radius-full);
}

/* 滚动进度条 */
.scroll-progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2.5px;
  background: transparent;
}

.scroll-progress-bar {
  height: 100%;
  background: var(--color-forest);
  transition: width 0.08s linear;
}

.mobile-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  z-index: 10;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: var(--radius-xs);
}

.mobile-toggle:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 2px;
}

.mobile-toggle span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-ink);
  border-radius: var(--radius-full);
  transition: transform var(--transition), opacity var(--transition);
}

.mobile-toggle.active span:nth-child(1) {
  transform: rotate(45deg) translate(5px, 5px);
}

.mobile-toggle.active span:nth-child(2) {
  opacity: 0;
}

.mobile-toggle.active span:nth-child(3) {
  transform: rotate(-45deg) translate(5px, -5px);
}

/* ── 实时状态微胶囊 ── */
.nav-live-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 14px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-full);
  box-shadow: 0 2px 8px rgba(45, 65, 52, 0.04);
  color: var(--color-ink);
  font-size: 0.78rem;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: border-color var(--transition), background-color var(--transition), transform var(--transition), box-shadow var(--transition);
}

.nav-live-pill:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 2px;
}

.nav-live-pill:hover {
  border-color: var(--color-forest);
  background: #FFFFFF;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(45, 65, 52, 0.08);
}

.live-pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #10B981;
  box-shadow: 0 0 8px #10B981;
  animation: pulse-ring 2s infinite;
}

@keyframes pulse-ring {
  0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.6); }
  70% { box-shadow: 0 0 0 5px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.live-clock {
  color: var(--color-ink);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.live-city {
  font-family: var(--font-sans);
  color: var(--color-text-light);
  font-size: 0.74rem;
}

@media (max-width: 900px) {
  .nav-live-pill {
    display: none;
  }
}

/* Mobile Menu */
.mobile-menu {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(248, 247, 242, 0.98);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition);
}

.mobile-menu.open {
  opacity: 1;
  pointer-events: all;
}

.mobile-link {
  font-family: var(--font-sans);
  font-weight: 600;
  font-size: 1.35rem;
  color: var(--color-ink);
  padding: 10px 24px;
  border-radius: var(--radius-full);
  text-decoration: none;
  transition: color var(--transition), background-color var(--transition);
}

.mobile-link:focus-visible {
  outline: 2px solid var(--color-forest);
  outline-offset: 2px;
}

.mobile-link:hover {
  color: var(--color-forest);
  background: rgba(62, 107, 72, 0.08);
}

@media (max-width: 768px) {
  .nav-links {
    display: none;
  }

  .mobile-toggle {
    display: flex;
  }

  .mobile-menu {
    display: flex;
  }

  .navbar.scrolled {
    height: 52px;
  }
}
</style>
