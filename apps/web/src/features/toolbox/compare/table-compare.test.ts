import test from 'node:test'
import assert from 'node:assert/strict'
import { compareTables, commonHeaders, diffMatrices, type TableMatrix } from './table-compare'

const table = (name: string, headers: string[], rows: string[][]): TableMatrix => ({
  name,
  headers,
  rows,
})
const base = table(
  '旧',
  ['编号', '名称', '数量'],
  [
    ['A01', '甲', '1'],
    ['A02', '乙', '2'],
    ['A03', '丙', '3'],
  ],
)
const next = table(
  '新',
  ['编号', '名称', '数量'],
  [
    ['A01', '甲', '10'],
    ['A02', '乙', '2'],
    ['A04', '丁', '4'],
  ],
)
const options = { keyColumn: '编号', compareColumns: ['名称', '数量'], normalizeSpaces: false }

test('按主键列出新增、删除、修改与未变记录', () => {
  const report = compareTables(base, next, options)
  assert.deepEqual(
    report.added.map((entry) => entry.key),
    ['A04'],
  )
  assert.deepEqual(
    report.removed.map((entry) => entry.key),
    ['A03'],
  )
  assert.equal(report.changed.length, 1)
  assert.deepEqual(report.changed[0].cells, [{ column: '数量', left: '1', right: '10' }])
  assert.equal(report.unchanged, 1)
})

test('空格规范化打开时仅空白不同的值视为未变，明细仍显示原值', () => {
  const right = table('新', ['编号', '名称'], [['A01', ' 甲  乙 ']])
  const left = table('旧', ['编号', '名称'], [['A01', '甲 乙']])
  const report = compareTables(left, right, {
    keyColumn: '编号',
    compareColumns: ['名称'],
    normalizeSpaces: true,
  })
  assert.equal(report.changed.length, 0)
  assert.equal(report.unchanged, 1)
  const strict = compareTables(left, right, { ...options, compareColumns: ['名称'] })
  assert.equal(strict.changed.length, 1)
  assert.deepEqual(strict.changed[0].cells[0], {
    column: '名称',
    left: '甲 乙',
    right: ' 甲  乙 ',
  })
})

test('重复主键不合并：按首次出现匹配并显式报告；缺失主键行不参与匹配', () => {
  const right = table(
    '新',
    ['编号', '名称'],
    [
      ['A01', '甲（第一次）'],
      ['A01', '甲（第二次）'],
      ['', '无主键行'],
      ['A09', '新增'],
    ],
  )
  const report = compareTables(table('旧', ['编号', '名称'], [['A01', '甲（第一次）']]), right, {
    keyColumn: '编号',
    compareColumns: ['名称'],
    normalizeSpaces: false,
  })
  assert.deepEqual(report.duplicateKeys, [{ side: 'right', key: 'A01', count: 2 }])
  assert.equal(report.missingKeys.right, 1)
  assert.equal(report.missingKeys.left, 0)
  // 首次出现参与匹配：A01 未变；A09 新增；重复与缺失行都没有被静默吞掉
  assert.equal(report.unchanged, 1)
  assert.deepEqual(
    report.added.map((entry) => entry.key),
    ['A09'],
  )
})

test('结构差异：只有一侧存在的表头被列出；主键或比较列缺失时报错', () => {
  const right = table('新', ['编号', '名称', '备注'], [['A01', '甲', 'x']])
  const left = table('旧', ['编号', '名称', '旧列'], [['A01', '甲', 'y']])
  const report = compareTables(left, right, { ...options, compareColumns: ['名称'] })
  assert.deepEqual(report.headersOnlyLeft, ['旧列'])
  assert.deepEqual(report.headersOnlyRight, ['备注'])
  assert.throws(() => compareTables(left, right, { ...options, keyColumn: '不存在' }), /主键列/)
  assert.throws(() => compareTables(left, right, { ...options, compareColumns: ['旧列'] }), /新表/)
})

test('公共表头保持旧表顺序；比较列可忽略无关列', () => {
  assert.deepEqual(commonHeaders(base, table('新', ['数量', '编号', '名称'], [])), [
    '编号',
    '名称',
    '数量',
  ])
  const onlyName = compareTables(base, next, { ...options, compareColumns: ['名称'] })
  assert.equal(onlyName.changed.length, 0)
  assert.deepEqual(
    onlyName.removed.map((entry) => entry.key),
    ['A03'],
  )
})

test('diffMatrices 输出三个导出矩阵，修改明细逐列展开', () => {
  const report = compareTables(base, next, options)
  const matrices = diffMatrices(base, next, report)
  assert.deepEqual(
    matrices.map((sheet) => sheet.name),
    ['新增记录', '删除记录', '修改明细'],
  )
  assert.deepEqual(matrices[0].rows, [
    ['编号', '名称', '数量'],
    ['A04', '丁', '4'],
  ])
  assert.deepEqual(matrices[1].rows, [
    ['编号', '名称', '数量'],
    ['A03', '丙', '3'],
  ])
  assert.deepEqual(matrices[2].rows, [
    ['主键', '变化列', '旧值', '新值'],
    ['A01', '数量', '1', '10'],
  ])
})

test('composite keys distinguish delimiter-like content and require every component', () => {
  const left = table(
    'left',
    ['a', 'b', 'v'],
    [
      ['x|y', 'z', 'same'],
      ['x', 'y|z', 'old'],
      ['', 'missing', 'skip'],
    ],
  )
  const right = table(
    'right',
    ['b', 'v', 'a'],
    [
      ['z', 'same', 'x|y'],
      ['y|z', 'new', 'x'],
      ['missing', 'skip', ''],
    ],
  )
  const report = compareTables(left, right, {
    keyColumn: 'a',
    keyColumns: ['a', 'b'],
    compareColumns: ['v'],
    normalizeSpaces: false,
  })
  assert.equal(report.unchanged, 1)
  assert.equal(report.changed.length, 1)
  assert.equal(report.changed[0].key, '["x","y|z"]')
  assert.deepEqual(report.keyColumns, ['a', 'b'])
  assert.deepEqual(report.missingKeys, { left: 1, right: 1 })
})

test('duplicate composite tuples are reported once and selected key components remain distinct', () => {
  const left = table(
    'left',
    ['id', 'site', 'v'],
    [
      ['001', '北京', '旧'],
      ['001', '上海', '沪'],
    ],
  )
  const right = table(
    'right',
    ['id', 'site', 'v'],
    [
      ['001', '北京', '新'],
      ['001', '上海', '沪'],
      ['001', '北京', '重复'],
    ],
  )
  const report = compareTables(left, right, {
    keyColumn: 'id',
    keyColumns: ['id', 'site'],
    compareColumns: ['v'],
    normalizeSpaces: false,
  })
  assert.equal(report.changed.length, 1)
  assert.equal(report.unchanged, 1)
  assert.deepEqual(report.duplicateKeys, [{ side: 'right', key: '["001","北京"]', count: 2 }])
})

test('diff export stops repeated long fields before creating an oversized output matrix', () => {
  const report = compareTables(base, next, options)
  const key = 'x'.repeat(1024 * 1024),
    cell = { column: '数量', left: '1', right: '2' }
  assert.equal(
    diffMatrices(base, next, { ...report, changed: [{ key, cells: Array(40).fill(cell) }] })[2].rows
      .length,
    41,
  )
  assert.throws(
    () => diffMatrices(base, next, { ...report, changed: [{ key, cells: Array(110).fill(cell) }] }),
    /超过 100 MB/,
  )
})
