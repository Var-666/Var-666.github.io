import test from 'node:test'
import assert from 'node:assert/strict'
import {
  migrateStorage,
  readFavoriteTools,
  toggleFavoriteTool,
  readRecentTools,
  recordRecentTool,
  readUserPresets,
  saveUserPreset,
  deleteUserPreset,
  readFileOptions,
  saveFileOptions,
  type FileOptionSchema,
} from './storage'

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

test('工具收藏只保存合法 id，坏数据忽略', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const valid = ['text', 'files', 'pdf', 'rename']
  assert.deepEqual(readFavoriteTools(storage, valid), [])
  store.set('var-favorite-tools', JSON.stringify(['files', 'ghost', 42, 'files']))
  assert.deepEqual(readFavoriteTools(storage, valid), ['files'])
  assert.deepEqual(toggleFavoriteTool(storage, 'pdf', valid), ['files', 'pdf'])
  assert.deepEqual(toggleFavoriteTool(storage, 'files', valid), ['pdf'])
  assert.equal(toggleFavoriteTool(storage, 'ghost', valid).includes('ghost'), false)
})

test('最近使用按时间倒序去重，只展示 4 个且只存 id 与时间戳', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const valid = ['text', 'files', 'pdf', 'rename']
  recordRecentTool(storage, 'text', valid)
  recordRecentTool(storage, 'files', valid)
  recordRecentTool(storage, 'text', valid)
  assert.deepEqual(readRecentTools(storage, valid), ['text', 'files'])
  recordRecentTool(storage, 'pdf', valid)
  recordRecentTool(storage, 'rename', valid)
  recordRecentTool(storage, 'ghost', valid)
  assert.deepEqual(readRecentTools(storage, valid), ['rename', 'pdf', 'text', 'files'])
  // 存储里只有 id 与时间戳，不含任何正文
  const saved = JSON.parse(store.get('var-recent-tools') ?? '[]')
  assert.ok(
    saved.every((entry: unknown) =>
      Object.keys(entry as object).every((key) => key === 'id' || key === 'at'),
    ),
  )
  store.set('var-recent-tools', 'not json')
  assert.deepEqual(readRecentTools(storage, valid), [])
})

test('用户自定义预设：同名覆盖、坏条目丢弃、上限淘汰', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const validPresets = ['clean', 'pdf', 'dedupe', 'chinese', 'markdown']
  const sanitize = (value: unknown) => value as Record<string, unknown>
  assert.deepEqual(readUserPresets(storage, validPresets, sanitize), [])
  saveUserPreset(
    storage,
    { name: '日报', preset: 'clean', options: { trimLines: false } },
    validPresets,
    sanitize,
  )
  saveUserPreset(storage, { name: '日志', preset: 'pdf', options: {} }, validPresets, sanitize)
  saveUserPreset(storage, { name: '日报', preset: 'chinese', options: {} }, validPresets, sanitize)
  const presets = readUserPresets(storage, validPresets, sanitize)
  assert.deepEqual(
    presets.map((item) => [item.name, item.preset]),
    [
      ['日报', 'chinese'],
      ['日志', 'pdf'],
    ],
  )
  // 坏数据混入被丢弃
  store.set(
    'var-user-presets',
    JSON.stringify([
      { id: 'x', name: '合法', preset: 'clean', options: {} },
      { id: '', name: '无 id' },
      { id: 'y', name: '', preset: 'clean', options: {} },
      { id: 'z', name: '未知场景', preset: 'ghost', options: {} },
      'junk',
    ]),
  )
  assert.deepEqual(
    readUserPresets(storage, validPresets, sanitize).map((item) => item.name),
    ['合法'],
  )
  assert.deepEqual(deleteUserPreset(storage, 'x', validPresets, sanitize), [])
})

test('文件工具参数记忆：按 schema 过滤，坏 JSON 返回空', () => {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
  const schema: FileOptionSchema = {
    compressTarget: (value) => value === '100' || value === '200' || value === '500',
    quality: (value) => typeof value === 'number' && value >= 10 && value <= 100,
  }
  assert.deepEqual(readFileOptions(storage, schema), {})
  saveFileOptions(storage, { compressTarget: '500', quality: 80, evil: 'x' }, schema)
  assert.deepEqual(readFileOptions(storage, schema), { compressTarget: '500', quality: 80 })
  saveFileOptions(storage, { compressTarget: '9' }, schema) // 不合法值被丢弃，旧值保留
  assert.deepEqual(readFileOptions(storage, schema), { compressTarget: '500', quality: 80 })
  store.set('var-file-options', 'not json')
  assert.deepEqual(readFileOptions(storage, schema), {})
})
