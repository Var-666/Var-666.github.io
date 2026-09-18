<script setup lang="ts">
import { ref, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import NavBar from '@/components/NavBar.vue'
import HeroSection from '@/components/HeroSection.vue'
import AboutSection from '@/components/AboutSection.vue'
import NowSection from '@/components/NowSection.vue'
import SkillsSection from '@/components/SkillsSection.vue'
import ContactSection from '@/components/ContactSection.vue'
import CustomCursor from '@/components/CustomCursor.vue'
import MusicPlayer from '@/components/MusicPlayer.vue'

const CabinSection = defineAsyncComponent(() => import('@/components/CabinSection.vue'))

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
    <CabinSection />
    <ContactSection />
  </main>

  <MusicPlayer />

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
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tile-bg);
  border: 1px solid var(--tile-border);
  border-radius: var(--radius-sm);
  color: var(--color-ink);
  box-shadow: var(--tile-shadow);
  cursor: pointer;
  transition: transform var(--transition), background var(--transition), color var(--transition), box-shadow var(--transition);
}

.back-to-top:focus-visible {
  outline: 2px solid var(--color-glaze-celadon);
  outline-offset: 2px;
}

.back-to-top:hover {
  background: var(--color-glaze-celadon);
  color: #FFFFFF;
  border-color: var(--color-glaze-celadon-dark);
  transform: translateY(-2px);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.25), 0 6px 18px rgba(45, 90, 67, 0.3);
}

.btt-enter-active { transition: opacity 0.3s var(--ease-spring), transform 0.3s var(--ease-spring); }
.btt-leave-active { transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.btt-enter-from { opacity: 0; transform: translateY(12px) scale(0.9); }
.btt-leave-to { opacity: 0; transform: translateY(8px) scale(0.9); }
</style>
