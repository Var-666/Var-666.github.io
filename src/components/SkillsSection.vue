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
    label: '以太基石 · 核心引力域',
    sublabel: 'Gravitational Core · 构筑虚实界限与自洽微宇宙的坚实骨骼',
    tier: 'primary',
    symbol: '✦',
    skills: ['Vue.js', 'TypeScript', 'CSS / 动效系统', 'Node.js', 'Vite'],
  },
  {
    label: '炼金术仪器 · 趁手工程构件',
    sublabel: 'Alchemical Instruments · 自由调度、游刃有余的维度拓扑构件',
    tier: 'secondary',
    symbol: '⚙️',
    skills: ['React', 'Python', 'Git', 'Docker', 'Figma', 'Nuxt.js'],
  },
  {
    label: '微光探索 · 量子与异维触角',
    sublabel: 'Quantum Probes · 声波合成、三维流体与底层系统的新感知',
    tier: 'exploring',
    symbol: '🌌',
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
        <div class="surreal-kicker">✦ ARCHIPELAGO // 零重力浮岛与星宿</div>
        <h2 class="section-title">器物星宿 · 技能星图</h2>
        <p class="section-subtitle">不打冰冷的分数，只记录在零重力以太中悬浮运转、陪伴左右的语言、工具与好奇心</p>
      </div>

      <div class="skills-cabinet">
        <div
          v-for="(group, gi) in skillGroups"
          :key="group.tier"
          class="skill-tier-card tile-card surreal-portal-frame reveal"
          :class="[`tier-${group.tier}`, `delay-${gi + 1}`]"
        >
          <div class="tier-header">
            <div class="tier-title-row">
              <span class="tier-symbol">{{ group.symbol }}</span>
              <h3 class="tier-label">{{ group.label }}</h3>
              <span class="tier-badge">{{ group.tier === 'primary' ? '引力基石' : (group.tier === 'secondary' ? '炼金仪器' : '异维微光') }}</span>
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

    <!-- 转换至小木屋夜幕的以太过渡遮罩 -->
    <div class="skills-dusk-transition" aria-hidden="true"></div>
  </section>
</template>

<style scoped>
#skills {
  background-color: transparent;
  position: relative;
  padding-bottom: calc(var(--section-padding) + 40px);
}

.surreal-kicker {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  color: var(--color-ether-cyan);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 12px rgba(92, 225, 230, 0.5);
}

/* 虚实之门自然过渡至 3D 空间夜空 */
.skills-dusk-transition {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 140px;
  background: linear-gradient(180deg, transparent 0%, rgba(10, 11, 22, 0.5) 40%, rgba(26, 38, 30, 0.85) 85%, #1A261E 100%);
  pointer-events: none;
  z-index: 2;
}

/* 零重力星宿卡片列 */
.skills-cabinet {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.skill-tier-card {
  padding: 2.5rem 2.8rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.18);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  transition: transform 0.35s var(--ease-spring), border-color 0.35s var(--ease), box-shadow 0.35s var(--ease);
}

.skill-tier-card:hover {
  transform: translateY(-4px);
  border-color: rgba(92, 225, 230, 0.4);
  box-shadow: 0 26px 65px rgba(0, 0, 0, 0.7), 0 0 30px rgba(92, 225, 230, 0.18);
}

.tier-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tier-title-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.tier-symbol {
  font-size: 1rem;
  color: var(--color-ether-cyan);
  background: rgba(92, 225, 230, 0.1);
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-full);
  border: 1px solid rgba(92, 225, 230, 0.3);
  box-shadow: 0 0 12px rgba(92, 225, 230, 0.25);
}

.tier-label {
  font-family: var(--font-serif);
  font-size: 1.45rem;
  font-weight: 700;
  color: #FFFFFF;
}

.tier-badge {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  padding: 3px 12px;
  border-radius: var(--radius-full);
  font-weight: 500;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(10, 11, 22, 0.6);
  color: var(--color-text-muted);
}

.tier-primary .tier-badge {
  background: rgba(92, 225, 230, 0.12);
  color: var(--color-ether-cyan);
  border-color: rgba(92, 225, 230, 0.35);
  box-shadow: 0 0 10px rgba(92, 225, 230, 0.2);
}

.tier-secondary .tier-badge {
  background: rgba(247, 178, 103, 0.1);
  color: var(--color-solar-gold);
  border-color: rgba(247, 178, 103, 0.3);
}

.tier-exploring .tier-badge {
  background: rgba(214, 93, 177, 0.12);
  color: var(--color-dream-rose);
  border-color: rgba(214, 93, 177, 0.3);
}

.tier-sublabel {
  font-size: 0.88rem;
  color: var(--color-text-muted);
  line-height: 1.6;
}

/* 零重力悬浮技能晶片 (Floating Prism Chips) */
.skill-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.skill-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 10px 20px;
  background: rgba(10, 11, 22, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-full);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  color: #FFFFFF;
  font-size: 0.94rem;
  font-weight: 500;
  cursor: default;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  transition: transform 0.3s var(--ease-spring), background-color 0.3s var(--ease), border-color 0.3s var(--ease), box-shadow 0.3s var(--ease), color 0.3s var(--ease);
}

.skill-chip:hover {
  transform: translateY(-4px) scale(1.04);
  background: rgba(92, 225, 230, 0.12);
  border-color: var(--color-ether-cyan);
  color: var(--color-ether-cyan);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(92, 225, 230, 0.3);
}

.chip-point {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--color-ether-cyan);
  box-shadow: 0 0 8px var(--color-ether-cyan);
  transition: transform 0.3s var(--ease-spring);
}

.skill-chip:hover .chip-point {
  transform: scale(1.5);
}

/* 主力工具 */
.tier-primary .skill-chip {
  background: rgba(92, 225, 230, 0.06);
  border-color: rgba(92, 225, 230, 0.22);
}

.tier-primary .skill-chip:hover {
  border-color: var(--color-ether-cyan);
  background: rgba(92, 225, 230, 0.16);
}

/* 次级工具 */
.tier-secondary .chip-point {
  background: var(--color-solar-gold);
  box-shadow: 0 0 8px var(--color-solar-gold);
}

.tier-secondary .skill-chip:hover {
  border-color: var(--color-solar-gold);
  color: var(--color-solar-gold);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(247, 178, 103, 0.3);
}

/* 正在探索虚线 */
.tier-exploring .skill-chip {
  border-style: dashed;
  border-color: rgba(214, 93, 177, 0.3);
  color: var(--color-text);
}

.tier-exploring .chip-point {
  background: var(--color-dream-rose);
  box-shadow: 0 0 8px var(--color-dream-rose);
}

.tier-exploring .skill-chip:hover {
  border-color: var(--color-dream-rose);
  color: var(--color-dream-rose);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6), 0 0 20px rgba(214, 93, 177, 0.3);
}

@media (max-width: 768px) {
  .skill-tier-card {
    padding: 1.8rem 1.5rem;
  }
  .tier-title-row {
    gap: 10px;
  }
  .skill-chip {
    padding: 8px 16px;
    font-size: 0.88rem;
  }
}
</style>
