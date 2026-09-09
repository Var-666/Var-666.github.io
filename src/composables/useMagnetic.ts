import { onUnmounted } from 'vue'

interface MagneticState {
  el: HTMLElement
  onMouseMove: (e: MouseEvent) => void
  onMouseLeave: () => void
}

/**
 * 磁吸效果 composable
 * 灵感来源: Codepen — magnetic button hover effect
 * 鼠标接近元素时，元素被"吸引"向光标方向偏移
 */
export function useMagnetic(strength = 0.3, threshold = 100) {
  const states: MagneticState[] = []

  function bind(el: HTMLElement) {
    // 添加 will-change 提示浏览器优化
    el.style.willChange = 'transform'
    el.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'

    const onMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const dx = e.clientX - centerX
      const dy = e.clientY - centerY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const maxDist = Math.max(rect.width, rect.height) / 2 + threshold

      if (dist < maxDist) {
        const factor = (1 - dist / maxDist) * strength
        const moveX = dx * factor
        const moveY = dy * factor
        el.style.transform = `translate(${moveX}px, ${moveY}px)`
      } else {
        el.style.transform = 'translate(0, 0)'
      }
    }

    const onMouseLeave = () => {
      el.style.transform = 'translate(0, 0)'
    }

    // 使用 window 级监听以获得更大的触发区域
    window.addEventListener('mousemove', onMouseMove)
    el.addEventListener('mouseleave', onMouseLeave)

    states.push({ el, onMouseMove, onMouseLeave })
  }

  function unbind(el: HTMLElement) {
    const idx = states.findIndex(s => s.el === el)
    if (idx !== -1) {
      const state = states[idx]
      window.removeEventListener('mousemove', state.onMouseMove)
      el.removeEventListener('mouseleave', state.onMouseLeave)
      el.style.willChange = ''
      el.style.transform = ''
      states.splice(idx, 1)
    }
  }

  function unbindAll() {
    for (const state of [...states]) {
      unbind(state.el)
    }
  }

  onUnmounted(() => {
    unbindAll()
  })

  return { bind, unbind, unbindAll }
}
