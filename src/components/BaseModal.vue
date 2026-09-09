<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}

watch(() => props.open, (val) => {
  document.body.style.overflow = val ? 'hidden' : ''
})

onMounted(() => document.addEventListener('keydown', onKey))
onUnmounted(() => {
  document.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="open"
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        @click.self="emit('close')"
      >
        <div class="modal-panel">
          <button class="modal-close" @click="emit('close')" aria-label="关闭对话框">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <div class="modal-body">
            <slot />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(44, 38, 33, 0.38);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.modal-panel {
  position: relative;
  width: 100%;
  max-width: 700px;
  max-height: 86vh;
  background: #FFFFFF;
  border: 1px solid var(--card-border);
  border-radius: var(--radius-lg);
  box-shadow: 0 20px 60px -10px rgba(60, 48, 38, 0.18), 0 4px 16px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.modal-close {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  border: 1px solid var(--card-border);
  border-radius: 50%;
  color: var(--color-text-light);
  transition: all 0.2s var(--ease);
}

.modal-close:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: #FFFFFF;
  transform: rotate(90deg);
}

.modal-body {
  overflow-y: auto;
  overscroll-behavior: contain;
}

/* 过渡 */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s var(--ease);
}

.modal-enter-active .modal-panel,
.modal-leave-active .modal-panel {
  transition: transform 0.3s var(--ease), opacity 0.25s var(--ease);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-panel {
  transform: scale(0.96) translateY(16px);
  opacity: 0;
}

.modal-leave-to .modal-panel {
  transform: scale(0.97) translateY(8px);
  opacity: 0;
}

@media (max-width: 640px) {
  .modal-overlay { padding: 12px; }
  .modal-panel { max-height: 92vh; border-radius: var(--radius); }
}
</style>
