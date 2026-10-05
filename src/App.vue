<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import NavBar from '@/components/NavBar.vue'
import HeroSection from '@/components/HeroSection.vue'
import NowSection from '@/components/NowSection.vue'
import SkillsSection from '@/components/SkillsSection.vue'
import ContactSection from '@/components/ContactSection.vue'
import CustomCursor from '@/components/CustomCursor.vue'
import MusicPlayer from '@/components/MusicPlayer.vue'

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
    <NowSection />
    <SkillsSection />
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
  bottom: var(--sp-8);
  right: var(--sp-8);
  z-index: 900;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--c-border);
  border-radius: var(--r-full);
  color: var(--c-text);
  box-shadow: var(--shadow-md);
  cursor: pointer;
  transition: transform var(--dur) var(--ease), background var(--dur) var(--ease), color var(--dur) var(--ease), box-shadow var(--dur) var(--ease), border-color var(--dur) var(--ease);
}

.back-to-top:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 3px;
}

.back-to-top:hover {
  background: var(--c-accent);
  color: #FFFFFF;
  border-color: var(--c-accent);
  transform: translateY(-3px);
  box-shadow: 0 10px 24px rgba(91, 140, 110, 0.3);
}

.btt-enter-active { transition: opacity 0.3s var(--ease-spring), transform 0.3s var(--ease-spring); }
.btt-leave-active { transition: opacity 0.2s var(--ease), transform 0.2s var(--ease); }
.btt-enter-from { opacity: 0; transform: translateY(12px) scale(0.9); }
.btt-leave-to { opacity: 0; transform: translateY(8px) scale(0.9); }
</style>
