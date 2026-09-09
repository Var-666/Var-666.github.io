import { onUnmounted } from 'vue'

/**
 * 滚动渐入效果 composable
 * 灵感来源: Codepen — scroll-driven reveal animations
 * 基于 IntersectionObserver，元素进入视口时触发渐入动画
 */
export function useScrollReveal(options?: {
  threshold?: number
  rootMargin?: string
  once?: boolean
}) {
  const {
    threshold = 0.15,
    rootMargin = '0px 0px -50px 0px',
    once = true,
  } = options ?? {}

  const observedElements = new Set<Element>()

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed')
          if (once) {
            observer.unobserve(entry.target)
            observedElements.delete(entry.target)
          }
        } else if (!once) {
          entry.target.classList.remove('revealed')
        }
      }
    },
    { threshold, rootMargin }
  )

  function observe(el: Element) {
    observedElements.add(el)
    observer.observe(el)
  }

  function unobserve(el: Element) {
    observer.unobserve(el)
    observedElements.delete(el)
  }

  function observeAll(selector: string, container?: Element) {
    const root = container ?? document
    const elements = root.querySelectorAll(selector)
    elements.forEach((el) => observe(el))
  }

  function cleanup() {
    observedElements.forEach((el) => observer.unobserve(el))
    observedElements.clear()
    observer.disconnect()
  }

  onUnmounted(() => {
    cleanup()
  })

  return { observe, unobserve, observeAll, cleanup }
}
