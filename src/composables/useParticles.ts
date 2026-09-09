import { ref, onUnmounted } from 'vue'

interface Particle {
  x: number
  y: number
  radius: number
  baseRadius: number
  color: string
  vx: number
  vy: number
  opacity: number
  baseOpacity: number
  phase: number       // 相位偏移，用于正弦波运动
  pulseSpeed: number   // 脉冲速度
  drift: number        // 横向漂移幅度
}

/**
 * Canvas 粒子系统 composable
 * 灵感来源: Codepen — 萤火虫/花粉漂浮效果
 * 使用 requestAnimationFrame 实现缓慢、自然的粒子运动
 */
export function useParticles() {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let particles: Particle[] = []
  let animationId: number | null = null
  let mouseX = -1000
  let mouseY = -1000
  const isRunning = ref(false)

  const PARTICLE_COUNT = 65
  const CONNECTION_DISTANCE = 120
  const MOUSE_RADIUS = 150

  // 大地色系 + 自然色粒子颜色
  const COLORS = [
    'rgba(245, 240, 235, VAR)',   // 米白
    'rgba(154, 171, 139, VAR)',   // 橄榄绿浅
    'rgba(124, 140, 110, VAR)',   // 橄榄绿
    'rgba(196, 168, 130, VAR)',   // 暖棕
    'rgba(212, 196, 168, VAR)',   // 暖米
  ]

  function createParticle(width: number, height: number): Particle {
    const baseOpacity = 0.15 + Math.random() * 0.45
    const colorTemplate = COLORS[Math.floor(Math.random() * COLORS.length)]
    const radius = 1 + Math.random() * 2.5

    return {
      x: Math.random() * width,
      y: Math.random() * height,
      radius,
      baseRadius: radius,
      color: colorTemplate.replace('VAR', String(baseOpacity)),
      vx: (Math.random() - 0.5) * 0.3,
      vy: -0.1 - Math.random() * 0.3,  // 缓慢上升
      opacity: baseOpacity,
      baseOpacity,
      phase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.005 + Math.random() * 0.015,
      drift: 0.3 + Math.random() * 0.8,
    }
  }

  function initParticles(width: number, height: number) {
    particles = []
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(createParticle(width, height))
    }
  }

  function drawParticle(p: Particle) {
    if (!ctx) return

    // 脉冲效果 — 半径随时间缓慢变化
    const pulse = Math.sin(p.phase) * 0.3 + 1
    const r = p.baseRadius * pulse

    // 绘制发光效果
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 3)
    gradient.addColorStop(0, p.color)
    gradient.addColorStop(1, 'transparent')

    ctx.beginPath()
    ctx.arc(p.x, p.y, r * 3, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // 绘制核心亮点
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fillStyle = p.color
    ctx.fill()
  }

  function drawConnections() {
    if (!ctx) return

    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const dist = Math.sqrt(dx * dx + dy * dy)

        if (dist < CONNECTION_DISTANCE) {
          const opacity = (1 - dist / CONNECTION_DISTANCE) * 0.08
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(154, 171, 139, ${opacity})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }
  }

  function updateParticle(p: Particle, width: number, height: number) {
    // 更新相位（脉冲动画）
    p.phase += p.pulseSpeed

    // 正弦波横向漂移 — 模拟自然飘动
    p.x += p.vx + Math.sin(p.phase) * p.drift * 0.02
    p.y += p.vy

    // 鼠标交互 — 粒子被轻轻推开
    const dx = p.x - mouseX
    const dy = p.y - mouseY
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < MOUSE_RADIUS && dist > 0) {
      const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.5
      p.x += (dx / dist) * force
      p.y += (dy / dist) * force
    }

    // 边界环绕
    if (p.y < -20) {
      p.y = height + 20
      p.x = Math.random() * width
    }
    if (p.x < -20) p.x = width + 20
    if (p.x > width + 20) p.x = -20
  }

  function animate() {
    if (!ctx || !canvas) return

    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

    // 绘制连接线
    drawConnections()

    // 更新并绘制粒子
    for (const p of particles) {
      updateParticle(p, canvas.offsetWidth, canvas.offsetHeight)
      drawParticle(p)
    }

    animationId = requestAnimationFrame(animate)
  }

  function handleResize() {
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)
    initParticles(canvas.offsetWidth, canvas.offsetHeight)
  }

  function handleMouseMove(e: MouseEvent) {
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseX = e.clientX - rect.left
    mouseY = e.clientY - rect.top
  }

  function handleMouseLeave() {
    mouseX = -1000
    mouseY = -1000
  }

  function init(canvasEl: HTMLCanvasElement) {
    canvas = canvasEl
    ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * dpr
    canvas.height = canvas.offsetHeight * dpr
    ctx.scale(dpr, dpr)

    initParticles(canvas.offsetWidth, canvas.offsetHeight)

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseleave', handleMouseLeave)
    window.addEventListener('resize', handleResize)

    isRunning.value = true
    animate()

    // 离屏暂停
    const visObs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) {
        if (!animationId) animate()
      } else {
        if (animationId) {
          cancelAnimationFrame(animationId)
          animationId = null
        }
      }
    }, { threshold: 0.05 })
    visObs.observe(canvas)
  }

  function destroy() {
    if (animationId !== null) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
    if (canvas) {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseleave', handleMouseLeave)
    }
    window.removeEventListener('resize', handleResize)
    particles = []
    canvas = null
    ctx = null
    isRunning.value = false
  }

  onUnmounted(() => {
    destroy()
  })

  return { init, destroy, isRunning }
}
