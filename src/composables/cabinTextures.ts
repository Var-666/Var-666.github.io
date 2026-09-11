import * as THREE from 'three'

/**
 * 辅助：将 HTML5 Canvas 包装为 Three.js 纹理
 */
function canvasToTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.generateMipmaps = true
  return tex
}

/**
 * 1. 木屋实木地板纹理 (带真实木纹条板、拼缝与铆钉细节)
 */
export function createWoodFloorTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!

  // 底色：温润暖胡桃木色
  ctx.fillStyle = '#6b4728'
  ctx.fillRect(0, 0, 1024, 1024)

  // 绘制横向实木条板
  const plankHeight = 64
  const totalPlanks = 1024 / plankHeight

  for (let i = 0; i < totalPlanks; i++) {
    const y = i * plankHeight
    // 稍微变化的条板底色
    const toneVariation = Math.sin(i * 1.7) * 12 + Math.cos(i * 3.1) * 8
    const r = Math.min(255, Math.max(0, 107 + toneVariation))
    const g = Math.min(255, Math.max(0, 71 + toneVariation * 0.8))
    const b = Math.min(255, Math.max(0, 40 + toneVariation * 0.6))
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(0, y, 1024, plankHeight)

    // 木材纤维细纹
    ctx.fillStyle = 'rgba(0, 0, 0, 0.04)'
    for (let f = 0; f < 12; f++) {
      const fy = y + (f / 12) * plankHeight
      ctx.fillRect(0, fy, 1024, 1.5)
    }

    // 条板缝隙阴影与高光
    ctx.fillStyle = 'rgba(25, 14, 8, 0.7)'
    ctx.fillRect(0, y + plankHeight - 3, 1024, 3)
    ctx.fillStyle = 'rgba(255, 230, 190, 0.15)'
    ctx.fillRect(0, y, 1024, 1.5)

    // 随机交错的垂直缝隙与铜钉
    const staggerOffset = i % 2 === 0 ? 0 : 256
    for (let x = staggerOffset; x < 1024; x += 512) {
      ctx.fillStyle = 'rgba(25, 14, 8, 0.75)'
      ctx.fillRect(x - 1.5, y, 3, plankHeight)
      // 铜钉
      ctx.fillStyle = '#2d1b0f'
      ctx.beginPath()
      ctx.arc(x - 12, y + 16, 2.5, 0, Math.PI * 2)
      ctx.arc(x - 12, y + plankHeight - 16, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  const tex = canvasToTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 2)
  return tex
}

/**
 * 2. 墙面挂毯："Good Ideas Live Here 🌲"
 */
export function createTapestryTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 768
  const ctx = canvas.getContext('2d')!

  // 米白色厚棉麻布质感
  ctx.fillStyle = '#f4ede2'
  ctx.fillRect(0, 0, 512, 768)

  // 织物边缘深色包边
  ctx.strokeStyle = '#e2d3c1'
  ctx.lineWidth = 14
  ctx.strokeRect(10, 10, 492, 748)

  // 底部流苏阴影
  ctx.fillStyle = '#d8c4ad'
  for (let x = 30; x < 482; x += 18) {
    ctx.fillRect(x, 750, 10, 18)
  }

  // 文字：Good Ideas Live Here
  ctx.fillStyle = '#2f3e34'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  ctx.font = 'bold 54px Georgia, serif'
  ctx.fillText('Good', 256, 170)
  ctx.fillText('Ideas', 256, 260)
  ctx.fillText('Live', 256, 350)
  ctx.fillText('Here', 256, 440)

  // 底部松树绿色剪影 🌲
  ctx.fillStyle = '#395b45'
  drawPineTreeIcon(ctx, 256, 570, 48)

  return canvasToTexture(canvas)
}

/**
 * 3. 电脑显示器屏幕壁纸（远方雪山、蓝天与近处松林）
 */
export function createScreenWallpaperTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 320
  const ctx = canvas.getContext('2d')!

  // 蔚蓝晴空渐变
  const skyGrad = ctx.createLinearGradient(0, 0, 0, 200)
  skyGrad.addColorStop(0, '#54a0ff')
  skyGrad.addColorStop(0.65, '#a0c4ff')
  skyGrad.addColorStop(1, '#dff9fb')
  ctx.fillStyle = skyGrad
  ctx.fillRect(0, 0, 512, 320)

  // 太阳微光
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)'
  ctx.beginPath()
  ctx.arc(380, 80, 36, 0, Math.PI * 2)
  ctx.fill()

  // 远景连绵雪山群（深灰蓝 + 白雪峰顶）
  ctx.fillStyle = '#576574'
  ctx.beginPath()
  ctx.moveTo(40, 240)
  ctx.lineTo(160, 90)
  ctx.lineTo(270, 240)
  ctx.closePath()
  ctx.fill()

  // 雪顶
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(160, 90)
  ctx.lineTo(125, 135)
  ctx.lineTo(150, 130)
  ctx.lineTo(160, 140)
  ctx.lineTo(175, 128)
  ctx.lineTo(195, 135)
  ctx.closePath()
  ctx.fill()

  // 第二座主峰
  ctx.fillStyle = '#485460'
  ctx.beginPath()
  ctx.moveTo(220, 240)
  ctx.lineTo(340, 110)
  ctx.lineTo(460, 240)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#f1f2f6'
  ctx.beginPath()
  ctx.moveTo(340, 110)
  ctx.lineTo(305, 150)
  ctx.lineTo(330, 144)
  ctx.lineTo(340, 155)
  ctx.lineTo(375, 150)
  ctx.closePath()
  ctx.fill()

  // 近处绿色山丘与松林
  ctx.fillStyle = '#2e86de'
  ctx.fillRect(0, 230, 512, 20) // 湖泊水面

  ctx.fillStyle = '#218c74'
  ctx.beginPath()
  ctx.ellipse(256, 280, 300, 70, 0, 0, Math.PI * 2)
  ctx.fill()

  // 几颗前景松树剪影
  ctx.fillStyle = '#1e3725'
  for (let x = 60; x < 480; x += 70) {
    drawPineTreeIcon(ctx, x, 255, 18)
  }

  // 底部极简任务栏
  ctx.fillStyle = 'rgba(20, 25, 30, 0.85)'
  ctx.fillRect(0, 298, 512, 22)
  ctx.fillStyle = '#00d2d3'
  ctx.beginPath()
  ctx.arc(20, 309, 5, 0, Math.PI * 2)
  ctx.fill()

  return canvasToTexture(canvas)
}

/**
 * 4. 告示板："Small Steps Brighter Days 🌲"、拍立得照片与便利贴
 */
export function createBulletinBoardTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext('2d')!

  // 软木板底纹 (Cork Texture)
  ctx.fillStyle = '#c89968'
  ctx.fillRect(0, 0, 1024, 768)

  // 软木颗粒杂点
  for (let i = 0; i < 6000; i++) {
    const px = Math.random() * 1024
    const py = Math.random() * 768
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(90, 55, 30, 0.15)' : 'rgba(240, 200, 160, 0.2)'
    ctx.fillRect(px, py, 2, 2)
  }

  // 木质外边框
  ctx.strokeStyle = '#6d4c28'
  ctx.lineWidth = 18
  ctx.strokeRect(9, 9, 1006, 750)

  // ── A. 左侧：开发者与像素探险拍立得相片 ──
  // 相片 1 (左上)
  ctx.save()
  ctx.translate(140, 180)
  ctx.rotate(-0.06)
  ctx.fillStyle = '#f8f9fa'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 8
  ctx.fillRect(-70, -85, 140, 170)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#70a1ff'
  ctx.fillRect(-60, -75, 120, 115)
  ctx.fillStyle = '#2ed573'
  ctx.fillRect(-60, 0, 120, 40)
  ctx.fillStyle = '#eccc68' // 探险小人脸庞
  ctx.beginPath()
  ctx.arc(0, -20, 22, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ff4757' // 红帽子
  ctx.beginPath()
  ctx.arc(0, -28, 24, Math.PI, Math.PI * 2)
  ctx.fill()
  // 红色工字按钉
  ctx.fillStyle = '#ff4757'
  ctx.beginPath()
  ctx.arc(0, -78, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 相片 2 (左下)
  ctx.save()
  ctx.translate(150, 440)
  ctx.rotate(0.04)
  ctx.fillStyle = '#f8f9fa'
  ctx.shadowColor = 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = 8
  ctx.fillRect(-75, -90, 150, 180)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#ffa502' // 夕阳金辉
  ctx.fillRect(-65, -80, 130, 125)
  ctx.fillStyle = '#3742fa'
  drawPineTreeIcon(ctx, -15, -10, 22)
  drawPineTreeIcon(ctx, 25, 0, 16)
  // 蓝色按钉
  ctx.fillStyle = '#1e90ff'
  ctx.beginPath()
  ctx.arc(0, -82, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── B. 中央：核心标语大卡片 "Small Steps Brighter Days" ──
  ctx.save()
  ctx.translate(520, 360)
  ctx.rotate(-0.015)
  ctx.fillStyle = '#fff9f0'
  ctx.shadowColor = 'rgba(0,0,0,0.35)'
  ctx.shadowBlur = 12
  ctx.fillRect(-175, -230, 350, 460)
  ctx.shadowBlur = 0

  // 内部手绘边框
  ctx.strokeStyle = '#e6d5c3'
  ctx.lineWidth = 3
  ctx.strokeRect(-160, -215, 320, 430)

  // 标语文案
  ctx.fillStyle = '#4b382a'
  ctx.textAlign = 'center'
  ctx.font = 'bold 50px Georgia, serif'
  ctx.fillText('Small', 0, -110)
  ctx.fillText('Steps', 0, -35)

  ctx.fillStyle = '#c0392b' // 点睛红
  ctx.fillText('Brighter', 0, 50)

  ctx.fillStyle = '#4b382a'
  ctx.fillText('Days', 0, 130)

  // 底部绿色松树 🌲
  ctx.fillStyle = '#27ae60'
  drawPineTreeIcon(ctx, 0, 185, 24)

  // 顶部两枚黄铜固定图钉
  ctx.fillStyle = '#f1c40f'
  ctx.beginPath()
  ctx.arc(-130, -215, 7, 0, Math.PI * 2)
  ctx.arc(130, -215, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // ── C. 右侧：彩色便签贴与 Checklist ──
  // 便签 1：明黄色待办便利贴
  ctx.save()
  ctx.translate(850, 200)
  ctx.rotate(0.05)
  ctx.fillStyle = '#fffa65'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 6
  ctx.fillRect(-70, -70, 140, 140)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#4b4b4b'
  ctx.font = 'bold 16px monospace'
  ctx.fillText('✔ 3D Cabin', -55, -30)
  ctx.fillText('✔ Isometric', -55, -2)
  ctx.fillText('✔ Real Assets', -55, 26)
  ctx.fillText('◻ New Island', -55, 54)
  ctx.fillStyle = '#ff4757'
  ctx.beginPath()
  ctx.arc(0, -64, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 便签 2：薄荷绿笔记
  ctx.save()
  ctx.translate(840, 480)
  ctx.rotate(-0.04)
  ctx.fillStyle = '#7bed9f'
  ctx.shadowColor = 'rgba(0,0,0,0.25)'
  ctx.shadowBlur = 6
  ctx.fillRect(-75, -65, 150, 130)
  ctx.shadowBlur = 0
  ctx.fillStyle = '#2f3542'
  ctx.font = 'italic 16px sans-serif'
  ctx.fillText('"Stay curious,', -58, -25)
  ctx.fillText('keep building."', -58, 2)
  ctx.fillText('— 2026', -58, 32)
  ctx.fillStyle = '#5352ed'
  ctx.beginPath()
  ctx.arc(0, -58, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  return canvasToTexture(canvas)
}

/**
 * 5. 中央大桌展开的羊皮纸大地图（地形等高线、河流、森林与罗盘）
 */
export function createAdventureMapTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext('2d')!

  // 古典羊皮纸底色
  ctx.fillStyle = '#f3e6cf'
  ctx.fillRect(0, 0, 1024, 768)

  // 纸张边缘泛黄与水渍做旧
  const edgeGrad = ctx.createRadialGradient(512, 384, 280, 512, 384, 550)
  edgeGrad.addColorStop(0, 'rgba(0,0,0,0)')
  edgeGrad.addColorStop(1, 'rgba(120, 75, 35, 0.45)')
  ctx.fillStyle = edgeGrad
  ctx.fillRect(0, 0, 1024, 768)

  // 双层古典复古手绘边框
  ctx.strokeStyle = '#8c6239'
  ctx.lineWidth = 6
  ctx.strokeRect(24, 24, 976, 720)
  ctx.lineWidth = 2
  ctx.strokeRect(36, 36, 952, 696)

  // 绿意森林群聚区域（淡苔藓绿块面）
  ctx.fillStyle = 'rgba(76, 175, 80, 0.35)'
  ctx.beginPath()
  ctx.ellipse(220, 220, 140, 90, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(780, 520, 150, 110, -0.2, 0, Math.PI * 2)
  ctx.fill()

  // 蜿蜒曲折的湛蓝江河
  ctx.strokeStyle = '#3498db'
  ctx.lineWidth = 14
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(80, 500)
  ctx.bezierCurveTo(280, 480, 360, 320, 512, 360)
  ctx.bezierCurveTo(680, 400, 760, 220, 960, 240)
  ctx.stroke()

  // 河流浅色高光
  ctx.strokeStyle = '#a0d8ef'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(80, 498)
  ctx.bezierCurveTo(280, 478, 360, 318, 512, 358)
  ctx.bezierCurveTo(680, 398, 760, 218, 960, 238)
  ctx.stroke()

  // 地形等高线细纹
  ctx.strokeStyle = 'rgba(160, 110, 60, 0.35)'
  ctx.lineWidth = 1.5
  for (let r = 40; r <= 160; r += 24) {
    ctx.beginPath()
    ctx.ellipse(540, 330, r * 1.6, r, 0.2, 0, Math.PI * 2)
    ctx.stroke()
  }

  // 右下角古式罗盘玫瑰 (Compass Rose)
  ctx.save()
  ctx.translate(860, 620)
  ctx.strokeStyle = '#795548'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.arc(0, 0, 45, 0, Math.PI * 2)
  ctx.stroke()
  ctx.fillStyle = '#c0392b'
  ctx.beginPath()
  ctx.moveTo(0, -45)
  ctx.lineTo(8, 0)
  ctx.lineTo(0, -8)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#2c3e50'
  ctx.beginPath()
  ctx.moveTo(0, 45)
  ctx.lineTo(-8, 0)
  ctx.lineTo(0, 8)
  ctx.closePath()
  ctx.fill()
  ctx.font = 'bold 18px serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#795548'
  ctx.fillText('N', 0, -52)
  ctx.restore()

  // 地图手写题头
  ctx.font = 'bold 28px Georgia, serif'
  ctx.fillStyle = '#5d4037'
  ctx.fillText('TERRA INCOGNITA • 探索全域图', 70, 80)

  return canvasToTexture(canvas)
}

/**
 * 6. 中央大桌下铺垫的大型森林绿几何毛毯
 */
export function createGreenRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // 橄榄墨绿底色
  ctx.fillStyle = '#2c4735'
  ctx.fillRect(0, 0, 512, 512)

  // 双层米白几何回纹宽镶边
  ctx.strokeStyle = '#e8dcc8'
  ctx.lineWidth = 16
  ctx.strokeRect(18, 18, 476, 476)

  ctx.strokeStyle = '#a38f78'
  ctx.lineWidth = 4
  ctx.strokeRect(36, 36, 440, 440)

  // 毯心深绿渐层
  ctx.fillStyle = '#23392a'
  ctx.fillRect(52, 52, 408, 408)

  // 毯心微型菱格纹点阵
  ctx.fillStyle = 'rgba(232, 220, 200, 0.25)'
  for (let x = 80; x <= 432; x += 44) {
    for (let y = 80; y <= 432; y += 44) {
      ctx.beginPath()
      ctx.moveTo(x, y - 6)
      ctx.lineTo(x + 6, y)
      ctx.lineTo(x, y + 6)
      ctx.lineTo(x - 6, y)
      ctx.closePath()
      ctx.fill()
    }
  }

  // 四角吉祥结装饰花角
  for (const [cx, cy] of [
    [28, 28],
    [484, 28],
    [28, 484],
    [484, 484],
  ]) {
    ctx.fillStyle = '#e8dcc8'
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fill()
  }

  return canvasToTexture(canvas)
}

/**
 * 7. 床边古典酒红花纹波斯长毯
 */
export function createBurgundyRugTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 512
  const ctx = canvas.getContext('2d')!

  // 浓郁勃艮第酒红
  ctx.fillStyle = '#5c222c'
  ctx.fillRect(0, 0, 512, 512)

  // 经典东方古典花框镶边
  ctx.strokeStyle = '#dfb572'
  ctx.lineWidth = 12
  ctx.strokeRect(20, 20, 472, 472)

  ctx.strokeStyle = '#2d1117'
  ctx.lineWidth = 6
  ctx.strokeRect(32, 32, 448, 448)

  // 中心八边形波斯曼陀罗勋章
  ctx.save()
  ctx.translate(256, 256)
  ctx.fillStyle = '#2d1117'
  ctx.beginPath()
  ctx.arc(0, 0, 110, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#dfb572'
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(0, 0, 104, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = '#7a313e'
  ctx.beginPath()
  ctx.arc(0, 0, 70, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#dfb572'
  ctx.beginPath()
  ctx.arc(0, 0, 24, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()

  // 左右两侧白色棉流苏
  ctx.fillStyle = '#e8dfd8'
  for (let y = 16; y < 500; y += 8) {
    ctx.fillRect(4, y, 14, 3)
    ctx.fillRect(494, y, 14, 3)
  }

  return canvasToTexture(canvas)
}

/**
 * 8. 前沿木栅矮墙刻字："🌲 Curiosity leads to cool places."
 */
export function createRetainingWallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 1024
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // 深色杉木垂直板纹
  ctx.fillStyle = '#3a271c'
  ctx.fillRect(0, 0, 1024, 256)

  // 竖条木缝
  for (let x = 0; x < 1024; x += 64) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
    ctx.fillRect(x, 0, 3, 256)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
    ctx.fillRect(x + 3, 0, 1.5, 256)
  }

  // 温暖雕刻题字：Curiosity leads to cool places.
  ctx.save()
  ctx.translate(220, 128)

  // 松树标刻
  ctx.fillStyle = '#7c9c74'
  drawPineTreeIcon(ctx, -120, -10, 36)

  // 两行排版雕字
  ctx.font = 'bold 36px Georgia, serif'
  ctx.fillStyle = '#c8baa7'
  ctx.textAlign = 'left'
  ctx.fillText('Curiosity', -60, -15)
  ctx.font = '30px Georgia, serif'
  ctx.fillStyle = '#b0a08e'
  ctx.fillText('leads to cool places.', -60, 32)
  ctx.restore()

  return canvasToTexture(canvas)
}

/**
 * 9. 台阶口木路标："To New Adventures ➔"
 */
export function createSignpostTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 180
  const ctx = canvas.getContext('2d')!

  // 木招牌底色
  ctx.fillStyle = '#614126'
  ctx.fillRect(0, 0, 512, 180)

  // 雕刻边框
  ctx.strokeStyle = '#422a16'
  ctx.lineWidth = 8
  ctx.strokeRect(8, 8, 496, 164)

  // 白色手写指示刻字
  ctx.fillStyle = '#f5efe6'
  ctx.font = 'bold 44px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('To New', 220, 55)
  ctx.fillText('Adventures ➔', 256, 120)

  return canvasToTexture(canvas)
}

/**
 * 10. 背包后侧的绿色松树布章徽标
 */
export function createBackpackPatchTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!

  // 帆布卡其色底布
  ctx.fillStyle = '#9c7a56'
  ctx.fillRect(0, 0, 256, 256)

  // 缝线圆框
  ctx.strokeStyle = '#e0cfb8'
  ctx.lineWidth = 10
  ctx.setLineDash([14, 8])
  ctx.beginPath()
  ctx.arc(128, 128, 105, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  // 翠绿色饱满松树刺绣 🌲
  ctx.fillStyle = '#2d5a3c'
  drawPineTreeIcon(ctx, 128, 128, 64)

  return canvasToTexture(canvas)
}

/**
 * 通用：绘制极简饱满松树矢量图标
 */
function drawPineTreeIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  const trunkW = size * 0.22
  const trunkH = size * 0.35
  ctx.fillStyle = '#503522'
  ctx.fillRect(cx - trunkW / 2, cy + size * 0.35, trunkW, trunkH)

  const tiers = [
    { dy: -size * 0.35, w: size * 0.85, h: size * 0.55 },
    { dy: -size * 0.05, w: size * 1.1, h: size * 0.6 },
    { dy: size * 0.25, w: size * 1.35, h: size * 0.65 },
  ]
  for (const t of tiers) {
    ctx.fillStyle = '#2d5a3c'
    ctx.beginPath()
    ctx.moveTo(cx, cy + t.dy - t.h)
    ctx.lineTo(cx - t.w / 2, cy + t.dy)
    ctx.lineTo(cx + t.w / 2, cy + t.dy)
    ctx.closePath()
    ctx.fill()
  }
}
