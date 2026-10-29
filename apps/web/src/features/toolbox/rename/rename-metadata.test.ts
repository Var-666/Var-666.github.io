import test from 'node:test'
import assert from 'node:assert/strict'
import { exifJpeg } from '../../../../e2e/fixtures/exif'
import { formatRenameDate, readPhotoDate, sortRenameFiles } from './rename-metadata'

test('date formatting preserves EXIF wall clock and rejects impossible/unknown dates', () => {
  assert.equal(formatRenameDate('2020:02:29 23:59:59', 'datetime'), '2020-02-29_23-59-59')
  for (const date of [
    '2026:02:29 00:00:00',
    '2020:13:01 00:00:00',
    '2020:01:01 24:00:00',
    '0000:00:00 00:00:00',
    'bad',
  ])
    assert.equal(formatRenameDate(date, 'date'), '')
  assert.equal(formatRenameDate(undefined, 'date'), '')
  assert.equal(formatRenameDate(NaN, 'date'), '')
})

test('natural/time/size sorting is stable, non-mutating and missing EXIF stays last in either direction', () => {
  const items = [
    { file: { name: 'file10.txt', size: 10, lastModified: 2 }, shotAt: '2020:01:01 00:00:00' },
    { file: { name: 'file2.txt', size: 20, lastModified: 1 }, shotAt: '2021:01:01 00:00:00' },
    { file: { name: 'file1.txt', size: 1, lastModified: 3 } },
  ]
  assert.deepEqual(
    sortRenameFiles(items, 'name-asc').map((item) => item.file.name),
    ['file1.txt', 'file2.txt', 'file10.txt'],
  )
  assert.equal(sortRenameFiles(items, 'modified-asc')[0], items[1])
  assert.equal(sortRenameFiles(items, 'size-desc')[0], items[1])
  assert.equal(sortRenameFiles(items, 'shot-asc')[2], items[2])
  assert.equal(sortRenameFiles(items, 'shot-desc')[0], items[1])
  assert.equal(sortRenameFiles(items, 'shot-desc')[2], items[2])
  assert.equal(items[0].file.name, 'file10.txt')
})

// Node has Blob but no FileReader; emulate only the browser byte-read used by exifr.
Object.defineProperty(globalThis, 'FileReader', {
  configurable: true,
  value: class {
    result?: ArrayBuffer
    onloadend?: () => void
    onerror?: (error: unknown) => void
    readAsArrayBuffer(blob: Blob) {
      void blob.arrayBuffer().then(
        (value) => {
          this.result = value
          this.onloadend?.()
        },
        (error) => this.onerror?.(error),
      )
    }
  },
})

test('EXIF date parser reads only original capture time and rejects missing or wrong formats', async () => {
  assert.equal(await readPhotoDate(new File([exifJpeg()], 'photo.jpg')), '2026:10:26 09:08:07')
  await assert.rejects(readPhotoDate(new File(['text'], 'a.txt')), /类型/)
  await assert.rejects(
    readPhotoDate(new File([exifJpeg('2026:02:30 00:00:00')], 'bad.jpg')),
    /没有有效/,
  )
  await assert.rejects(
    readPhotoDate(new File([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], 'empty.jpg')),
  )
})
