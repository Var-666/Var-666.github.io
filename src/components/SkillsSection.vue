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
    label: '日常主力 · 前端核心',
    sublabel: '构建用户界面与交互体验的核心工具栈，用得最多、最顺手',
    tier: 'primary',
    symbol: '◆',
    skills: ['Vue.js', 'TypeScript', 'CSS / 动效系统', 'Node.js', 'Vite'],
  },
  {
    label: '工程构件 · 趁手工具',
    sublabel: '日常开发、构建与设计协作不可或缺的辅助工具',
    tier: 'secondary',
    symbol: '⚙️',
    skills: ['React', 'Python', 'Git', 'Docker', 'Figma', 'Nuxt.js'],
  },
  {
    label: '正在探索 · 新的可能',
    sublabel: '最近业余时间在深入把玩的技术方向与实验',
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
        <h2 class="section-title">技能与工具</h2>
        <p class="section-subtitle">不给技能打冰冷的分数，只记录日常陪伴左右的语言、框架与持续探索的好奇心</p>
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
              <span class="tier-badge">{{ group.tier === 'primary' ? '主力核心' : (group.tier === 'secondary' ? '常用工具' : '正在探索') }}</span>
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

    <!-- 转换至小木屋夜幕的平滑过渡遮罩 -->
    <div class="skills-dusk-transition" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
#skills {
  background-color: transparent;
  position: relative;
  padding-bottom: calc(var(--section-padding) + 40px);
}

/* 自然过渡至 3D 小木屋夜空 */
.skills-dusk-transition {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 150px;
  background: linear-gradient(180deg, transparent 0%, rgba(26, 38, 30, 0.4) 40%, rgba(26, 38, 30, 0.85) 80%, #1A261E 100%);
  pointer-events: none;
  z-index: 2;
}

.skills-cabinet {
  display: flex;
  flex-direction: column;
  gap: 1.8rem;
}

.skill-tier-card {
  padding: 2.2rem 2.6rem;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  box-shadow: var(--tile-shadow);
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease), box-shadow 0.35s var(--ease);
}

.skill-tier-card:hover {
  transform: translateY(-3px);
  border-color: rgba(91, 140, 110, 0.3);
  box-shadow: var(--tile-shadow-hover);
}

.tier-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tier-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.tier-symbol {
  font-size: 0.95rem;
  color: var(--color-accent);
  background: var(--color-accent-soft);
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid rgba(91, 140, 110, 0.2);
}

.tier-label {
  font-family: var(--font-serif);
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--color-ink);
}

.tier-badge {
  font-size: 0.74rem;
  padding: 3px 12px;
  border-radius: var(--radius-full);
  font-weight: 500;
  border: 1px solid var(--color-border);
  background: var(--color-bg-alt);
  color: var(--color-text-light);
}

.tier-primary .tier-badge {
  background: var(--color-accent-soft);
  color: var(--color-accent);
  border-color: rgba(91, 140, 110, 0.25);
}

.tier-secondary .tier-badge {
  background: rgba(200, 148, 74, 0.1);
  color: var(--color-amber);
  border-color: rgba(200, 148, 74, 0.25);
}

.tier-exploring .tier-badge {
  background: var(--color-bg-alt);
  color: var(--color-text-light);
  border-color: var(--color-border);
}

.tier-sublabel {
  font-size: 0.88rem;
  color: var(--color-text-light);
  line-height: 1.6;
}

/* 技能芯片 */
.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 18px;
  background: var(--color-bg-alt);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  color: var(--color-ink);
  font-size: 0.92rem;
  font-weight: 500;
  cursor: default;
  transition: transform 0.25s var(--ease-spring), background-color 0.25s var(--ease), border-color 0.25s var(--ease), color 0.25s var(--ease);
}

.skill-chip:hover {
  transform: translateY(-2px);
  background: var(--color-accent-soft);
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.chip-point {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
}

/* 主力工具 */
.tier-primary .skill-chip:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

/* 次级工具 */
.tier-secondary .chip-point {
  background: var(--color-amber);
}

.tier-secondary .skill-chip:hover {
  border-color: var(--color-amber);
  color: var(--color-amber);
  background: rgba(200, 148, 74, 0.08);
}

/* 探索工具 */
.tier-exploring .skill-chip {
  border-style: dashed;
}

.tier-exploring .chip-point {
  background: var(--color-text-lighter);
}

.tier-exploring .skill-chip:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background: var(--color-accent-soft);
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
    font-size: 0.86rem;
  }
}
</style>
