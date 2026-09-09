<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import HeroSection from '@/components/HeroSection.vue'
import AboutSection from '@/components/AboutSection.vue'
import NowSection from '@/components/NowSection.vue'
import SkillsSection from '@/components/SkillsSection.vue'
import PortfolioSection from '@/components/PortfolioSection.vue'
import ContactSection from '@/components/ContactSection.vue'
import CustomCursor from '@/components/CustomCursor.vue'

const showBackToTop = ref(false)

function onScroll() {
  showBackToTop.value = window.scrollY > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onUnmounted(() => {
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <CustomCursor />
  <NavBar />
  <main>
    <HeroSection />
    <AboutSection />
    <NowSection />
    <SkillsSection />
    <PortfolioSection />
    <ContactSection />
  </main>

  <!-- Back to Top -->
  <Transition name="btt">
    <button
      v-if="showBackToTop"
      class="back-to-top"
      @click="scrollToTop"
      aria-label="回到顶部"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
    </button>
  </Transition>
</template>

<style>
.back-to-top {
  position: fixed;
  bottom: 32px;
  right: 32px;
  z-index: 900;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  border-radius: 50%;
  color: var(--color-accent);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  cursor: pointer;
  transition: all 0.3s var(--ease);
}

.back-to-top:hover {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
  transform: translateY(-3px);
  box-shadow:
    0 8px 24px var(--color-accent-glow-strong),
    0 0 40px var(--color-accent-glow);
}

.btt-enter-active { transition: all 0.4s var(--ease-spring); }
.btt-leave-active { transition: all 0.3s var(--ease); }
.btt-enter-from { opacity: 0; transform: translateY(16px) scale(0.8); }
.btt-leave-to { opacity: 0; transform: translateY(8px) scale(0.9); }
</style>
