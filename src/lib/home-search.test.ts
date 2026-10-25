import test from 'node:test'
import assert from 'node:assert/strict'
import { homeTasks, searchHome, type ToolInfo } from './home-search'

const tools: ToolInfo[] = [
  { id: 'text', title: '文本整理', description: '清理、去重、PDF 断行修复', keywords: ['文字'] },
  {
    id: 'files',
    title: '文件格式转换',
    description: '图片、表格与办公文档转换',
    keywords: ['压缩', 'xlsx'],
  },
]

test('空查询返回全部工具与任务', () => {
  const result = searchHome('', tools)
  assert.deepEqual(
    result.tools.map((tool) => tool.id),
    ['text', 'files'],
  )
  assert.equal(result.tasks.length, homeTasks.length)
})

test('按工具名称、功能与关键词匹配', () => {
  assert.deepEqual(
    searchHome('压缩', tools).tools.map((tool) => tool.id),
    ['files'],
  )
  assert.deepEqual(
    searchHome('断行', tools).tools.map((tool) => tool.id),
    ['text'],
  )
  assert.deepEqual(searchHome('不存在的功能', tools).tools, [])
})

test('任务式入口按任务关键词命中并只指向已上线能力', () => {
  const compress = searchHome('压缩', tools).tasks
  assert.deepEqual(
    compress.map((task) => task.id),
    ['compress-image'],
  )
  assert.equal(compress[0].hash, '#/files?mode=image-compress')
  const pdf = searchHome('提取 页面', tools).tasks
  assert.deepEqual(
    pdf.map((task) => task.id),
    ['pdf-organize'],
  )
  // 每个任务都指向四个已有工具之一
  for (const task of homeTasks)
    assert.ok(['text', 'files', 'compare', 'table', 'pdf', 'rename'].includes(task.toolId), task.id)
})

test('表格对比任务可被任务关键词命中', () => {
  const tasks = searchHome('比较 表格', [
    { id: 'compare', title: '表格对比', description: '', keywords: [] },
  ]).tasks
  assert.deepEqual(
    tasks.map((task) => task.id),
    ['compare-tables'],
  )
})

test('大小写与首尾空白不敏感', () => {
  assert.deepEqual(
    searchHome('  XLSX ', tools).tools.map((tool) => tool.id),
    ['files'],
  )
})
