<script setup lang="ts">
import { ref } from 'vue'
import { useCabinWorld } from '@/composables/useCabinWorld'
import { useCabinStore } from '@/composables/useCabinStore'
import CabinDrawer from '@/components/CabinDrawer.vue'

const viewportRef = ref<HTMLElement | null>(null)
const {
  recentDiscoveryToast,
  discoveredCount,
  totalTargetCount,
  progressPercent,
  isFullscreen,
  toggleFullscreen,
  discoverItem,
  openDrawer,
} = useCabinStore()

const { interactiveItems, nearbyItem, isLoaded, handleInteract } = useCabinWorld(viewportRef)

function triggerItem(item: any) {
  if (item.drawerType === 'crystal') {
    discoverItem({
      id: 'artifact-crystal',
      title: '微光数据水晶 #004',
      category: '野外遗物',
      desc: '在门外林地石径旁拾得的未受损存储介质，闪烁着温润的脉冲光。',
    })
  } else {
    openDrawer(item.drawerType)
  }
}
</script>

<template>
  <section id="cabin" class="cabin-section" :class="{ 'is-fullscreen': isFullscreen }">
    <!-- 3D 渲染容器 -->
    <div ref="viewportRef" class="cabin-viewport">
      <!-- 初始加载等待动画 -->
      <div v-if="!isLoaded" class="cabin-loading">
        <div class="loading-spinner"></div>
        <p>正在生成 3D 小木屋世界...</p>
      </div>
    </div>

    <!-- 顶部导航条 (1:1 还原参考图) -->
    <header class="cabin-header">
      <div class="header-brand">
        <span class="brand-icon">🌲</span>
        <div class="brand-text-group">
          <span class="brand-title">My Little Web</span>
          <span class="brand-sub">EXPLORE · DISCOVER · LEARN · BUILD</span>
        </div>
      </div>
      <div class="header-actions">
        <span class="header-quote">"A more curious internet."</span>
        <button class="fullscreen-toggle-btn" @click="toggleFullscreen" title="切换全屏沉浸模式">
          <svg v-if="!isFullscreen" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"></path>
          </svg>
          <span class="btn-label">{{ isFullscreen ? '退出全屏' : '沉浸模式' }}</span>
        </button>
      </div>
    </header>

    <!-- 3D 空间投射的悬浮标签 (World-space UI Tags) -->
    <div class="world-tags-layer">
      <div
        v-for="item in interactiveItems"
        :key="item.id"
        class="world-tag"
        :class="{ 'is-nearby': item.isNearby }"
        :style="{
          left: `${item.screenX}px`,
          top: `${item.screenY}px`,
        }"
        @click="triggerItem(item)"
      >
        <span class="tag-icon">{{ item.icon }}</span>
        <span class="tag-label">{{ item.label }}</span>
        <!-- 靠近时弹出的 [E] 交互气泡 -->
        <Transition name="pop">
          <div v-if="item.isNearby" class="interact-bubble">
            <span class="key-pill">E</span>
            <span class="interact-action">{{ item.drawerType === 'crystal' ? '拾取遗物' : '打开' }}</span>
          </div>
        </Transition>
      </div>
    </div>

    <!-- 左下角 HUD 探索进度面板 (1:1 还原参考图) -->
    <div class="cabin-hud-card">
      <div class="hud-avatar-wrap">
        <div class="hud-avatar">🎒</div>
      </div>
      <div class="hud-info">
        <div class="hud-hearts">
          <span class="heart">❤️</span>
          <span class="heart">❤️</span>
          <span class="heart">❤️</span>
        </div>
        <div class="hud-progress-row">
          <span class="hud-progress-text">Discovered {{ discoveredCount }} / {{ totalTargetCount }}</span>
        </div>
        <div class="hud-progress-track">
          <div class="hud-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
        </div>
      </div>
    </div>

    <!-- 底部居中操作快捷提示 -->
    <div class="cabin-controls-hint">
      <div class="hint-group">
        <span class="key-cap">W</span>
        <span class="key-cap">A</span>
        <span class="key-cap">S</span>
        <span class="key-cap">D</span>
        <span class="hint-label">移动</span>
      </div>
      <span class="hint-sep">|</span>
      <div class="hint-group">
        <span class="key-cap">E</span>
        <span class="hint-label">交互</span>
      </div>
      <span class="hint-sep">|</span>
      <div class="hint-group">
        <span class="hint-icon">🖱️</span>
        <span class="hint-label">按住拖拽视角</span>
      </div>
    </div>

    <!-- 拾取新物品时弹出的 Toast 通知 -->
    <Transition name="toast">
      <div v-if="recentDiscoveryToast" class="discovery-toast">
        <div class="toast-icon">✨</div>
        <div class="toast-body">
          <div class="toast-title">发现新线索：{{ recentDiscoveryToast.title }}</div>
          <div class="toast-desc">已成功归档入基地展柜 (Discovered {{ discoveredCount }}/{{ totalTargetCount }})</div>
        </div>
      </div>
    </Transition>

    <!-- 右侧内容抽屉 -->
    <CabinDrawer />
  </section>
</template>

<style scoped>
/* ── 主场景容器 ── */
.cabin-section {
  position: relative;
  width: 100%;
  height: 860px;
  background: #19211e;
  overflow: hidden;
  user-select: none;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

/* 全屏沉浸模式 */
.cabin-section.is-fullscreen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2000;
  border: none;
}

.cabin-viewport {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  cursor: grab;
}

.cabin-viewport:active {
  cursor: grabbing;
}

.cabin-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: #f1f2f6;
  background: #19211e;
  z-index: 10;
}

.loading-spinner {
  width: 44px;
  height: 44px;
  border: 3px solid rgba(255, 255, 255, 0.12);
  border-top-color: #70a1ff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── 顶部条 (Header) ── */
.cabin-header {
  position: absolute;
  top: 20px;
  left: 28px;
  right: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  pointer-events: none;
  z-index: 15;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  background: rgba(20, 24, 28, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  padding: 8px 18px;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  pointer-events: auto;
}

.brand-icon {
  font-size: 1.4rem;
}

.brand-text-group {
  display: flex;
  flex-direction: column;
}

.brand-title {
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #ffffff;
}

.brand-sub {
  font-size: 0.68rem;
  letter-spacing: 0.08em;
  color: rgba(255, 255, 255, 0.55);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  pointer-events: auto;
}

.header-quote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 0.88rem;
  color: rgba(255, 255, 255, 0.55);
}

@media (max-width: 768px) {
  .header-quote {
    display: none;
  }
}

.fullscreen-toggle-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  background: rgba(20, 24, 28, 0.65);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 0.82rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.fullscreen-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
}

/* ── 3D 空间悬浮标签层 ── */
.world-tags-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.world-tag {
  position: absolute;
  transform: translate(-50%, -100%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: rgba(24, 28, 33, 0.72);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 9999px;
  color: #ffffff;
  font-size: 0.8rem;
  font-weight: 500;
  pointer-events: auto;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  white-space: nowrap;
}

.world-tag:hover {
  background: rgba(255, 255, 255, 0.18);
  border-color: #70a1ff;
  transform: translate(-50%, -108%) scale(1.05);
}

.world-tag.is-nearby {
  background: rgba(33, 150, 243, 0.85);
  border-color: #ffffff;
  box-shadow: 0 0 20px rgba(33, 150, 243, 0.6);
  transform: translate(-50%, -110%) scale(1.1);
  animation: tag-pulse 2s infinite ease-in-out;
}

@keyframes tag-pulse {
  0%, 100% { box-shadow: 0 0 15px rgba(33, 150, 243, 0.5); }
  50% { box-shadow: 0 0 28px rgba(33, 150, 243, 0.85); }
}

.tag-icon {
  font-size: 0.95rem;
}

/* 靠近时弹出的 [E] 交互气泡 */
.interact-bubble {
  position: absolute;
  bottom: -32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 5px;
  background: #ffffff;
  color: #1e272e;
  padding: 3px 10px;
  border-radius: 9999px;
  font-weight: 700;
  font-size: 0.74rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.key-pill {
  background: #1e272e;
  color: #ffffff;
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 0.7rem;
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-6px) scale(0.8);
}

/* ── 左下角 HUD 卡片 (1:1 还原参考图) ── */
.cabin-hud-card {
  position: absolute;
  bottom: 24px;
  left: 28px;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 18px 10px 12px;
  background: rgba(22, 27, 34, 0.82);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  z-index: 15;
  color: #ffffff;
}

.hud-avatar-wrap {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #c23616, #e15f41);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid rgba(255, 255, 255, 0.3);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.hud-avatar {
  font-size: 1.35rem;
}

.hud-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 140px;
}

.hud-hearts {
  display: flex;
  gap: 3px;
  font-size: 0.72rem;
}

.hud-progress-text {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: rgba(255, 255, 255, 0.85);
}

.hud-progress-track {
  width: 100%;
  height: 5px;
  background: rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  overflow: hidden;
}

.hud-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #10b981, #34d399);
  border-radius: 9999px;
  transition: width 0.4s ease;
}

/* ── 底部居中操作指示栏 ── */
.cabin-controls-hint {
  position: absolute;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 18px;
  background: rgba(22, 27, 34, 0.75);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  color: rgba(255, 255, 255, 0.75);
  font-size: 0.76rem;
  z-index: 15;
  pointer-events: none;
}

.hint-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-cap {
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 5px;
  font-family: var(--font-mono);
  font-weight: 700;
  font-size: 0.7rem;
  color: #fff;
}

.hint-sep {
  opacity: 0.25;
}

/* ── 探索发现 Toast ── */
.discovery-toast {
  position: absolute;
  top: 86px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: rgba(30, 39, 46, 0.95);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(112, 161, 255, 0.4);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45);
  border-radius: 9999px;
  color: #ffffff;
  z-index: 30;
}

.toast-icon {
  font-size: 1.3rem;
  animation: pulse 1.5s infinite;
}

.toast-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #70a1ff;
}

.toast-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.65);
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -20px) scale(0.9);
}

@media (max-width: 900px) {
  .cabin-controls-hint {
    display: none;
  }
}
</style>
