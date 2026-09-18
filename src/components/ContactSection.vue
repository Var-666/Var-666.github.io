<script setup lang="ts">
import { onMounted, ref, nextTick } from 'vue'
import { useScrollReveal } from '@/composables/useScrollReveal'
import { useMagnetic } from '@/composables/useMagnetic'

const sectionRef = ref<HTMLElement | null>(null)
const socialBtnsRef = ref<HTMLElement[]>([])
const { observeAll } = useScrollReveal()
const { bind: bindMagnetic } = useMagnetic(0.3, 100)

interface SocialLink {
  name: string
  icon: string
  href: string
  color: string
}

const socialLinks: SocialLink[] = [
  { name: 'GitHub', icon: 'GH', href: 'https://github.com/Var-666', color: '#333' },
  { name: '邮箱', icon: '✉', href: 'mailto:hello@vardev.cc', color: '#7C8C6E' },
]

const formData = ref({
  name: '',
  email: '',
  message: '',
})

const isSubmitting = ref(false)
const showToast = ref(false)
const toastName = ref('')

const currentYear = new Date().getFullYear()

async function handleSubmit() {
  isSubmitting.value = true
  await new Promise(r => setTimeout(r, 800))
  isSubmitting.value = false
  toastName.value = formData.value.name
  showToast.value = true
  formData.value = { name: '', email: '', message: '' }
  setTimeout(() => { showToast.value = false }, 4000)
}

onMounted(async () => {
  if (sectionRef.value) {
    observeAll('.reveal, .reveal-left, .reveal-right', sectionRef.value)
  }

  await nextTick()
  socialBtnsRef.value.forEach((btn) => {
    if (btn) bindMagnetic(btn)
  })
})
</script>

<template>
  <section id="contact" class="section section-dark" ref="sectionRef">
    <div class="container">
      <div class="section-header reveal">
        <h2 class="section-title">与我联系</h2>
        <p class="section-subtitle">无论是项目合作、技术探讨，还是单纯打个招呼，随时欢迎来信</p>
      </div>

      <div class="contact-grid">
        <!-- 左侧：信笺与交流 -->
        <div class="contact-info reveal-left">
          <p class="contact-text">
            无论是探讨一个有趣的技术想法、聊聊设计与动效，还是单纯打个招呼喝杯茶，随时欢迎给我来信。
          </p>
          <p class="contact-text">
            即使平日忙于写代码和探索新玩意，我也会认真阅读每一封信件并尽快回复你。
          </p>

          <div class="contact-details">
            <div class="detail-tile tile-card-dark">
              <span class="detail-icon">📍</span>
              <div class="detail-texts">
                <span class="detail-sub">常驻坐标</span>
                <span class="detail-main">中国 · 杭州</span>
              </div>
            </div>
            <a href="mailto:hello@vardev.cc" class="detail-tile tile-card-dark mail-tile">
              <span class="detail-icon">✉️</span>
              <div class="detail-texts">
                <span class="detail-sub">电子信箱</span>
                <span class="detail-main">hello@vardev.cc</span>
              </div>
            </a>
          </div>

          <!-- 磁吸社交瓷砖 -->
          <div class="social-links">
            <a
              v-for="(link, index) in socialLinks"
              :key="link.name"
              :ref="(el) => { if (el) socialBtnsRef[index] = el as HTMLElement }"
              :href="link.href"
              class="social-btn tile-card-dark"
              :title="link.name"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="social-icon">{{ link.icon }}</span>
              <span class="social-name">{{ link.name }}</span>
            </a>
          </div>
        </div>

        <!-- 右侧：联系表单瓷砖卡片 -->
        <div class="contact-form-wrap reveal-right">
          <form class="contact-form tile-card-dark" @submit.prevent="handleSubmit">
            <div class="form-group">
              <label class="form-label" for="contact-name">姓名或称呼</label>
              <div class="input-wrap">
                <input
                  id="contact-name"
                  v-model="formData.name"
                  type="text"
                  class="glow-input"
                  placeholder="如何称呼你…"
                  autocomplete="name"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-email">联系邮箱</label>
              <div class="input-wrap">
                <input
                  id="contact-email"
                  v-model="formData.email"
                  type="email"
                  class="glow-input"
                  placeholder="你的回复邮箱 (name@example.com)…"
                  autocomplete="email"
                  spellcheck="false"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-message">留言内容</label>
              <div class="input-wrap">
                <textarea
                  id="contact-message"
                  v-model="formData.message"
                  class="glow-input glow-textarea"
                  placeholder="畅所欲言，期待你的来信…"
                  rows="5"
                  required
                ></textarea>
              </div>
            </div>

            <button
              type="submit"
              class="tile-btn-primary submit-btn"
              :class="{ submitting: isSubmitting }"
              :disabled="isSubmitting"
            >
              <span class="btn-text">{{ isSubmitting ? '正在寄出信件…' : '寄出信件 🍃' }}</span>
              <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <div v-else class="btn-spinner"></div>
            </button>
          </form>

          <Transition name="toast">
            <div v-if="showToast" class="toast-notification" role="status" aria-live="polite">
              <span class="toast-icon">🍃</span>
              <span class="toast-text">已收到你的信件，{{ toastName }}！我会尽快回复。</span>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="footer">
        <div class="footer-divider"></div>
        <p class="footer-text">© {{ currentYear }} var · 在代码与生活之间，保持好奇与从容</p>
        <p class="footer-sub">Designed with Care · Built with Vue 3 &amp; TypeScript</p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
#contact.section-dark {
  background: linear-gradient(180deg, #1A261E 0%, #152018 45%, #0F1713 100%);
  position: relative;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: start;
}

/* 左侧信笺与交流 */
.contact-text {
  font-size: 1.02rem;
  line-height: 1.85;
  color: rgba(245, 242, 235, 0.85);
  margin-bottom: 1.2rem;
  font-weight: 400;
}

.contact-details {
  margin: 2.2rem 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-tile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 18px;
  text-decoration: none;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: transform var(--transition), border-color var(--transition), background-color var(--transition);
}

.detail-tile:hover {
  transform: translateX(4px);
  border-color: rgba(91, 142, 103, 0.45);
  background: rgba(91, 142, 103, 0.08);
}

.detail-icon {
  font-size: 1.2rem;
}

.detail-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-sub {
  font-size: 0.72rem;
  color: rgba(245, 242, 235, 0.5);
  font-weight: 400;
}

.detail-main {
  font-size: 0.95rem;
  color: #F8F7F2;
  font-weight: 500;
}

.mail-tile:hover .detail-main {
  color: #78A384;
}

/* 磁吸社交瓷砖 */
.social-links {
  display: flex;
  gap: 12px;
  margin-top: 2rem;
}

.social-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 22px;
  min-width: 86px;
  text-decoration: none;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: border-color var(--transition), transform var(--transition), background-color var(--transition);
}

.social-btn:focus-visible {
  outline: 2px solid #5B8E67;
  outline-offset: 2px;
}

.social-btn:hover {
  border-color: #5B8E67;
  background: rgba(91, 142, 103, 0.12);
  transform: translateY(-2px);
}

.social-icon {
  font-size: 1.15rem;
  font-weight: 700;
  color: #A3C9A8;
  font-family: var(--font-mono);
}

.social-name {
  font-size: 0.74rem;
  color: rgba(245, 242, 235, 0.65);
}

.social-btn:hover .social-name {
  color: #FFFFFF;
}

/* 联系表单 */
.contact-form {
  padding: 2.8rem;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.25);
}

.form-group {
  margin-bottom: 1.6rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(245, 242, 235, 0.75);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  transition: color var(--transition);
}

.form-group:focus-within .form-label {
  color: #A3C9A8;
}

.contact-form :deep(.glow-input) {
  background: rgba(0, 0, 0, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #F8F7F2;
}

.contact-form :deep(.glow-input):focus {
  border-color: #5B8E67;
  box-shadow: 0 0 0 3px rgba(91, 142, 103, 0.2);
  background: rgba(0, 0, 0, 0.32);
}

.glow-textarea {
  resize: vertical;
  min-height: 120px;
  line-height: 1.7;
}

/* 提交按键 */
.submit-btn {
  width: 100%;
  margin-top: 0.5rem;
  padding: 14px 28px;
}

.submit-btn.submitting {
  opacity: 0.7;
  pointer-events: none;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #FFFFFF;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* 页脚 */
.footer {
  margin-top: 5.5rem;
  text-align: center;
}

.footer-divider {
  width: 48px;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 auto 2rem;
}

.footer-text {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  color: rgba(245, 242, 235, 0.75);
  margin-bottom: 0.4rem;
}

.footer-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: rgba(245, 242, 235, 0.4);
}

/* 自然薄荷叶风格 Toast 通知 */
.toast-notification {
  position: fixed;
  bottom: 36px;
  right: 36px;
  z-index: 9000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 24px;
  background: #1C2D22;
  border: 1px solid #3E6B48;
  color: #F8F7F2;
  border-radius: var(--radius-full);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(62, 107, 72, 0.3);
  font-size: 0.92rem;
  font-weight: 500;
}

.toast-icon {
  font-size: 1.2rem;
}

.toast-enter-active { transition: opacity 0.35s var(--ease-spring), transform 0.35s var(--ease-spring); }
.toast-leave-active { transition: opacity 0.25s var(--ease), transform 0.25s var(--ease); }
.toast-enter-from { opacity: 0; transform: translateY(16px) scale(0.95); }
.toast-leave-to { opacity: 0; transform: translateY(-10px) scale(0.95); }

@media (max-width: 900px) {
  .contact-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .contact-form {
    padding: 2rem 1.4rem;
  }
  .toast-notification {
    bottom: 24px;
    right: 24px;
    left: 24px;
    justify-content: center;
  }
}
</style>
