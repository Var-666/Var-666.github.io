import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultFileOptions, fileOptionSchema } from './options'
import { readFileOptions, saveFileOptions, storageKeys } from '../lib/storage'

test('grouped conversion options retain every legacy key and restore only validated values', () => {
  let stored = JSON.stringify({
    format: 'webp',
    imageSize: 'half',
    quality: 77,
    compressTarget: '500',
    compressFormat: 'webp',
    pdfFormat: 'jpeg',
    pdfLayout: 'long',
    mergeSize: 'a3',
    mergeOrientation: 'landscape',
    mergeFit: 'cover',
    pages: '1,3-5',
    detectNumbers: true,
  })
  const storage = {
    removeItem: () => {
      stored = ''
    },
    getItem: (key: string) => (key === storageKeys.fileOptions ? stored : null),
    setItem: (_key: string, value: string) => {
      stored = value
    },
  }
  const read = { ...defaultFileOptions, ...readFileOptions(storage, fileOptionSchema) }
  assert.deepEqual(read, JSON.parse(stored))
  saveFileOptions(storage, read, fileOptionSchema)
  assert.deepEqual(JSON.parse(stored), read)
  assert.deepEqual(Object.keys(defaultFileOptions).sort(), Object.keys(fileOptionSchema).sort())
  stored = JSON.stringify({
    format: 'gif',
    quality: 1000,
    pages: 'x'.repeat(51),
    detectNumbers: 'yes',
    mergeSize: 'a0',
    source: 'private body',
  })
  assert.deepEqual(
    { ...defaultFileOptions, ...readFileOptions(storage, fileOptionSchema) },
    defaultFileOptions,
  )
  saveFileOptions(storage, { ...defaultFileOptions, source: 'private body' }, fileOptionSchema)
  assert.deepEqual(JSON.parse(stored), defaultFileOptions)
})
