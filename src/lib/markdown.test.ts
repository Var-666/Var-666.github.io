import test from 'node:test'
import assert from 'node:assert/strict'
import { markdownToText } from './markdown'
import { processText, presets } from './text'

test('Markdown removes headings, emphasis, quotes and thematic breaks', () => {
  assert.equal(
    markdownToText('# 标题\n\n正文 **加粗**、*斜体*、~~删除线~~ 和 `代码`。\n\n---\n\n> 引用内容'),
    '标题\n\n正文 加粗、斜体、删除线 和 代码。\n\n引用内容',
  )
})
test('Markdown supports setext headings and hard line breaks', () => {
  assert.equal(markdownToText('标题\n===\n\n第一行  \n第二行'), '标题\n\n第一行\n第二行')
})
test('Markdown preserves link captions and URLs, including references', () => {
  const source =
    '[**文档**](https://example.com/a_(b)?x=1&y=2)\n\n[参考][doc]\n\n[doc]: https://example.com/docs "说明"'
  assert.equal(
    markdownToText(source),
    '文档（https://example.com/a_(b)?x=1&y=2）\n\n参考（https://example.com/docs）',
  )
})
test('Markdown keeps autolinks and mail addresses without duplicate URLs', () => {
  assert.equal(
    markdownToText('<https://example.com> 和 <hello@example.com>'),
    'https://example.com 和 hello@example.com',
  )
})
test('Markdown images retain their alternative text and nested emphasis', () => {
  assert.equal(
    markdownToText('![页面 **示意图**](https://example.com/image.png)\n\n![](decorative.png)'),
    '页面 示意图',
  )
})
test('Markdown list and task markers are removed without dropping item text', () => {
  assert.equal(
    markdownToText('- [x] 完成\n- [ ] 待办\n\n1. 第一项\n2. 第二项'),
    '完成\n待办\n\n第一项\n第二项',
  )
})
test('Markdown retains nested list items and separate quoted paragraphs', () => {
  assert.equal(
    markdownToText('- 父项\n  - 子项\n\n> 第一段\n>\n> 第二段'),
    '父项\n\n子项\n\n第一段\n\n第二段',
  )
})
test('Markdown tables become tab-separated rows with plain cell contents', () => {
  const source = '| 名称 | 内容 |\n| --- | --- |\n| **甲** | A\\|B |\n| 乙 | `const x = 1` |'
  assert.equal(markdownToText(source), '名称\t内容\n甲\tA|B\n乙\tconst x = 1')
})
test('Markdown preserves code indentation, blank lines and literal formatting characters', () => {
  const code = 'function test() {\n  const a = "**字面量** &amp;";\n\n\n  return a;\n}'
  assert.equal(markdownToText('```js\n' + code + '\n```'), code)
  assert.equal(processText('```js\n' + code + '\n```', presets.markdown.options).text, code)
})
test('Markdown preserves underscores and escaped punctuation in ordinary text', () => {
  assert.equal(
    markdownToText('file_name.ts、2 * 3 = 6、\\*原样星号\\*'),
    'file_name.ts、2 * 3 = 6、*原样星号*',
  )
})
test('Markdown decodes entities outside code without double decoding literals', () => {
  assert.equal(markdownToText('A &amp; B &lt; C，`&amp;` 和 \\&amp;'), 'A & B < C，&amp; 和 &amp;')
})
test('Markdown removes embedded HTML tags and comments while keeping visible text', () => {
  assert.equal(
    markdownToText('<div>你好 <strong>世界</strong><br>下一行</div>\n\n<!-- comment -->'),
    '你好 世界\n下一行',
  )
  assert.equal(markdownToText('<script>alert("no")</script>\n\n正文'), '正文')
})
test('Markdown conversion is optional and retains the original source separately', () => {
  const source = '# 标题\n\n**正文**'
  assert.equal(processText(source, presets.markdown.options).text, '标题\n\n正文')
  assert.equal(
    processText(source, { ...presets.markdown.options, markdownPlain: false }).text,
    source,
  )
  assert.equal(source, '# 标题\n\n**正文**')
  assert.equal(markdownToText(''), '')
})
