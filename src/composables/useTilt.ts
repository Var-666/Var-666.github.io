import { onUnmounted } from 'vue'

interface TiltState {
  el: HTMLElement
  onMove: (e: MouseEvent) => void
  onLeave: () => void
}

/**
 * 3D 倾斜效果 composable
 * 灵感来源: Codepen — 3D card tilt on hover
 * 卡片根据鼠标位置倾斜，产生视差深度感
 * 同时设置 CSS 变量 --tilt-x / --tilt-y 供光泽效果使用
 */
export function useTilt(options?: {
  max?: number
  scale?: number
  speed?: number
}) {
  const { max = 10, scale = 1.03, speed = 300 } = options ?? {}
  const states: TiltState[] = []

  function bind(el: HTMLElement) {
    el.style.willChange = 'transform'
    el.style.transformStyle = 'preserve-3d'

    const onMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width   // 0 → 1
      const y = (e.clientY - rect.top) / rect.height    // 0 → 1
      const tiltX = (0.5 - y) * max * 2
      const tiltY = (x - 0.5) * max * 2

      el.style.transition = 'transform 0.12s ease-out'
      el.style.transform =
        `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${scale},${scale},${scale})`

      // 暴露位置给 CSS，用于光泽 / 光晕
      el.style.setProperty('--tilt-x', `${x * 100}%`)
      el.style.setProperty('--tilt-y', `${y * 100}%`)
    }

    const onLeave = () => {
      el.style.transition = `transform ${speed}ms cubic-bezier(0.4, 0, 0.2, 1)`
      el.style.transform =
        'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)'
    }

    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    states.push({ el, onMove, onLeave })
  }

  function unbindAll() {
    for (const { el, onMove, onLeave } of states) {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
      el.style.willChange = ''
      el.style.transform = ''
    }
    states.length = 0
  }

  onUnmounted(unbindAll)
  return { bind, unbindAll }
}
