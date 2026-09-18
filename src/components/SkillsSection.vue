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
        <p class="section-subtitle">不评分、只分层。记录在数字工坊中历练的核心技术与探索前沿</p>
      </div>

      <div class="skills-cabinet">
        <div
          v-for="(group, gi) in skillGroups"
          :key="group.tier"
          class="skill-tier-card tile-card reveal"
          :class="[`tier-${group.tier}`, `delay-${gi + 1}`]"
        >
          <div class="tier-header">
            <div class="tier-title-row">
              <span class="tier-index">0{{ gi + 1 }}</span>
              <h3 class="tier-label">{{ group.label }}</h3>
              <span class="tier-badge">{{ group.tier === 'primary' ? '核心驱动' : (group.tier === 'secondary' ? '日常构建' : '前沿探索') }}</span>
            </div>
            <p class="tier-sublabel">{{ group.sublabel }}</p>
          </div>

          <div class="skill-chips">
            <span
              v-for="skill in group.skills"
              :key="skill"
              class="skill-chip"
            >
              <span class="chip-point"></span>
              <span class="chip-name">{{ skill }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 转换至小木屋夜幕 (曜石墨黑) -->
    <div class="skills-wave">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 72" preserveAspectRatio="none">
        <path d="M0,36 C240,72 480,0 720,36 C960,72 1200,0 1440,36 L1440,72 L0,72 Z" fill="#131716"/>
      </svg>
    </div>
  </section>
</template>

<style scoped>
#skills {
  background-color: var(--color-base);
  position: relative;
  padding-bottom: calc(var(--section-padding) + 48px);
}

/* 波浪过渡到小木屋夜景 */
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

/* 标本抽屉瓷砖列 */
.skills-cabinet {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.skill-tier-card {
  padding: 2.2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.tier-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tier-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tier-index {
  font-family: var(--font-mono);
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-glaze-celadon);
  background: var(--color-bg-alt);
  padding: 2px 8px;
  border-radius: var(--radius-xs);
  border: 1px solid var(--color-grout);
}

.tier-label {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-ink);
}

.tier-badge {
  font-size: 0.72rem;
  padding: 2px 9px;
  border-radius: var(--radius-xs);
  font-weight: 500;
  border: 1px solid var(--color-grout);
  background: var(--color-bg-alt);
  color: var(--color-text-light);
}

.tier-primary .tier-badge {
  background: rgba(45, 90, 67, 0.08);
  color: var(--color-glaze-celadon);
  border-color: rgba(45, 90, 67, 0.2);
}

.tier-sublabel {
  font-size: 0.84rem;
  color: var(--color-text-lighter);
  line-height: 1.6;
}

/* 技能瓷片 */
.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-grout);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 1px 3px rgba(0, 0, 0, 0.02);
  color: var(--color-ink);
  font-size: 0.92rem;
  font-weight: 500;
  cursor: default;
  transition: transform var(--transition), background var(--transition), border-color var(--transition), box-shadow var(--transition);
}

.skill-chip:hover {
  transform: translateY(-2px);
  background: #FFFFFF;
  border-color: #D4D0C5;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 1), 0 6px 14px rgba(0, 0, 0, 0.05);
}

.chip-point {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-glaze-celadon);
}

/* 主力工具高亮样式 */
.tier-primary .skill-chip {
  background: #FFFFFF;
  border-color: #DCD8CC;
}

.tier-primary .skill-chip:hover {
  border-color: var(--color-glaze-celadon);
  color: var(--color-glaze-celadon-dark);
}

.tier-primary .chip-point {
  background: var(--color-glaze-celadon);
  box-shadow: 0 0 4px rgba(45, 90, 67, 0.4);
}

/* 正在探索虚线 */
.tier-exploring .skill-chip {
  border-style: dashed;
  color: var(--color-text-light);
}

.tier-exploring .chip-point {
  background: var(--color-terracotta);
}

@media (max-width: 768px) {
  .skill-tier-card {
    padding: 1.6rem 1.4rem;
  }
  .tier-title-row {
    gap: 8px;
  }
  .skill-chip {
    padding: 6px 12px;
    font-size: 0.85rem;
  }
}
</style>
