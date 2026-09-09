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
  { name: 'GitHub', icon: 'GH', href: '#', color: '#333' },
  { name: '邮箱', icon: '✉', href: 'mailto:hello@vardev.cc', color: '#7C8C6E' },
  { name: '微信', icon: 'WX', href: '#', color: '#07C160' },
  { name: '掘金', icon: 'JJ', href: '#', color: '#1E80FF' },
]

const formData = ref({
  name: '',
  email: '',
  message: '',
})

const isSubmitting = ref(false)

async function handleSubmit() {
  isSubmitting.value = true
  // 模拟提交
  await new Promise(r => setTimeout(r, 800))
  isSubmitting.value = false
  alert(`感谢你的留言，${formData.value.name}！我会尽快回复你。`)
  formData.value = { name: '', email: '', message: '' }
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
        <p class="section-subtitle">期待与你的每一次交流</p>
      </div>

      <div class="contact-grid">
        <!-- 左侧 -->
        <div class="contact-info reveal-left">
          <p class="contact-text">
            无论是项目合作、技术交流，还是只是想打个招呼，
            都欢迎通过下方的方式联系我。
          </p>
          <p class="contact-text">
            我相信每一次相遇都有其意义，期待聆听你的想法。
          </p>

          <div class="contact-details">
            <div class="detail-item">
              <span class="detail-icon">📍</span>
              <span class="detail-text">中国 · 杭州</span>
            </div>
            <div class="detail-item">
              <span class="detail-icon">✉️</span>
              <span class="detail-text">hello@vardev.cc</span>
            </div>
          </div>

          <!-- 磁吸社交按钮 -->
          <div class="social-links">
            <a
              v-for="(link, index) in socialLinks"
              :key="link.name"
              :ref="(el) => { if (el) socialBtnsRef[index] = el as HTMLElement }"
              :href="link.href"
              class="social-btn"
              :title="link.name"
              :style="{ '--btn-color': link.color } as any"
            >
              <span class="social-icon">{{ link.icon }}</span>
              <span class="social-name">{{ link.name }}</span>
              <span class="social-glow"></span>
            </a>
          </div>
        </div>

        <!-- 右侧：联系表单 -->
        <div class="contact-form-wrap reveal-right">
          <form class="contact-form glass-card-dark" @submit.prevent="handleSubmit">
            <div class="form-group">
              <label class="form-label" for="contact-name">姓名</label>
              <div class="input-wrap">
                <input
                  id="contact-name"
                  v-model="formData.name"
                  type="text"
                  class="glow-input"
                  placeholder="请输入你的姓名"
                  required
                />
                <span class="input-focus-line"></span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-email">邮箱</label>
              <div class="input-wrap">
                <input
                  id="contact-email"
                  v-model="formData.email"
                  type="email"
                  class="glow-input"
                  placeholder="请输入你的邮箱"
                  required
                />
                <span class="input-focus-line"></span>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="contact-message">留言内容</label>
              <div class="input-wrap">
                <textarea
                  id="contact-message"
                  v-model="formData.message"
                  class="glow-input glow-textarea"
                  placeholder="请输入你想说的话..."
                  rows="5"
                  required
                ></textarea>
                <span class="input-focus-line"></span>
              </div>
            </div>

            <button
              type="submit"
              class="glow-btn submit-btn"
              :class="{ submitting: isSubmitting }"
              :disabled="isSubmitting"
            >
              <span class="btn-text">{{ isSubmitting ? '发送中...' : '发送消息' }}</span>
              <svg v-if="!isSubmitting" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
              <span v-else class="btn-spinner"></span>
            </button>
          </form>
        </div>
      </div>

      <!-- 底部 -->
      <div class="footer reveal">
        <div class="footer-divider"></div>
        <p class="footer-text">
          © 2024 var · 以代码编织创意
        </p>
        <p class="footer-sub">
          使用 Vue.js + TypeScript 构建 · 设计灵感源于自然
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.contact-grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 4rem;
  align-items: start;
}

/* 左侧信息 */
.contact-text {
  font-size: 1.05rem;
  line-height: 1.9;
  color: var(--color-text-inv-light);
  margin-bottom: 1rem;
  font-weight: 300;
}

.contact-details {
  margin: 2rem 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
  transition: transform 0.3s;
}

.detail-item:hover {
  transform: translateX(6px);
}

.detail-icon { font-size: 1.1rem; }

.detail-text {
  font-size: 0.95rem;
  color: rgba(245, 240, 235, 0.75);
}

/* 磁吸社交按钮 — 增强版 */
.social-links {
  display: flex;
  gap: 16px;
  margin-top: 2rem;
}

.social-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 18px 22px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius);
  transition: all 0.35s var(--ease);
  cursor: pointer;
  min-width: 76px;
  position: relative;
  overflow: hidden;
}

.social-glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, var(--btn-color, var(--color-accent)), transparent 70%);
  opacity: 0;
  transition: opacity 0.4s;
  pointer-events: none;
}

.social-btn:hover {
  border-color: var(--btn-color, var(--color-accent));
  box-shadow:
    0 4px 24px rgba(124, 140, 110, 0.2),
    0 0 50px rgba(124, 140, 110, 0.08);
}

.social-btn:hover .social-glow {
  opacity: 0.08;
}

.social-icon {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--color-text-inv);
  font-family: var(--font-sans);
  letter-spacing: -0.02em;
  transition: transform 0.3s var(--ease-spring);
}

.social-btn:hover .social-icon {
  transform: scale(1.2) translateY(-2px);
}

.social-name {
  font-size: 0.7rem;
  color: rgba(245, 240, 235, 0.45);
  font-weight: 400;
  letter-spacing: 0.05em;
  transition: color 0.3s;
}

.social-btn:hover .social-name {
  color: var(--color-accent-light);
}

/* 联系表单 */
.contact-form {
  padding: 2.5rem;
}

.form-group { margin-bottom: 1.5rem; }

.form-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 400;
  color: rgba(245, 240, 235, 0.55);
  margin-bottom: 8px;
  letter-spacing: 0.05em;
  transition: color 0.3s;
}

.form-group:focus-within .form-label {
  color: var(--color-accent-light);
}

/* 输入框底部聚焦线 */
.input-wrap {
  position: relative;
}

.input-focus-line {
  position: absolute;
  bottom: 0;
  left: 50%;
  width: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-accent), var(--color-accent-light));
  transition: all 0.4s var(--ease);
  transform: translateX(-50%);
  border-radius: var(--radius-full);
}

.input-wrap:focus-within .input-focus-line {
  width: 100%;
}

.glow-textarea {
  resize: vertical;
  min-height: 120px;
  font-family: var(--font-sans);
  line-height: 1.6;
}

/* 提交按钮 */
.submit-btn {
  width: 100%;
  justify-content: center;
  margin-top: 0.5rem;
  padding: 16px 32px;
  font-size: 1rem;
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

/* Footer */
.footer {
  margin-top: 5rem;
  text-align: center;
}

.footer-divider {
  width: 60px;
  height: 1px;
  background: rgba(255, 255, 255, 0.12);
  margin: 0 auto 2rem;
}

.footer-text {
  font-family: 'Courier New', monospace;
  font-size: 0.9rem;
  color: rgba(245, 240, 235, 0.5);
  margin-bottom: 0.5rem;
}

.footer-sub {
  font-size: 0.8rem;
  color: rgba(245, 240, 235, 0.25);
  font-weight: 300;
}

/* 响应式 */
@media (max-width: 768px) {
  .contact-grid { grid-template-columns: 1fr; gap: 2.5rem; }
  .social-links { justify-content: center; flex-wrap: wrap; }
  .contact-form { padding: 1.5rem; }
}
</style>
