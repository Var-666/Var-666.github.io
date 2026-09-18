<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'

const sectionRef = ref<HTMLElement | null>(null)
const { observeAll } = useScrollReveal()

interface SkillGroup {
  label: string
  sublabel: string
  tier: 'primary' | 'secondary' | 'exploring'
  symbol: string
  skills: string[]
}

const skillGroups: SkillGroup[] = [
  {
    label: '主力核心器物',
    sublabel: 'Core Stack · 日常驱动架构与交互的核心手艺',
    tier: 'primary',
    symbol: '✦',
    skills: ['Vue.js', 'TypeScript', 'CSS / 动效体系', 'Node.js', 'Vite'],
  },
  {
    label: '趁手工具箱',
    sublabel: 'Fluent Tools · 能进能出、得心应手的工程利器',
    tier: 'secondary',
    symbol: '◈',
    skills: ['React', 'Python', 'Git', 'Docker', 'Figma', 'Nuxt.js'],
  },
  {
    label: '前沿探针',
    sublabel: 'Frontier Probes · 对声音、3D 空间与系统底层的求知欲',
    tier: 'exploring',
    symbol: '✧',
    skills: ['Web Audio API', 'WebGL / Three.js', 'Rust', 'Edge Functions'],
  },
]

const activeHoveredSkill = ref<string | null>(null)

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
        <h2 class="section-title">技能与器物</h2>
        <p class="section-subtitle">不打标签评分，只按器物分层。记录在数字工坊中千锤百炼的手艺与前沿探索</p>
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
              <span class="tier-symbol">{{ group.symbol }}</span>
              <h3 class="tier-label">{{ group.label }}</h3>
              <span class="tier-badge">{{ group.tier === 'primary' ? '核心驱动' : (group.tier === 'secondary' ? '趁手工具' : '前沿探索') }}</span>
            </div>
            <p class="tier-sublabel">{{ group.sublabel }}</p>
          </div>

          <div class="skill-chips">
            <span
              v-for="skill in group.skills"
              :key="skill"
              class="skill-chip"
              :class="{ 'is-hovered': activeHoveredSkill === skill }"
              @mouseenter="activeHoveredSkill = skill"
              @mouseleave="activeHoveredSkill = null"
            >
              <span class="chip-point"></span>
              <span class="chip-name">{{ skill }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- 转换至小木屋夜幕的暮色天幕过渡 -->
    <div class="skills-dusk-transition" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
#skills {
  background-color: var(--color-base);
  position: relative;
  padding-bottom: calc(var(--section-padding) + 30px);
}

/* 暮色天幕自然过渡至 3D 小木屋夜空 */
.skills-dusk-transition {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  background: linear-gradient(180deg, transparent 0%, rgba(19, 23, 22, 0.65) 50%, #131716 100%);
  pointer-events: none;
  z-index: 2;
}

/* 标本抽屉卡片列 */
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

.tier-symbol {
  font-size: 1rem;
  color: var(--color-amber);
  background: rgba(230, 197, 148, 0.08);
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xs);
  border: 1px solid rgba(230, 197, 148, 0.2);
}

.tier-label {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-ink);
}

.tier-badge {
  font-size: 0.72rem;
  padding: 2px 10px;
  border-radius: var(--radius-xs);
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-light);
}

.tier-primary .tier-badge {
  background: rgba(230, 197, 148, 0.1);
  color: var(--color-amber);
  border-color: rgba(230, 197, 148, 0.25);
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
  padding: 9px 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: var(--color-ink);
  font-size: 0.92rem;
  font-weight: 500;
  cursor: default;
  transition: transform var(--transition), background-color var(--transition), border-color var(--transition), box-shadow var(--transition), color var(--transition);
}

.skill-chip:hover {
  transform: translateY(-2px);
  background: rgba(255, 255, 255, 0.07);
  border-color: rgba(230, 197, 148, 0.4);
  color: var(--color-amber);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}

.chip-point {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-amber);
  box-shadow: 0 0 6px var(--color-amber);
  transition: transform var(--transition);
}

.skill-chip:hover .chip-point {
  transform: scale(1.4);
}

/* 主力工具高亮样式 */
.tier-primary .skill-chip {
  background: rgba(230, 197, 148, 0.04);
  border-color: rgba(230, 197, 148, 0.16);
}

.tier-primary .skill-chip:hover {
  border-color: var(--color-amber);
  background: rgba(230, 197, 148, 0.1);
}

/* 正在探索虚线 */
.tier-exploring .skill-chip {
  border-style: dashed;
  color: var(--color-text-light);
}

.tier-exploring .chip-point {
  background: var(--color-celadon);
  box-shadow: 0 0 6px var(--color-celadon);
}

@media (max-width: 768px) {
  .skill-tier-card {
    padding: 1.6rem 1.4rem;
  }
  .tier-title-row {
    gap: 8px;
  }
  .skill-chip {
    padding: 7px 14px;
    font-size: 0.85rem;
  }
}
</style>
