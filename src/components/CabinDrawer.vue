<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCabinStore } from '@/composables/useCabinStore'

const {
  activeDrawer,
  discoveries,
  discoveredCount,
  totalTargetCount,
  closeDrawer,
} = useCabinStore()

const currentFilter = ref('All')

// 项目列表数据（与本站实际项目完全对应）
const projects = [
  {
    id: 1,
    title: '山水画廊 (Isle of Ideas)',
    category: 'Creative',
    desc: '中国山水画数字艺术平台，WebGL 高清画卷缩放与沉浸式鉴赏体验。',
    tags: ['Vue.js', 'Canvas', 'WebGL', '艺术'],
    bgGrad: 'linear-gradient(135deg, #4b6584, #778ca3)',
    icon: '🏔️',
  },
  {
    id: 2,
    title: '知行笔记 (Little Tools)',
    category: 'Tools',
    desc: '本地优先架构的极简个人效率工具，利用 IndexedDB 毫秒级存储记录思考。',
    tags: ['TypeScript', 'IndexedDB', 'CRDT'],
    bgGrad: 'linear-gradient(135deg, #fed330, #f7b731)',
    icon: '📝',
  },
  {
    id: 3,
    title: '微风天气 (Forest Memo)',
    category: 'Web',
    desc: '简约优雅的气象可视化系统，动态粒子随真实天气变化流动。',
    tags: ['Vue.js', '天气API', '数据可视化'],
    bgGrad: 'linear-gradient(135deg, #2bcbba, #0fb9b1)',
    icon: '🌤️',
  },
  {
    id: 4,
    title: '四季食谱 (Seasons)',
    category: 'Web',
    desc: '融合二十四节气与现代营养学的应季美食搭配引擎。',
    tags: ['React', 'Node.js', '生活美学'],
    bgGrad: 'linear-gradient(135deg, #20bf6b, #26de81)',
    icon: '🍃',
  },
  {
    id: 5,
    title: '竹林博客 (Bamboo Garden)',
    category: 'Experiments',
    desc: '自然风格的极简写作平台，在静谧竹林间沉淀技术与感悟。',
    tags: ['Nuxt.js', 'Markdown', 'SSG'],
    bgGrad: 'linear-gradient(135deg, #45aaf2, #2d98da)',
    icon: '🎋',
  },
  {
    id: 6,
    title: '声音胶囊 (Sound Capsule)',
    category: 'Creative',
    desc: '自然声音发生器与专注白噪音，收录雨声、篝火与松涛。',
    tags: ['WebAudio', 'Vue.js', '交互设计'],
    bgGrad: 'linear-gradient(135deg, #a55eea, #8854d0)',
    icon: '📻',
  },
]

// 随笔文章数据
const articles = [
  {
    id: 'art-01',
    title: '为什么我把个人网页做成了一个可探索的 3D 小世界？',
    date: '2026-03',
    readTime: '6 min',
    summary: '游戏场景负责探索与情绪沉浸，标准 2D 网页负责高密度舒适阅读。关于形式与内容黄金平衡点的思考。',
  },
  {
    id: 'art-02',
    title: '构建低多边形温暖光影：Web 3D 的轻量化实践',
    date: '2026-02',
    readTime: '8 min',
    summary: '从光照烘焙到着色器优化，如何在不拖垮手机浏览器帧率的前提下做出温暖的手作微缩模型质感。',
  },
  {
    id: 'art-03',
    title: '数字花园：让个人作品集重获生机',
    date: '2026-01',
    readTime: '5 min',
    summary: '拒绝单向填鸭式简历，将网站设计成一个可以生长、隐藏彩蛋和记录生活痕迹的数字领地。',
  },
]

// 过滤后的项目列表
const filteredProjects = computed(() => {
  if (currentFilter.value === 'All') return projects
  return projects.filter((p) => p.category === currentFilter.value)
})

// 抽屉头部动态信息
const drawerMeta = computed(() => {
  switch (activeDrawer.value) {
    case 'projects':
      return {
        title: 'PROJECT ARCHIVE',
        icon: '💻',
        subtitle: 'A collection of things I\'ve built, explored, and tinkered with.',
      }
    case 'articles':
      return {
        title: 'ARTICLES & NOTES',
        icon: '📖',
        subtitle: 'Thoughts, technical essays, and long-form journals.',
      }
    case 'updates':
      return {
        title: 'LATEST UPDATES',
        icon: '📋',
        subtitle: 'Pinboard notes, development logs, and small daily thoughts.',
      }
    case 'cabinet':
      return {
        title: 'DISCOVERED TREASURES',
        icon: '💎',
        subtitle: 'Artifacts, hidden memories, and logs recovered across the world.',
      }
    case 'map':
      return {
        title: 'SITE INDEX & MAP',
        icon: '🗺️',
        subtitle: 'Direct fast travel to all pages without 3D exploration.',
      }
    default:
      return {
        title: 'ARCHIVE',
        icon: '📁',
        subtitle: 'Information viewer.',
      }
  }
})

function close() {
  closeDrawer()
}

function quickNavigate(href: string) {
  close()
  const el = document.querySelector(href)
  el?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <Transition name="drawer">
    <aside v-if="activeDrawer" class="cabin-drawer-panel" @click.stop>
      <!-- 抽屉头部 -->
      <div class="drawer-header">
        <div class="drawer-title-row">
          <div class="drawer-title-wrap">
            <span class="drawer-icon">{{ drawerMeta.icon }}</span>
            <h2 class="drawer-title">{{ drawerMeta.title }}</h2>
          </div>
          <button class="drawer-close-btn" @click="close" aria-label="关闭面板">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <p class="drawer-subtitle">{{ drawerMeta.subtitle }}</p>
      </div>

      <!-- ── 板块 1: 项目列表 (PROJECTS) ── -->
      <div v-if="activeDrawer === 'projects'" class="drawer-content">
        <!-- 分类切换药丸 -->
        <div class="filter-pills">
          <button
            v-for="cat in ['All', 'Web', 'Creative', 'Tools', 'Experiments']"
            :key="cat"
            class="filter-pill"
            :class="{ active: currentFilter === cat }"
            @click="currentFilter = cat"
          >
            {{ cat }}
          </button>
        </div>

        <!-- 卡片列表 (1:1 还原参考图) -->
        <div class="card-list">
          <div v-for="proj in filteredProjects" :key="proj.id" class="project-card">
            <div class="project-card-thumb" :style="{ background: proj.bgGrad }">
              <span class="card-thumb-icon">{{ proj.icon }}</span>
            </div>
            <div class="project-card-body">
              <h3 class="project-card-title">{{ proj.title }}</h3>
              <p class="project-card-desc">{{ proj.desc }}</p>
              <div class="project-card-tags">
                <span v-for="t in proj.tags" :key="t" class="project-tag">{{ t }}</span>
              </div>
            </div>
            <div class="project-card-arrow">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- ── 板块 2: 文章与笔记 (ARTICLES) ── -->
      <div v-else-if="activeDrawer === 'articles'" class="drawer-content">
        <div class="article-list">
          <article v-for="art in articles" :key="art.id" class="article-item">
            <div class="article-meta">
              <span class="article-date">{{ art.date }}</span>
              <span class="article-dot">·</span>
              <span class="article-time">{{ art.readTime }}</span>
            </div>
            <h3 class="article-title">{{ art.title }}</h3>
            <p class="article-summary">{{ art.summary }}</p>
            <div class="article-action">
              <span class="read-more-link">阅读完整档案 ➔</span>
            </div>
          </article>
        </div>
      </div>

      <!-- ── 板块 3: 近期更新与便签 (UPDATES) ── -->
      <div v-else-if="activeDrawer === 'updates'" class="drawer-content">
        <div class="updates-board">
          <div class="cork-note yellow">
            <span class="pin-dot">📌</span>
            <span class="note-date">2026.03.11</span>
            <p class="note-text">小木屋 3D 沉浸式基地原型正式落成！现在可以在房间里自由移动、查阅档案了。</p>
          </div>
          <div class="cork-note white">
            <span class="pin-dot">📌</span>
            <span class="note-date">2026.03.05</span>
            <p class="note-text">优化了全站色彩系统，大地色系与侘寂美学全面统一。</p>
          </div>
          <div class="cork-note sage">
            <span class="pin-dot">📌</span>
            <span class="note-date">待办清单</span>
            <p class="note-text">准备给门外林地增加更多废弃仪器，探索拾取可解锁隐藏文章！</p>
          </div>
        </div>
      </div>

      <!-- ── 板块 4: 收集展柜 (DISCOVERED) ── -->
      <div v-else-if="activeDrawer === 'cabinet'" class="drawer-content">
        <div class="cabinet-stats">
          <div class="cabinet-stat-num">{{ discoveredCount }} / {{ totalTargetCount }}</div>
          <div class="cabinet-stat-label">已收录的数字碎片与线索</div>
        </div>
        <div class="discovered-grid">
          <div v-for="item in discoveries" :key="item.id" class="discovered-card">
            <span class="disc-badge">{{ item.category }}</span>
            <h4 class="disc-title">{{ item.title }}</h4>
            <p class="disc-desc">{{ item.desc }}</p>
            <span class="disc-time">收录于 {{ new Date(item.timestamp).toLocaleTimeString() }}</span>
          </div>
          <!-- 尚未发现的插槽 -->
          <div
            v-for="n in Math.max(0, totalTargetCount - discoveredCount)"
            :key="'undisc-' + n"
            class="discovered-card locked"
          >
            <span class="locked-icon">🔒</span>
            <div class="locked-title">未发现的秘藏碎片</div>
            <div class="locked-hint">漫步探索基地或外部区域即可解锁</div>
          </div>
        </div>
      </div>

      <!-- ── 板块 5: 全站快速直达导览 (MAP / INDEX) ── -->
      <div v-else-if="activeDrawer === 'map'" class="drawer-content">
        <div class="index-guide">
          <div class="index-intro">
            💡 <strong>免探索快速通道</strong>：你可以直接点击任意板块秒速定位，无需在 3D 场景中寻路。
          </div>
          <div class="index-nav-grid">
            <button class="index-btn" @click="quickNavigate('#hero')">
              <span class="ib-icon">🏠</span>
              <div class="ib-text">
                <span class="ib-title">网站首页</span>
                <span class="ib-sub">引言与核心概述</span>
              </div>
            </button>
            <button class="index-btn" @click="quickNavigate('#about')">
              <span class="ib-icon">🌿</span>
              <div class="ib-text">
                <span class="ib-title">个人关于</span>
                <span class="ib-sub">背景与设计哲学</span>
              </div>
            </button>
            <button class="index-btn" @click="quickNavigate('#now')">
              <span class="ib-icon">⏱️</span>
              <div class="ib-text">
                <span class="ib-title">当前近况</span>
                <span class="ib-sub">实时生活状态与正在做的事</span>
              </div>
            </button>
            <button class="index-btn" @click="quickNavigate('#skills')">
              <span class="ib-icon">⚡</span>
              <div class="ib-text">
                <span class="ib-title">技能专长</span>
                <span class="ib-sub">技术栈与设计工具</span>
              </div>
            </button>
            <button class="index-btn" @click="quickNavigate('#contact')">
              <span class="ib-icon">✉️</span>
              <div class="ib-text">
                <span class="ib-title">联系交谈</span>
                <span class="ib-sub">发送消息与社交链接</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </aside>
  </Transition>
</template>

<style scoped>
/* ── 抽屉整体容器 (对标参考图深色毛玻璃卡片) ── */
.cabin-drawer-panel {
  position: absolute;
  top: 24px;
  right: 28px;
  bottom: 24px;
  width: 440px;
  max-width: calc(100vw - 40px);
  background: rgba(26, 30, 36, 0.88);
  backdrop-filter: blur(28px);
  -webkit-backdrop-filter: blur(28px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: -8px 12px 48px rgba(0, 0, 0, 0.45);
  display: flex;
  flex-direction: column;
  z-index: 20;
  color: #f1f2f6;
  overflow: hidden;
}

/* 抽屉头部 */
.drawer-header {
  padding: 24px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.drawer-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.drawer-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-icon {
  font-size: 1.25rem;
}

.drawer-title {
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #ffffff;
  margin: 0;
}

.drawer-close-btn {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(255, 255, 255, 0.7);
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.drawer-close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: rotate(90deg);
}

.drawer-subtitle {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.55);
  margin: 0;
  line-height: 1.4;
}

/* 抽屉滚动内容区域 */
.drawer-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.drawer-content::-webkit-scrollbar {
  width: 5px;
}
.drawer-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 4px;
}

/* 分类胶囊按钮 */
.filter-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 6px;
}

.filter-pill {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.7);
  font-size: 0.8rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.filter-pill:hover {
  background: rgba(255, 255, 255, 0.14);
  color: #ffffff;
}

.filter-pill.active {
  background: #ffffff;
  color: #1e272e;
  font-weight: 600;
  border-color: #ffffff;
}

/* ── 项目卡片列表 ── */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 14px;
  transition: all 0.25s ease;
  cursor: pointer;
}

.project-card:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.22);
  transform: translateY(-2px);
}

.project-card-thumb {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.card-thumb-icon {
  font-size: 1.6rem;
}

.project-card-body {
  flex: 1;
  min-width: 0;
}

.project-card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.project-card-desc {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 8px;
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.project-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.project-tag {
  font-size: 0.68rem;
  padding: 2px 7px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.75);
}

.project-card-arrow {
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.project-card:hover .project-card-arrow {
  color: #fff;
  transform: translateX(3px);
}

/* ── 文章列表 ── */
.article-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-item {
  padding: 16px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.article-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.45);
  margin-bottom: 6px;
}

.article-title {
  font-size: 0.98rem;
  font-weight: 600;
  color: #ffffff;
  margin: 0 0 6px;
  line-height: 1.4;
}

.article-summary {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.5;
  margin: 0 0 10px;
}

.read-more-link {
  font-size: 0.78rem;
  color: #70a1ff;
  cursor: pointer;
}

/* ── 告示板便签 ── */
.updates-board {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.cork-note {
  position: relative;
  padding: 18px 18px 14px;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  color: #2f3542;
}

.cork-note.yellow {
  background: #fff8a6;
  transform: rotate(-0.8deg);
}

.cork-note.white {
  background: #ffffff;
  transform: rotate(1deg);
}

.cork-note.sage {
  background: #dff9fb;
  transform: rotate(-0.5deg);
}

.pin-dot {
  position: absolute;
  top: -8px;
  left: 14px;
  font-size: 1.1rem;
}

.note-date {
  display: block;
  font-size: 0.72rem;
  font-weight: 700;
  opacity: 0.6;
  margin-bottom: 4px;
}

.note-text {
  font-size: 0.86rem;
  line-height: 1.45;
  margin: 0;
  font-weight: 500;
}

/* ── 收集展柜 ── */
.cabinet-stats {
  text-align: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px dashed rgba(255, 255, 255, 0.15);
}

.cabinet-stat-num {
  font-size: 2rem;
  font-weight: 800;
  color: #70a1ff;
}

.cabinet-stat-label {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.55);
}

.discovered-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.discovered-card {
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
}

.disc-badge {
  display: inline-block;
  font-size: 0.68rem;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(112, 161, 255, 0.15);
  color: #70a1ff;
  margin-bottom: 4px;
}

.disc-title {
  font-size: 0.92rem;
  color: #ffffff;
  margin: 2px 0 4px;
}

.disc-desc {
  font-size: 0.78rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 6px;
}

.disc-time {
  font-size: 0.7rem;
  color: rgba(255, 255, 255, 0.4);
}

.discovered-card.locked {
  background: rgba(255, 255, 255, 0.02);
  border: 1px dashed rgba(255, 255, 255, 0.06);
  text-align: center;
  padding: 18px;
}

.locked-icon {
  font-size: 1.4rem;
  opacity: 0.4;
}

.locked-title {
  font-size: 0.84rem;
  color: rgba(255, 255, 255, 0.4);
  margin: 4px 0 2px;
}

.locked-hint {
  font-size: 0.72rem;
  color: rgba(255, 255, 255, 0.25);
}

/* ── 全局导览 MAP INDEX ── */
.index-intro {
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.06);
  padding: 10px 14px;
  border-radius: 8px;
  line-height: 1.5;
  margin-bottom: 14px;
}

.index-nav-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.index-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  color: #fff;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}

.index-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: #70a1ff;
  transform: translateX(4px);
}

.ib-icon {
  font-size: 1.3rem;
}

.ib-title {
  display: block;
  font-size: 0.92rem;
  font-weight: 600;
}

.ib-sub {
  display: block;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

/* 抽屉平滑滑入滑出动画 */
.drawer-enter-active,
.drawer-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.drawer-enter-from,
.drawer-leave-to {
  opacity: 0;
  transform: translateX(60px) scale(0.96);
}
</style>
