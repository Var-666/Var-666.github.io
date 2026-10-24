import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateStorage } from './storage'

function fakeStorage(initial: Record<string, string>) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    dump: () => Object.fromEntries(data),
  }
}

test('旧版 liwen 键迁移为 var 键后删除旧键', () => {
  const storage = fakeStorage({ 'liwen-theme': 'dark', 'liwen-settings': '{"preset":"daily"}' })
  migrateStorage(storage)
  assert.deepEqual(storage.dump(), {
    'var-theme': 'dark',
    'var-settings': '{"preset":"daily"}',
  })
})

test('已有 var 键优先于旧键，无关键不受影响', () => {
  const storage = fakeStorage({
    'var-theme': 'light',
    'liwen-theme': 'dark',
    unrelated: 'x',
  })
  migrateStorage(storage)
  assert.deepEqual(storage.dump(), { 'var-theme': 'light', unrelated: 'x' })
})

test('没有任何键时不写入', () => {
  const storage = fakeStorage({})
  migrateStorage(storage)
  assert.deepEqual(storage.dump(), {})
})

test('存储不可用时静默跳过', () => {
  const denied = () => {
    throw new Error('denied')
  }
  migrateStorage({ getItem: denied, setItem: denied, removeItem: denied })
})
