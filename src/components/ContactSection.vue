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
  { name: 'GitHub', icon: 'GH', href: 'https://github.com/Var-666', color: '#5CE1E6' },
  { name: '以太邮箱', icon: '✉', href: 'mailto:hello@vardev.cc', color: '#F7B267' },
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
        <div class="surreal-kicker">✦ POSTBOX // 以太漂流瓶与星海信笺台</div>
        <h2 class="section-title">虚空投递 · 与我联系</h2>
        <p class="section-subtitle">
          「向宇宙发出量子纠缠的微弱信号，每一行字符都将在以太深处留下共振」—— 期待关于前沿造物、超现实艺术或单纯思维碰撞的信笺
        </p>
      </div>

      <div class="contact-grid">
        <!-- 左侧：信笺与交流 -->
        <div class="contact-info reveal-left">
          <p class="contact-text">
            无论是探讨一个颠覆常规的技术构想、交流反重力交互与 3D 声学生态，还是单纯发出一封问候信，我始终期待着来自不同维度的回声。
          </p>
          <p class="contact-text">
            即使平日潜行于代码世界与夜读沉思之中，我也会认真阅读每一封信件，并在现实维度中尽快给予你真诚的回复。
          </p>

          <div class="contact-details">
            <div class="detail-tile tile-card-dark surreal-portal-frame">
              <span class="detail-icon">🪐</span>
              <div class="detail-texts">
                <span class="detail-sub">✦ 现实驻留座标</span>
                <span class="detail-main">中国 · 杭州 (120.15° E, 30.28° N)</span>
              </div>
            </div>
            <a href="mailto:hello@vardev.cc" class="detail-tile tile-card-dark mail-tile surreal-portal-frame">
              <span class="detail-icon">✉️</span>
              <div class="detail-texts">
                <span class="detail-sub">✦ 电子以太信箱</span>
                <span class="detail-main">hello@vardev.cc</span>
              </div>
            </a>
          </div>

          <!-- 磁吸社交晶片 -->
          <div class="social-links">
            <a
              v-for="(link, index) in socialLinks"
              :key="link.name"
              :ref="(el) => { if (el) socialBtnsRef[index] = el as HTMLElement }"
              :href="link.href"
              class="social-btn tile-card-dark surreal-portal-frame"
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
          <form class="contact-form tile-card-dark surreal-portal-frame" @submit.prevent="handleSubmit">
            <div class="form-header">
              <span class="form-kicker">✦ TRANSMITTER // 向虚空投递</span>
              <h3 class="form-title">写下一封信件</h3>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-name">你的称谓或代号</label>
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
              <label class="form-label" for="contact-email">回信信箱</label>
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
                  placeholder="畅所欲言，期待你的独特见解与问候…"
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
              <span class="btn-text">{{ isSubmitting ? '正在穿透以太投递…' : '投递至以太信箱 ✦' }}</span>
              <svg v-if="!isSubmitting" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
              <div v-else class="btn-spinner"></div>
            </button>
          </form>

          <Transition name="toast">
            <div v-if="showToast" class="toast-notification" role="status" aria-live="polite">
              <span class="toast-icon">✦</span>
              <span class="toast-text">你的信件已遁入以太网络，{{ toastName }}！我会尽快在现实维度回复你。</span>
            </div>
          </Transition>
        </div>
      </div>

      <!-- 页脚 -->
      <footer class="footer">
        <div class="footer-divider"></div>
        <p class="footer-text">© {{ currentYear }} var · 在理性代码与形而上梦境之间，保持好奇与自由</p>
        <p class="footer-sub">Constructed in Digital Surrealism · Built with Vue 3 &amp; TypeScript</p>
      </footer>
    </div>
  </section>
</template>

<style scoped>
#contact.section-dark {
  background: linear-gradient(180deg, #0A0B16 0%, #121429 55%, #080914 100%);
  position: relative;
  border-top: 1px solid rgba(92, 225, 230, 0.15);
}

.surreal-kicker {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  letter-spacing: 0.1em;
  color: var(--color-ether-cyan);
  margin-bottom: 0.5rem;
  text-shadow: 0 0 12px rgba(92, 225, 230, 0.5);
}

.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.15fr;
  gap: 4rem;
  align-items: start;
}

/* 左侧信笺与交流 */
.contact-text {
  font-size: 1.05rem;
  line-height: 1.9;
  color: var(--color-text-muted);
  margin-bottom: 1.2rem;
  font-weight: 400;
}

.contact-details {
  margin: 2.2rem 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-tile {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px 20px;
  text-decoration: none;
  border-radius: var(--radius);
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.18);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
  transition: transform 0.3s var(--ease-spring), border-color 0.3s var(--ease), background-color 0.3s var(--ease), box-shadow 0.3s var(--ease);
}

.detail-tile:hover {
  transform: translateX(6px);
  border-color: var(--color-ether-cyan);
  background: rgba(92, 225, 230, 0.1);
  box-shadow: 0 14px 35px rgba(0, 0, 0, 0.6), 0 0 20px rgba(92, 225, 230, 0.25);
}

.detail-icon {
  font-size: 1.3rem;
}

.detail-texts {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.detail-sub {
  font-family: var(--font-mono);
  font-size: 0.74rem;
  color: var(--color-ether-cyan);
  font-weight: 600;
  letter-spacing: 0.04em;
}

.detail-main {
  font-family: var(--font-mono);
  font-size: 0.98rem;
  color: #FFFFFF;
  font-weight: 500;
}

.mail-tile:hover .detail-main {
  color: var(--color-ether-cyan);
  text-shadow: 0 0 12px rgba(92, 225, 230, 0.5);
}

/* 磁吸社交晶片 */
.social-links {
  display: flex;
  gap: 14px;
  margin-top: 2rem;
}

.social-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px 24px;
  min-width: 90px;
  text-decoration: none;
  border-radius: var(--radius);
  background: rgba(18, 20, 41, 0.72);
  border: 1px solid rgba(92, 225, 230, 0.18);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
  transition: all 0.3s var(--ease);
}

.social-btn:focus-visible {
  outline: 2px solid var(--color-ether-cyan);
  outline-offset: 2px;
}

.social-btn:hover {
  border-color: var(--color-ether-cyan);
  background: rgba(92, 225, 230, 0.12);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(92, 225, 230, 0.3);
  transform: translateY(-3px);
}

.social-icon {
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--color-ether-cyan);
  font-family: var(--font-mono);
  text-shadow: 0 0 10px rgba(92, 225, 230, 0.4);
}

.social-name {
  font-size: 0.76rem;
  color: var(--color-text-muted);
}

.social-btn:hover .social-name {
  color: #FFFFFF;
}

/* 联系表单 */
.contact-form {
  padding: 3rem;
  border-radius: var(--radius-lg);
  background: rgba(18, 20, 41, 0.75);
  border: 1px solid rgba(92, 225, 230, 0.2);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}

.form-header {
  margin-bottom: 1.6rem;
}

.form-kicker {
  display: block;
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: var(--color-solar-gold);
  letter-spacing: 0.08em;
  margin-bottom: 4px;
}

.form-title {
  font-family: var(--font-serif);
  font-size: 1.6rem;
  font-weight: 700;
  color: #FFFFFF;
}

.form-group {
  margin-bottom: 1.6rem;
}

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  margin-bottom: 8px;
  letter-spacing: 0.02em;
  transition: color var(--transition);
}

.form-group:focus-within .form-label {
  color: var(--color-ether-cyan);
}

.contact-form :deep(.glow-input) {
  background: rgba(10, 11, 22, 0.7);
  border: 1px solid rgba(92, 225, 230, 0.18);
  color: #FFFFFF;
  border-radius: var(--radius-sm);
}

.contact-form :deep(.glow-input):focus {
  border-color: var(--color-ether-cyan);
  box-shadow: 0 0 0 3px rgba(92, 225, 230, 0.2), 0 0 15px rgba(92, 225, 230, 0.3);
  background: rgba(10, 11, 22, 0.85);
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
  padding: 15px 28px;
  background: linear-gradient(135deg, #5CE1E6, #35B4BA);
  color: #0A0B16;
  font-weight: 700;
  border: none;
  border-radius: var(--radius-full);
  box-shadow: 0 0 20px rgba(92, 225, 230, 0.4);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.3s var(--ease);
}

.submit-btn:hover {
  box-shadow: 0 0 30px rgba(92, 225, 230, 0.7);
  transform: translateY(-2px);
}

.submit-btn.submitting {
  opacity: 0.75;
  pointer-events: none;
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(10, 11, 22, 0.3);
  border-top-color: #0A0B16;
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
  width: 120px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(92, 225, 230, 0.4), transparent);
  margin: 0 auto 2.2rem;
}

.footer-text {
  font-family: var(--font-serif);
  font-size: 0.98rem;
  color: var(--color-text-muted);
  margin-bottom: 0.4rem;
}

.footer-sub {
  font-family: var(--font-mono);
  font-size: 0.76rem;
  color: rgba(144, 155, 187, 0.55);
}

/* 虚空星光风格 Toast 通知 */
.toast-notification {
  position: fixed;
  bottom: 36px;
  right: 36px;
  z-index: 9000;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 26px;
  background: rgba(18, 20, 41, 0.95);
  border: 1px solid var(--color-ether-cyan);
  color: #FFFFFF;
  border-radius: var(--radius-full);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.7), 0 0 25px rgba(92, 225, 230, 0.4);
  font-size: 0.92rem;
  font-weight: 500;
  backdrop-filter: blur(20px);
}

.toast-icon {
  font-size: 1.2rem;
  color: var(--color-ether-cyan);
  text-shadow: 0 0 10px var(--color-ether-cyan);
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
    padding: 2rem 1.6rem;
  }
  .toast-notification {
    bottom: 24px;
    right: 24px;
    left: 24px;
    justify-content: center;
  }
}
</style>
