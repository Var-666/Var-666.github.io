<script setup lang="ts">
import NavBar from '@/components/NavBar.vue'
import HeroSection from '@/components/HeroSection.vue'
import AboutSection from '@/components/AboutSection.vue'
import NowSection from '@/components/NowSection.vue'
import SkillsSection from '@/components/SkillsSection.vue'
import PortfolioSection from '@/components/PortfolioSection.vue'
import ContactSection from '@/components/ContactSection.vue'
</script>

<template>
  <NavBar />
  <main>
    <HeroSection />
    <AboutSection />
    <NowSection />
    <SkillsSection />
    <PortfolioSection />
    <ContactSection />
  </main>
</template>
