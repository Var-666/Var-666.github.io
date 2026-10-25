import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyListOps,
  applyReplaceRules,
  convertLineFormat,
  emptyListOptions,
  type ReplaceRule,
} from './text-ops'

const rule = (find: string, replace: string, extra: Partial<ReplaceRule> = {}): ReplaceRule => ({
  find,
  replace,
  regex: false,
  caseSensitive: false,
  ...extra,
})

test('多条替换规则按顺序执行并逐条计数', () => {
  const { text, hits } = applyReplaceRules('甲A甲b甲', [
    rule('甲', 'X'),
    rule('x', 'Y'), // 命中上一条替换出的内容，顺序生效
  ])
  assert.equal(text, 'YAYbY')
  assert.deepEqual(hits, [3, 3])
})

test('大小写开关：默认不敏感，开启后仅精确匹配', () => {
  assert.deepEqual(applyReplaceRules('Hello hello', [rule('hello', 'X')]).hits, [2])
  assert.deepEqual(
    applyReplaceRules('Hello hello', [rule('hello', 'X', { caseSensitive: true })]).hits,
    [1],
  )
})

test('字面规则的替换值不解释 $& 等引用，正则规则保留分组引用', () => {
  assert.equal(applyReplaceRules('ab', [rule('a', '$&X')]).text, '$&Xb')
  assert.equal(applyReplaceRules('ab', [rule('(a)(b)', '$2$1', { regex: true })]).text, 'ba')
})

test('非法正则报出规则序号，空查找跳过且计 0', () => {
  assert.throws(
    () => applyReplaceRules('x', [rule('ok', 'y'), rule('[', 'z', { regex: true })]),
    /第 2 条/,
  )
  assert.deepEqual(applyReplaceRules('abc', [rule('', 'x')]).hits, [0])
})

test('列表处理：删空行→筛选→排序→行号→前后缀，并报告行数变化（不去重）', () => {
  const { text, beforeLines, afterLines, removedLines } = applyListOps(
    'banana\r\n\r\napple\ncherry\nbanana',
    {
      ...emptyListOptions,
      removeEmpty: true,
      filterInclude: 'a',
      sort: 'asc',
      lineNumbers: 'dot',
      prefix: '- ',
      suffix: ';',
    },
  )
  assert.equal(text, '- 1. apple;\n- 2. banana;\n- 3. banana;')
  assert.equal(beforeLines, 5)
  assert.equal(afterLines, 3)
  assert.equal(removedLines, 2)
})

test('列表处理：排除筛选、倒序与长度排序（等长按拼音稳定排序）', () => {
  const excluded = applyListOps('keep1\nskip\nkeep2', {
    ...emptyListOptions,
    filterExclude: 'skip',
  })
  assert.equal(excluded.text, 'keep1\nkeep2')
  assert.equal(applyListOps('b\na\nc', { ...emptyListOptions, sort: 'desc' }).text, 'c\nb\na')
  assert.equal(
    applyListOps('bbb\naa\nccc\nab', { ...emptyListOptions, sort: 'length' }).text,
    'aa\nab\nbbb\nccc',
  )
})

test('格式转换：多行合并、单行自动拆分、引号与 SQL 转义、空条目计数', () => {
  assert.equal(convertLineFormat('a\nb\nc', 'comma').text, 'a,b,c')
  assert.equal(convertLineFormat('a,b;c', 'lines').text, 'a\nb;c') // 拆分数量并列时按逗号优先
  assert.equal(convertLineFormat('a;b;c', 'semicolon').text, 'a;b;c')
  assert.equal(convertLineFormat('a\tb', 'tab').text, 'a\tb')
  const quoted = convertLineFormat('x\ny"z', 'quote')
  assert.equal(quoted.text, '"x", "y\\"z"')
  const sql = convertLineFormat("O'Brien\nA01", 'sql')
  assert.equal(sql.text, "('O''Brien', 'A01')")
  const dropped = convertLineFormat('a\n\nb\n', 'comma')
  assert.deepEqual([dropped.count, dropped.dropped], [2, 2])
  assert.equal(convertLineFormat('   \n  ', 'comma').text, '')
})

test('格式转换往返：行 → 逗号 → 行 保持条目一致', () => {
  const once = convertLineFormat('甲\n乙\n丙', 'comma')
  const back = convertLineFormat(once.text, 'lines')
  assert.equal(back.text, '甲\n乙\n丙')
  assert.equal(back.count, 3)
})
