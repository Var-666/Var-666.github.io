// 生成 PWA 图标与 OG 分享图。无第三方依赖：按几何形状直接绘制像素后编码为 PNG。
// 用法：node scripts/generate-icons.mjs（产物写入 apps/web/public/，需提交到 Git）。
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '../apps/web')
const SS = 3 // 每像素的超采样倍数，用于抗锯齿

// ---------- PNG 编码 ----------
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc32 = (buf) => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'ascii')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length)
  return out
}
function encodePng({ w, h, data }) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6 // 8-bit RGBA
  const stride = w * 4 + 1
  const raw = Buffer.alloc(stride * h)
  for (let y = 0; y < h; y++) {
    Buffer.from(data.buffer, y * w * 4, w * 4).copy(raw, y * stride + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------- 画布与几何绘制 ----------
function makeCanvas(w, h) {
  return { w, h, data: new Uint8ClampedArray(w * h * 4) }
}
// box 与 test 均使用画布像素坐标；内部换算到超采样网格求覆盖率后按源色混合。
function paint(c, [r, g, b, a], box, test) {
  const px0 = Math.max(0, Math.floor(box[0]))
  const py0 = Math.max(0, Math.floor(box[1]))
  const px1 = Math.min(c.w, Math.ceil(box[2]))
  const py1 = Math.min(c.h, Math.ceil(box[3]))
  for (let pyi = py0; pyi < py1; pyi++) {
    for (let pxi = px0; pxi < px1; pxi++) {
      let hit = 0
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          if (test(pxi + (sx + 0.5) / SS, pyi + (sy + 0.5) / SS)) hit++
        }
      }
      const alpha = (hit / (SS * SS)) * a
      if (alpha <= 0) continue
      const i = (pyi * c.w + pxi) * 4
      const da = c.data[i + 3] / 255
      const oa = alpha + da * (1 - alpha)
      c.data[i] = (r * alpha + c.data[i] * da * (1 - alpha)) / oa
      c.data[i + 1] = (g * alpha + c.data[i + 1] * da * (1 - alpha)) / oa
      c.data[i + 2] = (b * alpha + c.data[i + 2] * da * (1 - alpha)) / oa
      c.data[i + 3] = oa * 255
    }
  }
}
function roundRect(c, color, x, y, w, h, r) {
  paint(c, color, [x, y, x + w, y + h], (px, py) => {
    const rx = Math.max(Math.abs(px - (x + w / 2)) - (w / 2 - r), 0)
    const ry = Math.max(Math.abs(py - (y + h / 2)) - (h / 2 - r), 0)
    return rx * rx + ry * ry <= r * r
  })
}
function capsule(c, color, x0, y0, x1, y1, r) {
  paint(
    c,
    color,
    [Math.min(x0, x1) - r, Math.min(y0, y1) - r, Math.max(x0, x1) + r, Math.max(y0, y1) + r],
    (px, py) => {
      const dx = x1 - x0
      const dy = y1 - y0
      const t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)))
      const ex = px - (x0 + t * dx)
      const ey = py - (y0 + t * dy)
      return ex * ex + ey * ey <= r * r
    },
  )
}
function ring(c, color, cx, cy, r0, r1, rightOnly = false) {
  paint(c, color, [cx - (rightOnly ? r0 : r1), cy - r1, cx + r1, cy + r1], (px, py) => {
    if (rightOnly && px < cx) return false
    const d = Math.hypot(px - cx, py - cy)
    return d >= r0 && d <= r1
  })
}
function disc(c, color, cx, cy, r) {
  paint(c, color, [cx - r, cy - r, cx + r, cy + r], (px, py) => {
    const d = px - cx
    const e = py - cy
    return d * d + e * e <= r * r
  })
}

// ---------- 几何笔画字体（字高 100 单位，笔宽 18）----------
const S = 9
const glyphs = {
  V: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 6 * s, y + 9 * s, x + 42 * s, y + 91 * s, S * s)
      capsule(c, col, x + 78 * s, y + 9 * s, x + 42 * s, y + 91 * s, S * s)
    },
  },
  A: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 6 * s, y + 91 * s, x + 42 * s, y + 9 * s, S * s)
      capsule(c, col, x + 42 * s, y + 9 * s, x + 78 * s, y + 91 * s, S * s)
      capsule(c, col, x + 23 * s, y + 62 * s, x + 61 * s, y + 62 * s, 8 * s)
    },
  },
  R: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 9 * s, y + 9 * s, x + 9 * s, y + 91 * s, S * s)
      ring(c, col, x + 30 * s, y + 25 * s, 11 * s, 25 * s, true)
      capsule(c, col, x + 9 * s, y + 7 * s, x + 30 * s, y + 7 * s, 7 * s)
      capsule(c, col, x + 9 * s, y + 43 * s, x + 30 * s, y + 43 * s, 7 * s)
      capsule(c, col, x + 32 * s, y + 52 * s, x + 74 * s, y + 91 * s, 8 * s)
    },
  },
  T: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 6 * s, y + 9 * s, x + 78 * s, y + 9 * s, S * s)
      capsule(c, col, x + 42 * s, y + 9 * s, x + 42 * s, y + 91 * s, S * s)
    },
  },
  O: {
    advance: 106,
    draw: (c, col, x, y, s) => ring(c, col, x + 42 * s, y + 51 * s, 26 * s, 42 * s),
  },
  L: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 9 * s, y + 9 * s, x + 9 * s, y + 91 * s, S * s)
      capsule(c, col, x + 9 * s, y + 91 * s, x + 66 * s, y + 91 * s, S * s)
    },
  },
  B: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 9 * s, y + 9 * s, x + 9 * s, y + 91 * s, S * s)
      ring(c, col, x + 30 * s, y + 25 * s, 11 * s, 25 * s, true)
      capsule(c, col, x + 9 * s, y + 7 * s, x + 30 * s, y + 7 * s, 7 * s)
      capsule(c, col, x + 9 * s, y + 43 * s, x + 30 * s, y + 43 * s, 7 * s)
      ring(c, col, x + 32 * s, y + 72 * s, 13 * s, 27 * s, true)
      capsule(c, col, x + 9 * s, y + 52 * s, x + 32 * s, y + 52 * s, 7 * s)
      capsule(c, col, x + 9 * s, y + 92 * s, x + 32 * s, y + 92 * s, 7 * s)
    },
  },
  X: {
    advance: 106,
    draw: (c, col, x, y, s) => {
      capsule(c, col, x + 8 * s, y + 10 * s, x + 76 * s, y + 90 * s, 8 * s)
      capsule(c, col, x + 76 * s, y + 10 * s, x + 8 * s, y + 90 * s, 8 * s)
    },
  },
  '·': {
    advance: 40,
    draw: (c, col, x, y, s) => disc(c, col, x + 20 * s, y + 58 * s, 8 * s),
  },
  ' ': { advance: 52, draw: null },
}
function drawString(c, text, centerX, centerY, height, color) {
  const s = height / 100
  const total = [...text].reduce((sum, ch) => sum + glyphs[ch].advance, 0)
  let x = centerX - (total * s) / 2
  const top = centerY - 50 * s
  for (const ch of text) {
    glyphs[ch].draw?.(c, color, x, top, s)
    x += glyphs[ch].advance * s
  }
}

// ---------- 组合各产物 ----------
const BLUE = [70, 101, 232, 1] // #4665e8，站点主色
const WHITE = [255, 255, 255, 1]
const DARK = [16, 21, 36, 1] // #101524，深色主题背景

function appIcon(size, maskable) {
  const c = makeCanvas(size, size)
  if (maskable) roundRect(c, BLUE, 0, 0, size, size, 0)
  else roundRect(c, BLUE, 0, 0, size, size, size * 0.225)
  // maskable 图标需把内容收进中央安全区
  drawString(c, 'V', size / 2, size / 2, size * (maskable ? 0.5 : 0.54), WHITE)
  return c
}
function ogImage() {
  const c = makeCanvas(1200, 630)
  roundRect(c, DARK, 0, 0, 1200, 630, 0)
  roundRect(c, BLUE, 450, 92, 300, 300, 66)
  drawString(c, 'V', 600, 242, 164, WHITE)
  drawString(c, 'VAR · TOOLBOX', 600, 478, 74, WHITE)
  return c
}

mkdirSync(join(root, 'public/icons'), { recursive: true })
const outputs = [
  ['public/icons/icon-192.png', appIcon(192, false)],
  ['public/icons/icon-512.png', appIcon(512, false)],
  ['public/icons/icon-512-maskable.png', appIcon(512, true)],
  ['public/apple-touch-icon.png', appIcon(180, true)],
  ['public/og-image.png', ogImage()],
]
for (const [relative, canvas] of outputs) {
  writeFileSync(join(root, relative), encodePng(canvas))
  console.log(`生成 ${relative}（${canvas.w}x${canvas.h}）`)
}
