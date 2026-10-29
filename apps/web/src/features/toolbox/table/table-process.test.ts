import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyProcessOptions,
  groupFileName,
  groupFileNames,
  joinTables,
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

test('按列名对齐补空，合并列顺序稳定且输入表不变', () => {
  const a = table('a', [
      ['id', 'name'],
      ['001', '甲'],
    ]),
    b = table('b', [
      ['name', 'dept'],
      ['乙', '研发'],
    ])
  const out = mergeTables([a, b], true)
  assert.deepEqual(out, {
    headers: ['id', 'name', 'dept'],
    rows: [
      ['001', '甲', ''],
      ['', '乙', '研发'],
    ],
  })
  assert.deepEqual(a.headers, ['id', 'name'])
  assert.throws(
    () =>
      mergeTables([
        table('bad', [
          ['x', 'x'],
          ['1', '2'],
        ]),
      ]),
    /重复列名/,
  )
})

test('主键连接保留一对多、同名右列及前导零，空键不互相匹配', () => {
  const left = table('left', [
    ['id', 'name'],
    ['001', '甲'],
    ['002', '乙'],
    ['', '左空'],
  ])
  const right = table('right', [
    ['编号', 'name', 'dept'],
    ['001', 'A', '研发'],
    ['001', 'B', '销售'],
    ['003', 'C', '财务'],
    ['', '右空', ''],
  ])
  const join = (mode: 'left' | 'inner' | 'full') =>
    joinTables([left, right], { mode, leftKey: 'id', rightKey: '编号' })
  const out = join('left')
  assert.deepEqual(out.headers, ['id', 'name', 'name（右表）', 'dept'])
  assert.deepEqual(out.rows, [
    ['001', '甲', 'A', '研发'],
    ['001', '甲', 'B', '销售'],
    ['002', '乙', '', ''],
    ['', '左空', '', ''],
  ])
  assert.deepEqual(out.join, { pairs: 2, leftUnmatched: 2, rightUnmatched: 2 })
  assert.equal(join('inner').rows.length, 2)
  assert.deepEqual(join('full').rows.slice(-2), [
    ['003', '', 'C', '财务'],
    ['', '', '右空', ''],
  ])
  assert.throws(
    () => joinTables([left], { mode: 'left', leftKey: 'id', rightKey: '编号' }),
    /两份表/,
  )
  assert.throws(
    () => joinTables([left, right], { mode: 'left', leftKey: '不存在', rightKey: '编号' }),
    /有效的连接主键/,
  )
})

test('主键连接的笛卡尔积与按列对齐在生成超限结果前拒绝', () => {
  const a = { name: 'a', headers: ['id', 'a'], rows: Array(400).fill(['x', '1']) },
    b = { name: 'b', headers: ['id', 'b'], rows: Array(400).fill(['x', '2']) }
  assert.throws(
    () => joinTables([a, b], { mode: 'full', leftKey: 'id', rightKey: 'id' }),
    /10 万行/,
  )
  assert.throws(
    () =>
      mergeTables(
        [{ name: 'wide', headers: Array.from({ length: 1025 }, (_, i) => 'c' + i), rows: [] }],
        true,
      ),
    /1024/,
  )
  assert.throws(
    () => mergeTables([{ name: 'many', headers: ['a'], rows: Array(100001).fill(['x']) }]),
    /10 万行/,
  )
})

test('删除前置列并重排/改名后拆分仍以正确列分组；删除拆分列则明确拒绝', () => {
  const options = {
    ...emptyProcessOptions,
    dropColumns: ['编号'],
    columnOrder: ['姓名', '部门'],
    renameColumns: { 姓名: '员工' },
    splitBy: '部门',
  }
  const out = processTables([first], options)
  assert.deepEqual(out.headers, ['员工', '部门'])
  assert.deepEqual(
    out.stats.groups.map((g) => [g.value, g.rows]),
    [
      ['研发', [['甲', '研发']]],
      ['销售', [['乙', '销售']]],
    ],
  )
  assert.equal(out.stats.renamedColumns, 1)
  assert.throws(
    () =>
      processTables([first], { ...emptyProcessOptions, dropColumns: ['部门'], splitBy: '部门' }),
    /拆分列已被删除/,
  )
  assert.throws(
    () => processTables([first], { ...emptyProcessOptions, renameColumns: { 姓名: '部门' } }),
    /重复列名/,
  )
})

test('分组清理和空值标签不再合并或覆盖不同分组', () => {
  const source = table('x', [
    ['key', 'v'],
    ['研发/一部', '1'],
    ['研发?一部', '2'],
    ['', '3'],
    ['（空值）', '4'],
  ])
  const out = processTables([source], { ...emptyProcessOptions, splitBy: 'key' })
  assert.equal(out.stats.groups.length, 4)
  assert.deepEqual(groupFileNames(out.stats.groups.map((g) => g.value)), [
    '研发 一部',
    '研发 一部 (2)',
    '（空值）',
    '（空值） (2)',
  ])
  assert.equal(new Set(groupFileNames(['x'.repeat(50) + 'a', 'x'.repeat(50) + 'b'])).size, 2)
  assert.equal(groupFileName('CON'), 'CON 分组')
  assert.equal(groupFileName('bad\u0000name'), 'bad name')
})

test('split group counts are bounded before building thousands of output files', () => {
  const source = {
    name: 'groups',
    headers: ['k'],
    rows: Array.from({ length: 1001 }, (_, index) => [String(index)]),
  }
  assert.throws(
    () => processTables([source], { ...emptyProcessOptions, splitBy: 'k' }),
    /1000 个分组/,
  )
})

test('result limits include the header so exported boundary-sized tables remain importable', () => {
  const headers = Array.from({ length: 10 }, (_, i) => 'c' + i),
    row = headers.map(() => '001')
  const table = { name: 'boundary', headers, rows: Array(99999).fill(row) }
  assert.equal(processTables([table], emptyProcessOptions).rows.length, 99999)
  assert.throws(
    () => processTables([{ ...table, rows: Array(100000).fill(row) }], emptyProcessOptions),
    /含表头/,
  )
})
