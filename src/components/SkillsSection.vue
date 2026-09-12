<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'

const sectionRef = ref<HTMLElement | null>(null)
const { observeAll } = useScrollReveal()

interface SkillGroup {
  label: string
  sublabel: string
  tier: 'primary' | 'secondary' | 'exploring'
  skills: string[]
}

const skillGroups: SkillGroup[] = [
  {
    label: '主力工具',
    sublabel: 'Primary Stack · 日常驱动创作的核心技术',
    tier: 'primary',
    skills: ['Vue.js', 'TypeScript', 'CSS / 动画', 'Node.js', 'Vite'],
  },
  {
    label: '熟悉使用',
    sublabel: 'Comfortable With · 能进能出的工具层',
    tier: 'secondary',
    skills: ['React', 'Python', 'Git', 'Docker', 'Figma', 'Nuxt.js'],
  },
  {
    label: '正在探索',
    sublabel: 'Exploring · 对未知的好奇',
    tier: 'exploring',
    skills: ['Web Audio API', 'WebGL / Three.js', 'Rust', 'Edge Functions'],
  },
]

onMounted(() => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-left, .reveal-up', sectionRef.value)
  }
})
</script>

<template>
  <section id="skills" class="section" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">技能与工具</h2>
        <p class="section-subtitle">不评分，只分层</p>
      </div>

      <div class="skill-groups">
        <div
          v-for="(group, gi) in skillGroups"
          :key="group.tier"
          class="skill-group reveal"
          :class="[`tier-${group.tier}`, `delay-${gi + 1}`]"
        >
          <div class="group-header">
            <div class="group-label-wrap">
              <span class="group-dot"></span>
              <h3 class="group-label">{{ group.label }}</h3>
            </div>
            <span class="group-sublabel">{{ group.sublabel }}</span>
          </div>

          <div class="skill-tags">
            <span
              v-for="skill in group.skills"
              :key="skill"
              class="skill-tag"
            >
              {{ skill }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 波浪过渡至林中小屋夜幕 -->
    <div class="skills-wave">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 72" preserveAspectRatio="none">
        <path d="M0,36 C240,72 480,0 720,36 C960,72 1200,0 1440,36 L1440,72 L0,72 Z" fill="#19211e"/>
      </svg>
    </div>
  </section>
</template>

<style scoped>
#skills {
  background-color: var(--color-bg);
  position: relative;
  padding-bottom: calc(var(--section-padding) + 36px);
}

/* 波浪过渡 */
.skills-wave {
  position: absolute;
  bottom: -1px;
  left: 0;
  right: 0;
  z-index: 4;
  pointer-events: none;
  line-height: 0;
}

.skills-wave svg {
  width: 100%;
  height: 72px;
  display: block;
}

.skill-groups {
  display: flex;
  flex-direction: column;
  gap: 0;
}

/* 每一组的容器 */
.skill-group {
  padding: 2.8rem 0;
  border-bottom: 1px solid var(--border-light);
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.skill-group:last-child {
  border-bottom: none;
}

/* 组标题行 */
.group-header {
  display: flex;
  align-items: baseline;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.group-label-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: transform 0.3s var(--ease-spring);
}

.skill-group:hover .group-dot {
  transform: scale(1.4);
}

.group-label {
  font-family: var(--font-serif);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.group-sublabel {
  font-size: 0.82rem;
  color: var(--color-text-lighter);
  font-weight: 300;
  letter-spacing: 0.04em;
}

/* 标签云 */
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.skill-tag {
  border-radius: var(--radius-full);
  font-weight: 500;
  letter-spacing: 0.04em;
  transition: all 0.25s var(--ease);
  cursor: default;
}

/* ── 主力工具 Tier ── */
.tier-primary .group-dot {
  background: var(--color-accent);
  box-shadow: 0 0 0 3px var(--color-accent-glow);
}

.tier-primary .group-label {
  font-size: 1.5rem;
  color: var(--color-text);
}

.tier-primary .skill-tag {
  padding: 9px 22px;
  font-size: 0.95rem;
  background: var(--color-accent);
  color: #fff;
  box-shadow: 0 2px 12px var(--color-accent-glow);
}

.tier-primary .skill-tag:hover {
  background: var(--color-accent-dark);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--color-accent-glow-strong);
}

/* ── 熟悉使用 Tier ── */
.tier-secondary .group-dot {
  background: transparent;
  border: 2px solid var(--color-warm);
}

.tier-secondary .group-label {
  font-size: 1.2rem;
  color: var(--color-text);
}

.tier-secondary .skill-tag {
  padding: 7px 18px;
  font-size: 0.88rem;
  background: transparent;
  color: var(--color-text-light);
  border: 1px solid var(--border-medium);
}

.tier-secondary .skill-tag:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
  transform: translateY(-1px);
}

/* ── 正在探索 Tier ── */
.tier-exploring .group-dot {
  background: transparent;
  border: 1.5px dashed var(--color-text-lighter);
}

.tier-exploring .group-label {
  font-size: 1rem;
  color: var(--color-text-lighter);
}

.tier-exploring .group-sublabel {
  font-style: italic;
}

.tier-exploring .skill-tag {
  padding: 5px 14px;
  font-size: 0.8rem;
  background: transparent;
  color: var(--color-text-lighter);
  border: 1px dashed var(--color-text-lighter);
  font-weight: 400;
}

.tier-exploring .skill-tag:hover {
  border-color: var(--color-accent-light);
  color: var(--color-accent);
  border-style: solid;
}

@media (max-width: 768px) {
  .skill-group { padding: 2rem 0; }
  .group-header { flex-direction: column; gap: 0.4rem; }
  .tier-primary .group-label { font-size: 1.2rem; }
  .tier-secondary .group-label { font-size: 1rem; }
  .tier-primary .skill-tag { padding: 7px 16px; font-size: 0.88rem; }
}
</style>
