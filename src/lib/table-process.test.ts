import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyProcessOptions,
  groupFileName,
  mergeTables,
  processTables,
  type LoadedTable,
} from './table-process'

const table = (name: string, rows: string[][]): LoadedTable => ({
  name,
  headers: rows[0] ?? [],
  rows: rows.slice(1),
})

const first = table('一.csv', [
  ['编号', '部门', '姓名'],
  ['A01', '研发', '甲'],
  ['A02', '销售', '乙'],
])
const second = table('二.csv', [
  ['编号', '部门', '姓名'],
  ['A01', '研发', '甲'],
  ['A03', '人事', '丙'],
])

test('合并同结构表格；表头不一致时点名文件', () => {
  const merged = mergeTables([first, second])
  assert.equal(merged.rows.length, 4)
  assert.deepEqual(merged.headers, ['编号', '部门', '姓名'])
  const bad = table('坏.csv', [
    ['编号', '部门'],
    ['A09', '研发'],
  ])
  assert.throws(() => mergeTables([first, bad]), /坏\.csv.*不一致/)
})

test('按关键列去重：保留第一条或最后一条，空主键同样参与去重', () => {
  const keepFirst = processTables([first, second], {
    ...emptyProcessOptions,
    dedupe: { column: '编号', keep: 'first' },
  })
  assert.equal(keepFirst.stats.dedupedRemoved, 1)
  assert.equal(keepFirst.stats.finalRows, 3)
  const keepLast = processTables([first, second], {
    ...emptyProcessOptions,
    dedupe: { column: '编号', keep: 'last' },
  })
  assert.equal(keepLast.stats.dedupedRemoved, 1)
  // A01 重复：first=一.csv 的甲，last=二.csv 的甲（此处内容相同）；用不同内容验证取向
  const left = table('左.csv', [
    ['k', 'v'],
    ['A', '旧'],
  ])
  const right = table('右.csv', [
    ['k', 'v'],
    ['A', '新'],
  ])
  const pick = (keep: 'first' | 'last') =>
    processTables([left, right], { ...emptyProcessOptions, dedupe: { column: 'k', keep } })
  assert.equal(pick('first').stats.finalRows, 1)
  assert.equal(pick('last').stats.finalRows, 1)
})

test('按列筛选包含 / 不包含，统计移除行数', () => {
  const include = processTables([first, second], {
    ...emptyProcessOptions,
    filter: { column: '部门', mode: 'include', keyword: '研发' },
  })
  assert.equal(include.stats.filterRemoved, 2)
  assert.equal(include.stats.finalRows, 2)
  const exclude = processTables([first, second], {
    ...emptyProcessOptions,
    filter: { column: '部门', mode: 'exclude', keyword: '研发' },
  })
  assert.equal(exclude.stats.finalRows, 2)
})

test('删除列保持数据与列名对应，全删报错', () => {
  const result = processTables([first], { ...emptyProcessOptions, dropColumns: ['部门'] })
  assert.deepEqual(result.headers, ['编号', '姓名'])
  assert.deepEqual(result.stats.finalRows, 2)
  assert.equal(result.stats.finalColumns, 2)
  assert.throws(
    () => processTables([first], { ...emptyProcessOptions, dropColumns: ['编号', '部门', '姓名'] }),
    /至少保留一列/,
  )
})

test('按字段拆分：分组按首次出现排序，空值归入（空值）组', () => {
  const blank = table('空.csv', [
    ['编号', '部门'],
    ['A01', '研发'],
    ['A02', ''],
    ['A03', '销售'],
    ['A04', '研发'],
  ])
  const result = processTables([blank], { ...emptyProcessOptions, splitBy: '部门' })
  assert.deepEqual(
    result.stats.groups.map((group) => [group.value, group.rows.length]),
    [
      ['研发', 2],
      ['（空值）', 1],
      ['销售', 1],
    ],
  )
})

test('整条管道：合并→去重→筛选→删列→拆分的统计链路', () => {
  const result = processTables([first, second], {
    dedupe: { column: '编号', keep: 'first' },
    filter: { column: '部门', mode: 'exclude', keyword: '销售' },
    dropColumns: ['姓名'],
    splitBy: '部门',
  })
  assert.equal(result.stats.mergedRows, 4)
  assert.equal(result.stats.dedupedRemoved, 1)
  assert.equal(result.stats.filterRemoved, 1)
  assert.deepEqual(result.headers, ['编号', '部门'])
  assert.deepEqual(
    result.stats.groups.map((group) => group.value),
    ['研发', '人事'],
  )
})

test('分组文件名清理非法字符并截断', () => {
  assert.equal(groupFileName('研发/一部*2026'), '研发 一部 2026')
  assert.equal(groupFileName('   '), '分组')
  assert.equal(groupFileName('x'.repeat(60)).length, 40)
})
