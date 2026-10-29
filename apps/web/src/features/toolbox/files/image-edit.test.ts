import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultImageEdit, imageGeometry } from './image-edit'
import { imageContainer } from './image-decode'
import { identifyFile, intakeTasks } from '../file-intake'
import { fileOptionSchema } from '@/features/toolbox/files/options'
import { readFileSync } from 'node:fs'

test('默认图像尺寸兼容预设，裁剪按原图比例且旋转后再缩放', () => {
  assert.deepEqual(imageGeometry(64, 40, 'half'), {
    x: 0,
    y: 0,
    cropWidth: 64,
    cropHeight: 40,
    width: 32,
    height: 20,
  })
  assert.deepEqual(
    imageGeometry(64, 40, 'original', {
      ...defaultImageEdit,
      crop: true,
      x: '50',
      cropWidth: '50',
      cropHeight: '50',
      rotation: 90,
      resize: 'percent',
      percent: '50',
    }),
    { x: 32, y: 0, cropWidth: 32, cropHeight: 20, width: 10, height: 16 },
  )
  assert.equal(
    imageGeometry(1, 1, 'original', { ...defaultImageEdit, crop: true, x: '99', cropWidth: '1' })
      .cropWidth,
    1,
  )
})
test('指定宽高可分别等比或精确调整，百分比替代旧尺寸预设', () => {
  const edit = { ...defaultImageEdit, resize: 'exact' as const, width: '32' }
  assert.equal(imageGeometry(64, 40, 'half', edit).height, 20)
  assert.equal(imageGeometry(64, 40, 'original', { ...edit, height: '30' }).height, 30)
  assert.equal(imageGeometry(64, 40, 'original', { ...edit, width: '', height: '10' }).width, 16)
  assert.equal(
    imageGeometry(64, 40, 'half', { ...defaultImageEdit, resize: 'percent', percent: '200' }).width,
    128,
  )
})
test('裁剪与尺寸资源边界、水印限制拒绝非法值，不截断参数', () => {
  for (const patch of [
    { resize: 'exact' as const },
    { resize: 'exact' as const, width: '32.5' },
    { resize: 'percent' as const, percent: 'Infinity' },
    { resize: 'percent' as const, percent: '' },
    { crop: true, x: '90', cropWidth: '20' },
    { crop: true, cropWidth: '0' },
    { watermark: '字'.repeat(81) },
    { opacity: 0 },
    { resize: 'exact' as const, width: '6000', height: '4001' },
  ])
    assert.throws(() => imageGeometry(64, 40, 'original', { ...defaultImageEdit, ...patch }))
  assert.equal(imageGeometry(6000, 4000, 'original').width, 6000)
  assert.throws(() => imageGeometry(6000, 4001, 'original'))
  assert.throws(() => imageGeometry(16385, 1, 'original'))
})
test('ISO-BMFF 识别真实HEIC与AVIF兼容品牌，不误认扩展名或任意ftyp内容', async () => {
  const bytes = readFileSync(new URL('../../../../e2e/fixtures/colors.heic', import.meta.url))
  assert.equal(imageContainer(bytes), 'heic')
  const file = new File([bytes], 'photo.txt', { type: 'text/plain' })
  const recognized = await identifyFile(file)
  assert.equal(recognized.kind, 'image')
  assert.equal(recognized.extension, 'heic')
  assert.ok(intakeTasks([recognized]).some((task) => task.mode === 'image-pdf'))
  const avif = Uint8Array.from([
    0,
    0,
    0,
    24,
    ...Buffer.from('ftypmif1'),
    0,
    0,
    0,
    0,
    ...Buffer.from('avif'),
    ...Buffer.from('mif1'),
  ])
  assert.equal(imageContainer(avif), 'avif')
  assert.equal(imageContainer(new Uint8Array(32)), null)
  assert.equal((await identifyFile(new File(['not an image'], 'fake.heic'))).kind, 'unknown')
  assert.equal(fileOptionSchema.format('avif'), true)
  assert.equal(fileOptionSchema.format('gif'), false)
})
