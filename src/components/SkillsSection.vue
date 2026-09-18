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
    label: '主力与日常技术栈',
    sublabel: 'Daily Crafts · 构筑稳固架构与灵动画面的核心手艺',
    tier: 'primary',
    symbol: '🌿',
    skills: ['Vue.js', 'TypeScript', 'CSS / 动效系统', 'Node.js', 'Vite'],
  },
  {
    label: '趁手开发工具',
    sublabel: 'Fluent Tools · 得心应手、自由协作的工程伙伴',
    tier: 'secondary',
    symbol: '🛠️',
    skills: ['React', 'Python', 'Git', 'Docker', 'Figma', 'Nuxt.js'],
  },
  {
    label: '探索与好奇心',
    sublabel: 'Curiosity & Play · 声音、3D 空间与底层系统的新触角',
    tier: 'exploring',
    symbol: '🌱',
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
        <h2 class="section-title">常用手艺与工具</h2>
        <p class="section-subtitle">不打冰冷的分数，只记录在日常构筑数字世界时，陪伴左右的语言、工具与好奇心</p>
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
              <span class="tier-badge">{{ group.tier === 'primary' ? '日常主力' : (group.tier === 'secondary' ? '常用工具' : '正在探索') }}</span>
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

    <!-- 转换至小木屋林间夜幕的暮色过渡遮罩 -->
    <div class="skills-dusk-transition" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
#skills {
  background-color: var(--color-base);
  position: relative;
  padding-bottom: calc(var(--section-padding) + 40px);
}

/* 暮色天幕自然过渡至 3D 小木屋夜空 (#1A261E) */
.skills-dusk-transition {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(180deg, transparent 0%, rgba(26, 38, 30, 0.35) 40%, rgba(26, 38, 30, 0.85) 80%, #1A261E 100%);
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
  color: var(--color-forest);
  background: rgba(62, 107, 72, 0.08);
  width: 30px;
  height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(62, 107, 72, 0.16);
}

.tier-label {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--color-ink);
}

.tier-badge {
  font-size: 0.72rem;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-surface-sunken);
  color: var(--color-text-light);
}

.tier-primary .tier-badge {
  background: rgba(62, 107, 72, 0.09);
  color: var(--color-forest);
  border-color: rgba(62, 107, 72, 0.22);
}

.tier-secondary .tier-badge {
  background: var(--color-surface-sunken);
  color: var(--color-text-light);
  border-color: var(--color-border);
}

.tier-exploring .tier-badge {
  background: rgba(217, 155, 75, 0.1);
  color: #B4782A;
  border-color: rgba(217, 155, 75, 0.25);
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
  background: var(--color-surface-sunken);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  color: var(--color-ink);
  font-size: 0.92rem;
  font-weight: 500;
  cursor: default;
  transition: transform var(--transition), background-color var(--transition), border-color var(--transition), box-shadow var(--transition), color var(--transition);
}

.skill-chip:hover {
  transform: translateY(-2px);
  background: #FFFFFF;
  border-color: var(--color-forest);
  color: var(--color-forest);
  box-shadow: 0 6px 16px rgba(36, 51, 41, 0.08);
}

.chip-point {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-forest);
  box-shadow: 0 0 6px rgba(62, 107, 72, 0.35);
  transition: transform var(--transition);
}

.skill-chip:hover .chip-point {
  transform: scale(1.4);
}

/* 主力工具高亮样式 */
.tier-primary .skill-chip {
  background: rgba(62, 107, 72, 0.04);
  border-color: rgba(62, 107, 72, 0.16);
}

.tier-primary .skill-chip:hover {
  border-color: var(--color-forest);
  background: rgba(62, 107, 72, 0.1);
}

/* 正在探索虚线 */
.tier-exploring .skill-chip {
  border-style: dashed;
  color: var(--color-text-light);
}

.tier-exploring .chip-point {
  background: var(--color-sunlit);
  box-shadow: 0 0 6px rgba(217, 155, 75, 0.4);
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
