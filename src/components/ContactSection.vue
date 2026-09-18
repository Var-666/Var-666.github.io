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
        <!-- 左侧：工坊信笺邀请 -->
        <div class="contact-info reveal-left">
          <p class="contact-text">
            如同每一件手工烧制的陶器都留有指纹，我相信每一次真诚的技术交流都有其独特的价值。
          </p>
          <p class="contact-text">
            无论你有一个清晰的项目构想，还是一个天马行空的灵感，我都乐意聆听并与你共同探讨实现的可能。
          </p>

          <div class="contact-details">
            <div class="detail-tile tile-card-dark">
              <span class="detail-icon">📍</span>
              <div class="detail-texts">
                <span class="detail-sub">物理工坊坐标</span>
                <span class="detail-main">中国 · 杭州</span>
              </div>
            </div>
            <a href="mailto:hello@vardev.cc" class="detail-tile tile-card-dark mail-tile">
              <span class="detail-icon">✉️</span>
              <div class="detail-texts">
                <span class="detail-sub">电子信箱直达</span>
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
              <span class="btn-text">{{ isSubmitting ? '正在投递…' : '发送投递' }}</span>
              <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <div v-else class="btn-spinner"></div>
            </button>
          </form>

          <Transition name="toast">
            <div v-if="showToast" class="toast-notification" role="status" aria-live="polite">
              <span class="toast-icon">✅</span>
              <span class="toast-text">已收到你的信件，{{ toastName }}！我会尽快回复。</span>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="footer">
        <div class="footer-divider"></div>
        <p class="footer-text">© {{ currentYear }} var · 以代码为凿，构筑数字实体</p>
        <p class="footer-sub">Crafted with Vue 3, TypeScript &amp; Architectural Ceramic System</p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
#contact.section-dark {
  background: linear-gradient(180deg, #19211e 0%, #221d19 28%, #2C2621 70%);
  position: relative;
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: start;
}

/* 左侧工坊信笺 */
.contact-text {
  font-size: 1.02rem;
  line-height: 1.85;
  color: var(--color-text-inv-light);
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
  transition: transform var(--transition), border-color var(--transition);
}

.detail-tile:hover {
  transform: translateX(4px);
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
  color: rgba(247, 246, 242, 0.45);
  font-weight: 400;
}

.detail-main {
  font-size: 0.95rem;
  color: var(--color-text-inv);
  font-weight: 500;
}

.mail-tile:hover .detail-main {
  color: var(--color-glaze-celadon-light);
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
  padding: 16px 20px;
  min-width: 80px;
  text-decoration: none;
  transition: border-color var(--transition), transform var(--transition);
}

.social-btn:focus-visible {
  outline: 2px solid var(--color-glaze-celadon-light);
  outline-offset: 2px;
}

.social-btn:hover {
  border-color: var(--color-glaze-celadon-light);
  transform: translateY(-2px);
}

.social-icon {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-text-inv);
  font-family: var(--font-mono);
}

.social-name {
  font-size: 0.72rem;
  color: rgba(247, 246, 242, 0.55);
}

.social-btn:hover .social-name {
  color: var(--color-glaze-celadon-light);
}

/* 联系表单 */
.contact-form {
  padding: 2.8rem;
}

.form-group {
  margin-bottom: 1.6rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: rgba(247, 246, 242, 0.7);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  transition: color var(--transition);
}

.form-group:focus-within .form-label {
  color: var(--color-glaze-celadon-light);
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
  border-top-color: white;
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
  background: var(--color-slate-border);
  margin: 0 auto 2rem;
}

.footer-text {
  font-family: var(--font-serif);
  font-size: 0.95rem;
  color: rgba(247, 246, 242, 0.6);
  margin-bottom: 0.4rem;
}

.footer-sub {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: rgba(247, 246, 242, 0.35);
}

/* Toast 通知 */
.toast-notification {
  position: fixed;
  bottom: 36px;
  right: 36px;
  z-index: 9000;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 22px;
  background: var(--color-glaze-celadon);
  border: 1px solid var(--color-glaze-celadon-light);
  color: white;
  border-radius: var(--radius-sm);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
  font-size: 0.92rem;
  font-weight: 500;
}

.toast-icon {
  font-size: 1.1rem;
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
