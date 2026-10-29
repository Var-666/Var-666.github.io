import test from 'node:test'
import assert from 'node:assert/strict'
import { compressToTarget } from './image-compress'

const blobOf = (size: number) => new Blob([new Uint8Array(size)])

test('原尺寸内可达目标：取不超过目标的最高质量', async () => {
  // 输出大小 = 质量 × 1000 KB
  const encode = async (quality: number) => blobOf(Math.round(quality * 1000 * 1024))
  const result = await compressToTarget(encode, 700 * 1024)
  assert.equal(result.metTarget, true)
  assert.equal(result.scale, 1)
  assert.equal(result.quality, 0.6) // 0.92、0.75 超限，0.6 = 614 KB 首个达标档
})

test('质量降档无法达标时逐级缩小尺寸', async () => {
  // 输出大小 = 质量 × scale² × 5000 KB：只有 25% 缩放才可能 ≤ 200 KB
  const encode = async (quality: number, scale: number) =>
    blobOf(Math.round(quality * scale * scale * 5000 * 1024))
  const result = await compressToTarget(encode, 200 * 1024)
  assert.equal(result.metTarget, true)
  assert.equal(result.scale, 0.25)
  assert.equal(result.quality, 0.6) // 0.92→287KB、0.75→234KB 超限，0.6→187KB 达标
})

test('无法达标：返回最小结果并如实标注未达标', async () => {
  // 与质量无关，任何缩放下都远超目标
  const encode = async (_quality: number, scale: number) =>
    blobOf(Math.round(scale * scale * 10_000 * 1024))
  const result = await compressToTarget(encode, 200 * 1024)
  assert.equal(result.metTarget, false)
  assert.equal(result.scale, 0.25)
  assert.equal(result.quality, 0.3)
})

test('高质量档全部超限时返回最低质量结果', async () => {
  const encode = async (quality: number) => blobOf(quality > 0.3 ? 5000 * 1024 : 100 * 1024)
  const result = await compressToTarget(encode, 200 * 1024)
  assert.equal(result.metTarget, true)
  assert.equal(result.quality, 0.3)
})

test('编码次数受上限约束', async () => {
  let calls = 0
  const encode = async () => {
    calls++
    return blobOf(10_000 * 1024)
  }
  const result = await compressToTarget(encode, 1000 * 1024, 4)
  assert.equal(result.metTarget, false)
  assert.equal(result.attempts, 4)
  assert.equal(calls, 4)
})
