import test from 'node:test'
import assert from 'node:assert/strict'
import { textDiff, DIFF_MAX_CHARS, type DiffHunk } from './text-diff'

// 校验 hunks 与两侧原文的铺贴关系：相邻 hunk 之间的空隙文本必须两侧完全一致
function tileCheck(source: string, result: string, hunks: DiffHunk[]) {
  let s = 0
  let r = 0
  for (const hunk of hunks) {
    assert.ok(hunk.source.start >= s, 'source 范围有序')
    assert.ok(hunk.result.start >= r, 'result 范围有序')
    assert.equal(
      source.slice(s, hunk.source.start),
      result.slice(r, hunk.result.start),
      '空隙文本一致',
    )
    assert.ok(hunk.source.start <= hunk.source.end)
    assert.ok(hunk.result.start <= hunk.result.end)
    assert.ok(hunk.sourceRuns.length + hunk.resultRuns.length > 0, '每块至少一侧有变化')
    s = hunk.source.end
    r = hunk.result.end
  }
  assert.equal(source.slice(s), result.slice(r), '结尾空隙一致')
}

// 测试内默认使用未超限的输入，返回 null 即失败
function diffOf(source: string, result: string): DiffHunk[] {
  const hunks = textDiff(source, result)
  assert.ok(hunks, 'textDiff 不应返回 null')
  return hunks
}

test('相同文本没有差异', () => {
  assert.deepEqual(textDiff('你好\n世界', '你好\n世界'), [])
  assert.deepEqual(textDiff('', ''), [])
})

test('断行修复：只删除换行符，字符级定位到换行本身', () => {
  const hunks = diffOf('第一行\n第二行', '第一行第二行')
  tileCheck('第一行\n第二行', '第一行第二行', hunks)
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0].kind, 'remove')
  assert.deepEqual(hunks[0].sourceRuns, [{ start: 3, end: 4 }])
  assert.deepEqual(hunks[0].resultRuns, [])
})

test('中文标点替换：两侧各一个字符范围', () => {
  const hunks = diffOf('你好,世界：开始', '你好，世界：开始')
  tileCheck('你好,世界：开始', '你好，世界：开始', hunks)
  assert.equal(hunks.length, 1)
  assert.deepEqual(hunks[0].sourceRuns, [{ start: 2, end: 3 }])
  assert.deepEqual(hunks[0].resultRuns, [{ start: 2, end: 3 }])
})

test('纯新增：结果侧高亮，行内插入识别为新增', () => {
  const hunks = diffOf('你好', '你好，世界')
  tileCheck('你好', '你好，世界', hunks)
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0].kind, 'add')
  assert.deepEqual(hunks[0].resultRuns, [{ start: 2, end: 5 }])
  const fresh = diffOf('开始\n', '开始\n新段落\n')
  tileCheck('开始\n', '开始\n新段落\n', fresh)
  assert.equal(fresh[0].kind, 'add')
  assert.deepEqual(fresh[0].resultRuns, [fresh[0].result])
})

test('去重删除整行：原文侧整行高亮', () => {
  const source = '苹果\n香蕉\n苹果\n'
  const result = '苹果\n香蕉\n'
  const hunks = diffOf(source, result)
  tileCheck(source, result, hunks)
  assert.equal(hunks.length, 1)
  assert.equal(hunks[0].kind, 'remove')
  assert.equal(source.slice(hunks[0].source.start, hunks[0].source.end), '苹果\n')
})

test('首尾空格清理：多处删除各自定位', () => {
  const source = '  开始\n结束  \n'
  const result = '开始\n结束\n'
  const hunks = diffOf(source, result)
  tileCheck(source, result, hunks)
  const removed = hunks.flatMap((hunk) => hunk.sourceRuns)
  assert.deepEqual(removed, [
    { start: 0, end: 2 },
    { start: 7, end: 9 },
  ])
})

test('仅换行归属差异时不产生标注', () => {
  const hunks = diffOf('结尾带换行\n', '结尾带换行')
  tileCheck('结尾带换行\n', '结尾带换行', hunks)
})

test('多段修改保持铺贴一致（模拟中文排版）', () => {
  const source =
    '使用 React 19 构建,详见 https://example.com/a 。\n中间不变的一行。\n第二段 2024 年数据。\n'
  const result =
    '使用 React 19 构建，详见 https://example.com/a。\n中间不变的一行。\n第二段 2024 年的数据。\n'
  const hunks = diffOf(source, result)
  assert.ok(hunks, '差异计算不应返回 null')
  if (!hunks) return
  tileCheck(source, result, hunks)
  assert.equal(hunks.length, 2)
  for (const hunk of hunks) {
    for (const run of hunk.sourceRuns)
      assert.ok(run.start >= hunk.source.start && run.end <= hunk.source.end)
    for (const run of hunk.resultRuns)
      assert.ok(run.start >= hunk.result.start && run.end <= hunk.result.end)
  }
})

test('超过字符上限返回 null，不执行差异计算', () => {
  const big = 'a'.repeat(DIFF_MAX_CHARS)
  assert.equal(textDiff(big, big + 'b'), null)
  assert.equal(textDiff('', 'b'.repeat(DIFF_MAX_CHARS + 1)), null)
})
