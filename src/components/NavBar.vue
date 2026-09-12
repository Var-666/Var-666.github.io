<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useLiveStatus } from '@/composables/useLiveStatus'

const { timeStr, city } = useLiveStatus()

const scrolled = ref(false)
const mobileMenuOpen = ref(false)
const scrollProgress = ref(0)
const activeSection = ref('hero')

const navLinks = [
  { label: '首页', href: '#hero', id: 'hero' },
  { label: '关于', href: '#about', id: 'about' },
  { label: '近况', href: '#now', id: 'now' },
  { label: '技能', href: '#skills', id: 'skills' },
  { label: '小木屋 🌲', href: '#cabin', id: 'cabin' },
  { label: '联系', href: '#contact', id: 'contact' },
]

function handleScroll() {
  scrolled.value = window.scrollY > 50

  // 滚动进度条
  const total = document.documentElement.scrollHeight - window.innerHeight
  scrollProgress.value = total > 0 ? (window.scrollY / total) * 100 : 0

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
  <nav class="navbar" :class="{ scrolled, 'menu-open': mobileMenuOpen }">
    <div class="nav-container container">
      <!-- Logo -->
      <a class="nav-logo" href="#hero" @click.prevent="scrollTo('#hero')">
        <span class="logo-icon">&gt;_</span>
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
      <button class="nav-live-pill" @click="scrollTo('#now')" title="查看当前实时近况与生活状态">
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
  transition: all var(--transition);
}

.navbar.scrolled {
  background: rgba(245, 240, 235, 0.75);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 2px 20px rgba(0, 0, 0, 0.04);
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
  font-family: var(--font-serif);
  font-weight: 600;
  font-size: 1.2rem;
  color: var(--color-text-inv);
  transition: color var(--transition);
  z-index: 10;
}

.navbar.scrolled .nav-logo {
  color: var(--color-text);
}

.logo-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  color: white;
  border-radius: var(--radius-sm);
  font-size: 0.85rem;
  font-family: 'Courier New', monospace;
  transition: all var(--transition-spring);
}

.nav-logo:hover .logo-icon {
  transform: rotate(-8deg) scale(1.1);
  box-shadow: 0 4px 16px var(--color-accent-glow-strong);
  border-radius: var(--radius);
}

.logo-text {
  letter-spacing: 0.08em;
  font-family: 'Courier New', monospace;
  font-size: 1.3rem;
}

/* Desktop Links */
.nav-links {
  display: flex;
  gap: 6px;
  align-items: center;
}

.nav-link {
  padding: 8px 18px;
  font-size: 0.92rem;
  font-weight: 400;
  color: rgba(245, 240, 235, 0.65);
  border-radius: var(--radius-full);
  transition: all var(--transition);
  letter-spacing: 0.04em;
  position: relative;
}

.navbar.scrolled .nav-link {
  color: var(--color-text-light);
}

.nav-link:hover {
  color: var(--color-text-inv);
  background: rgba(255, 255, 255, 0.1);
}

.navbar.scrolled .nav-link:hover {
  color: var(--color-accent);
  background: rgba(124, 140, 110, 0.08);
}

/* 活跃链接指示器 */
.nav-link.active {
  color: var(--color-accent-light);
}

.navbar.scrolled .nav-link.active {
  color: var(--color-accent);
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 2px;
  background: var(--color-accent);
  border-radius: var(--radius-full);
  animation: indicator-in 0.3s var(--ease-spring);
}

@keyframes indicator-in {
  from { width: 0; opacity: 0; }
  to { width: 16px; opacity: 1; }
}

/* 滚动进度条 */
.scroll-progress-track {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: transparent;
}

.scroll-progress-bar {
  height: 100%;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-light), var(--color-warm));
  border-radius: 0 var(--radius-full) var(--radius-full) 0;
  transition: width 0.08s linear;
  box-shadow: 0 0 8px var(--color-accent-glow);
}

/* Mobile Toggle */
.mobile-toggle {
  display: none;
  flex-direction: column;
  gap: 5px;
  padding: 8px;
  z-index: 10;
}

.mobile-toggle span {
  display: block;
  width: 22px;
  height: 2px;
  background: var(--color-text-inv);
  border-radius: var(--radius-full);
  transition: all var(--transition);
}

.navbar.scrolled .mobile-toggle span {
  background: var(--color-text);
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
  gap: 7px;
  padding: 5px 12px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-full);
  color: var(--color-text-inv);
  font-size: 0.78rem;
  font-family: var(--font-mono);
  cursor: pointer;
  transition: all var(--transition);
  backdrop-filter: blur(8px);
}

.nav-live-pill:hover {
  background: rgba(255, 255, 255, 0.14);
  border-color: var(--color-accent-light);
  transform: translateY(-1px);
}

.navbar.scrolled .nav-live-pill {
  background: rgba(0, 0, 0, 0.04);
  border-color: rgba(0, 0, 0, 0.1);
  color: var(--color-text);
}

.navbar.scrolled .live-clock {
  color: var(--color-text);
}

.navbar.scrolled .live-city {
  color: var(--color-text-light);
}

.navbar.scrolled .nav-live-pill:hover {
  background: rgba(124, 140, 110, 0.08);
  border-color: var(--color-accent);
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
  70% { box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
  100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
}

.live-clock {
  color: var(--color-text-inv);
  font-weight: 600;
}

.live-city {
  font-family: var(--font-sans);
  color: var(--color-text-inv-light);
  font-size: 0.72rem;
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
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  opacity: 0;
  pointer-events: none;
  transition: opacity var(--transition);
}

.mobile-menu.open {
  opacity: 1;
  pointer-events: all;
}

.mobile-link {
  font-family: var(--font-serif);
  font-size: 1.5rem;
  color: var(--color-text-inv);
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  letter-spacing: 0.05em;
}

.mobile-link:hover {
  color: var(--color-accent-light);
  background: rgba(255, 255, 255, 0.05);
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

  .navbar.menu-open .mobile-toggle span {
    background: var(--color-text-inv);
  }
}
</style>
