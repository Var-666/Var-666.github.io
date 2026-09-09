import { ref, onUnmounted } from 'vue'

/**
 * 打字机效果 composable
 * 灵感来源: Codepen — CSS/JS typewriter effects
 * 逐字显示文本，支持多行文字循环、删除动画
 */
export function useTypewriter(
  texts: string[],
  typingSpeed = 100,
  deletingSpeed = 50,
  pauseTime = 2500,
  deletePause = 800
) {
  const displayText = ref('')
  const isTyping = ref(true)
  const currentIndex = ref(0)

  let timeoutId: ReturnType<typeof setTimeout> | null = null
  let isDeleting = false
  let charIndex = 0
  let running = false

  function tick() {
    if (!running) return

    const currentText = texts[currentIndex.value]

    if (!isDeleting) {
      // 正在输入
      charIndex++
      displayText.value = currentText.slice(0, charIndex)
      isTyping.value = true

      if (charIndex === currentText.length) {
        // 输入完成，暂停后开始删除
        isTyping.value = false
        timeoutId = setTimeout(() => {
          isDeleting = true
          tick()
        }, pauseTime)
        return
      }

      // 模拟自然打字节奏 — 随机波动
      const jitter = typingSpeed + (Math.random() - 0.5) * 60
      timeoutId = setTimeout(tick, jitter)
    } else {
      // 正在删除
      charIndex--
      displayText.value = currentText.slice(0, charIndex)
      isTyping.value = true

      if (charIndex === 0) {
        // 删除完成，切换到下一条文字
        isDeleting = false
        currentIndex.value = (currentIndex.value + 1) % texts.length
        timeoutId = setTimeout(tick, deletePause)
        return
      }

      timeoutId = setTimeout(tick, deletingSpeed)
    }
  }

  function start() {
    if (running) return
    running = true
    charIndex = 0
    displayText.value = ''
    isDeleting = false
    currentIndex.value = 0
    tick()
  }

  function stop() {
    running = false
    if (timeoutId !== null) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  onUnmounted(() => {
    stop()
  })

  return { displayText, isTyping, currentIndex, start, stop }
}
