import test from 'node:test'
import assert from 'node:assert/strict'
import { processText, presets, baseOptions, textStats } from './text'
const untouched = { ...baseOptions, trimLines: false, blankLines: 'keep' as const }
test('daily cleanup preserves paragraphs and normalizes Windows line endings', () => {
  const { text, changes } = processText('  第一行  \r\n\r\n\r\n第二行    内容\r\n', presets.clean.options)
  assert.equal(text, '第一行\n\n第二行 内容\n'); assert.ok(changes.length > 0)
})
test('PDF repair joins Chinese and English without crushing paragraph boundaries', () => {
  assert.equal(processText('一段完整的\n中文内容。\n\nGood ideas deserve\nroom to grow.', presets.pdf.options).text, '一段完整的中文内容。\n\nGood ideas deserve room to grow.')
})
test('PDF repair protects numbered and bullet lists, URLs and emails', () => {
  const source = '待办事项：\n1. 第一项\n2. 第二项\n- 第三项\n- 第四项\nhttps://example.com/a\nhello@example.com'
  assert.equal(processText(source, presets.pdf.options).text, source)
})
test('PDF repair handles a hyphenated English word', () => {
  assert.equal(processText('The environ-\nment matters.', presets.pdf.options).text, 'The environment matters.')
})
test('deduplication preserves first appearance and only ignores case when requested', () => {
  const source = '王安\n李可\n王安\nAlex\nalex\nAlex'
  assert.equal(processText(source, presets.dedupe.options).text, '王安\n李可\nAlex\nalex')
  assert.equal(processText(source, { ...presets.dedupe.options, ignoreCase: true }).text, '王安\n李可\nAlex')
})
test('exact-line deduplication can retain leading or trailing spaces', () => {
  assert.equal(processText(' A\nA\n A', { ...untouched, dedupe: true, ignoreWhitespace: false }).text, ' A\nA')
})
test('blank-line removal deletes whitespace-only lines', () => {
  assert.equal(processText('A\n  \n\nB\n', { ...untouched, blankLines: 'remove' }).text, 'A\nB')
})
test('fullwidth conversion handles letters, numbers and ideographic spaces', () => {
  assert.equal(processText('ＡＢＣ１２３　测试', { ...untouched, fullwidth: true }).text, 'ABC123 测试')
})
test('Chinese spacing preserves numbers, URLs, emails and inline code', () => {
  const text = processText('使用React完成3.14倍测试，进度80%。\nhttps://example.com/a?x=1\nhello@example.com\n`const a=1`', { ...untouched, cjkSpacing: true }).text
  assert.equal(text, '使用 React 完成 3.14 倍测试，进度 80%。\nhttps://example.com/a?x=1\nhello@example.com\n`const a=1`')
})
test('Chinese punctuation protects links, decimals and inline code', () => {
  assert.equal(processText('你好,世界! 价格3.14,链接:https://example.com/a?x=1\n`foo(a,b)`', { ...untouched, chinesePunctuation: true }).text, '你好，世界！ 价格3.14，链接：https://example.com/a?x=1\n`foo(a,b)`')
})
test('empty input is empty and stats count emoji as a single codepoint', () => {
  assert.deepEqual(processText('', presets.clean.options), { text: '', changes: [] })
  assert.deepEqual(textStats('你😀\nA'), { chars: 4, lines: 2, nonSpace: 3 })
})
test('typography leaves inline code containing Chinese and digits intact', () => {
  assert.equal(processText('正文React, `value=1个;`', { ...untouched, cjkSpacing: true, chinesePunctuation: true }).text, '正文 React， `value=1个;`')
})
test('processing a large repeated list preserves the expected unique lines', () => {
  const source = Array.from({ length: 50000 }, (_, i) => `项目${i % 100}`).join('\n')
  assert.equal(processText(source, presets.dedupe.options).text.split('\n').length, 100)
})
test('PDF repair preserves Chinese sentences ending with closing quotation marks', () => {
  const source = '他说：“已经完成。”\n下一段独立的内容。'
  assert.equal(processText(source, presets.pdf.options).text, source)
})
test('PDF repair preserves bullets without a separating space', () => {
  const source = '•第一项\n•第二项\n●第三项\n▪第四项'
  assert.equal(processText(source, presets.pdf.options).text, source)
})
test('PDF repair preserves fenced code and markdown table rows', () => {
  const source = '```js\nconst first = 1\nconst second = 2\n```\n\n名称 | 数量\n--- | ---\n苹果 | 3'
  assert.equal(processText(source, presets.pdf.options).text, source)
})
test('typography protects uppercase URL schemes and query parameters', () => {
  assert.equal(processText('正文:HTTPS://EXAMPLE.COM/a?x=1&y=2', { ...untouched, cjkSpacing: true, chinesePunctuation: true }).text, '正文：HTTPS://EXAMPLE.COM/a?x=1&y=2')
})
test('typography preserves multiline fenced code including Chinese comments', () => {
  const source = '说明如下:\n```js\nconst value = 1; //中文React,保持原样!\nconsole.log(value);\n```'
  assert.equal(processText(source, { ...untouched, cjkSpacing: true, chinesePunctuation: true }).text, source.replace('说明如下:', '说明如下：'))
})
test('blank line consolidation recognizes non-breaking spaces with trimming disabled', () => {
  assert.equal(processText('A\n\u00a0\n\u00a0\nB', { ...untouched, blankLines: 'single' }).text, 'A\n\nB')
})
test('preset results stay stable when processed a second time', () => {
  for (const preset of Object.values(presets)) {
    const first = processText(preset.sample, preset.options).text
    assert.equal(processText(first, preset.options).text, first, preset.title)
  }
})
