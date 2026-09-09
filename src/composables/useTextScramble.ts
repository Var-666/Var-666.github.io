import { ref, onUnmounted } from 'vue'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&<>{}[]'

/**
 * 文字解码/扰乱效果 composable
 * 灵感来源: Codepen — text scramble / decode animation
 * 字符依次从随机噪声中"解码"为目标文字
 */
export function useTextScramble() {
  const output = ref('')
  let frameId: number | null = null

  function scramble(text: string, duration = 1000): Promise<void> {
    return new Promise(resolve => {
      const len = text.length
      let frame = 0
      const totalFrames = Math.ceil(duration / 22)

      function update() {
        const progress = frame / totalFrames
        let result = ''

        for (let i = 0; i < len; i++) {
          if (text[i] === ' ') {
            result += ' '
          } else if (progress > (i + 0.8) / len) {
            // 该字符已解码
            result += text[i]
          } else {
            result += CHARS[Math.floor(Math.random() * CHARS.length)]
          }
        }

        output.value = result
        frame++

        if (frame <= totalFrames) {
          frameId = requestAnimationFrame(update)
        } else {
          output.value = text
          resolve()
        }
      }

      if (frameId) cancelAnimationFrame(frameId)
      update()
    })
  }

  function cancel() {
    if (frameId) {
      cancelAnimationFrame(frameId)
      frameId = null
    }
  }

  onUnmounted(cancel)
  return { output, scramble, cancel }
}
