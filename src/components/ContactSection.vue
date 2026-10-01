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
  { name: 'GitHub', icon: 'GH', href: 'https://github.com/Var-666', color: '#5B8C6E' },
  { name: '电子邮箱', icon: '✉', href: 'mailto:hello@vardev.cc', color: '#C8944A' },
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
  setTimeout(() => { showToast.value = false }, 4500)
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
      </div>

      <div class="contact-grid">
        <!-- 左侧：信笺与交流 -->
        <div class="contact-info reveal-left">
          <div class="contact-details">
            <div class="detail-tile">
              <span class="detail-icon">📍</span>
              <div class="detail-texts">
                <span class="detail-sub">坐标</span>
                <span class="detail-main">中国 · 杭州</span>
              </div>
            </div>
            <a href="mailto:hello@vardev.cc" class="detail-tile mail-tile">
              <span class="detail-icon">✉️</span>
              <div class="detail-texts">
                <span class="detail-sub">电子邮箱</span>
                <span class="detail-main">hello@vardev.cc</span>
              </div>
            </a>
          </div>

          <!-- 社交链接 -->
          <div class="social-links">
            <a
              v-for="(link, index) in socialLinks"
              :key="link.name"
              :ref="(el) => { if (el) socialBtnsRef[index] = el as HTMLElement }"
              :href="link.href"
              class="social-btn"
              :title="link.name"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span class="social-icon">{{ link.icon }}</span>
              <span class="social-name">{{ link.name }}</span>
            </a>
          </div>
        </div>

        <!-- 右侧：联系表单 -->
        <div class="contact-form-wrap reveal-right">
          <form class="contact-form" @submit.prevent="handleSubmit">
            <div class="form-header">
              <h3 class="form-title">写一封信</h3>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-name">你的名字或称谓</label>
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
              <label class="form-label" for="contact-email">你的邮箱</label>
              <div class="input-wrap">
                <input
                  id="contact-email"
                  v-model="formData.email"
                  type="email"
                  class="glow-input"
                  placeholder="你的联络邮箱 (name@example.com)…"
                  autocomplete="email"
                  spellcheck="false"
                  required
                />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-message">信件内容</label>
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
              <span class="btn-text">{{ isSubmitting ? '正在发送…' : '发送留言' }}</span>
              <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <div v-else class="btn-spinner"></div>
            </button>
          </form>

          <Transition name="toast">
            <div v-if="showToast" class="toast-notification" role="status" aria-live="polite">
              <span class="toast-icon">✓</span>
              <span class="toast-text">留言已发送，{{ toastName }}！我会尽快回复你。</span>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="footer">
        <div class="footer-divider"></div>
        <p class="footer-text">© {{ currentYear }} var · 保持好奇，用心生活与创造</p>
        <p class="footer-sub">Designed with care · Built with Vue 3 &amp; TypeScript</p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
#contact.section-dark {
  background: var(--c-bg-dark);
  color: var(--c-text-inv);
  position: relative;
  border-top: 1px solid var(--c-border-dark);
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: start;
}

/* 左侧信笺与交流 */

.contact-details {
  margin: 2.2rem 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-tile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  text-decoration: none;
  border-radius: var(--radius);
  background: var(--c-surface);
  border: 1px solid var(--c-border-dark);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.25s var(--ease-spring), border-color 0.25s var(--ease), background-color 0.25s var(--ease);
}

.detail-tile:hover {
  transform: translateX(4px);
  border-color: var(--c-accent-soft);
  background: var(--c-accent-glow);
}

.detail-icon {
  font-size: 1.3rem;
}

.detail-texts {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.detail-sub {
  font-size: 0.75rem;
  color: var(--color-accent-light);
  font-weight: 600;
  letter-spacing: 0.02em;
}

.detail-main {
  font-family: var(--font-mono);
  font-size: 0.98rem;
  color: #FFFFFF;
  font-weight: 500;
}

.mail-tile:hover .detail-main {
  color: var(--color-accent-light);
}

.mail-tile:focus-visible {
  outline: 2px solid var(--c-accent);
  outline-offset: 3px;
}

/* 社交链接 */
.social-links {
  display: flex;
  gap: 12px;
  margin-top: 1.8rem;
}

.social-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 14px 22px;
  min-width: 84px;
  text-decoration: none;
  border-radius: var(--radius);
  background: var(--c-surface);
  border: 1px solid var(--c-border-dark);
  transition: all 0.25s var(--ease);
}

.social-btn:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}

.social-btn:hover {
  border-color: var(--color-accent);
  background: var(--c-accent-glow);
  transform: translateY(-2px);
}

.social-icon {
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--color-accent-light);
  font-family: var(--font-mono);
}

.social-name {
  font-size: 0.76rem;
  color: var(--c-text-inv-2);
}

.social-btn:hover .social-name {
  color: #FFFFFF;
}

/* 联系表单 */
.contact-form {
  padding: 2.8rem;
  border-radius: var(--radius-lg);
  background: var(--c-surface);
  border: 1px solid var(--c-border-dark);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.3);
}

.form-header {
  margin-bottom: 1.6rem;
}

.form-title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 700;
  color: #FFFFFF;
}

.form-group {
  margin-bottom: 1.5rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--c-text-inv-2);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  transition: color var(--transition);
}

.form-group:focus-within .form-label {
  color: var(--color-accent-light);
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
  padding: 12px 28px;
  background: var(--color-accent);
  color: #FFFFFF;
  font-weight: 600;
  border: none;
  border-radius: var(--radius-full);
  box-shadow: 0 4px 16px var(--c-accent-glow);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.25s var(--ease);
}

.submit-btn:hover {
  background: var(--color-accent-light);
  transform: translateY(-2px);
  box-shadow: 0 6px 20px var(--c-accent-glow);
}

.submit-btn.submitting {
  opacity: 0.75;
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
  margin-top: 6rem;
  text-align: center;
}

.footer-divider {
  width: 80px;
  height: 1px;
  background: rgba(255, 255, 255, 0.15);
  margin: 0 auto 2rem;
}

.footer-text {
  font-family: var(--font-serif);
  font-size: 0.96rem;
  color: var(--c-text-inv-2);
  margin-bottom: 0.4rem;
}

.footer-sub {
  font-size: 0.78rem;
  color: var(--c-text-inv-2);
}



@media (max-width: 900px) {
  .contact-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .contact-form {
    padding: 2rem 1.6rem;
  }
}
</style>
