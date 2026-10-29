import test from 'node:test'
import assert from 'node:assert/strict'
import { convertChinese, defaultExtraction, extractText, runTextExtra } from './text-extra'
import { detailedTextStats } from './text-statistics'

test('提取保持原顺序与前导零，可去重；邮箱边界和百万字符无匹配扫描', () => {
  const source = '甲 a.001@example.com，乙 B+tag@sub.example.org；再见 a.001@example.com'
  assert.deepEqual(extractText(source, defaultExtraction), {
    text: 'a.001@example.com\nB+tag@sub.example.org',
    count: 2,
  })
  assert.equal(extractText(source, { ...defaultExtraction, unique: false }).count, 3)
  assert.deepEqual(extractText('a'.repeat(1_000_000), defaultExtraction), { text: '', count: 0 })
})
test('大陆电话避免截取长号，身份证日期与校验码筛选，网址保留配对括号', () => {
  assert.equal(
    extractText('13800138000 / 013800138000 / 138001380000 / 19912345678', {
      ...defaultExtraction,
      preset: 'phone',
    }).text,
    '13800138000\n19912345678',
  )
  assert.equal(
    extractText('11010519491231002x；110105194912310021；11010519490231002X', {
      ...defaultExtraction,
      preset: 'id',
    }).text,
    '11010519491231002x',
  )
  assert.equal(
    extractText('链接：https://example.com/path_(1))，另见 http://example.org/a?x=001.', {
      ...defaultExtraction,
      preset: 'url',
    }).text,
    'https://example.com/path_(1)\nhttp://example.org/a?x=001',
  )
})
test('正则捕获组、Unicode零宽匹配与非法规则均有边界', () => {
  const options = {
    ...defaultExtraction,
    preset: 'regex' as const,
    pattern: '编号：(\\d+)',
    group: 1 as const,
  }
  assert.deepEqual(extractText('编号：001；编号：002', options), { text: '001\n002', count: 2 })
  assert.deepEqual(extractText('😀A', { ...options, pattern: '(?=.)', flags: 'u', group: 0 }), {
    text: '',
    count: 0,
  })
  for (const patch of [{ pattern: '[' }, { flags: 'ii' }, { flags: 'y' }, { pattern: '编号' }])
    assert.throws(() => extractText('编号', { ...options, ...patch }))
  assert.throws(
    () => extractText('a', { ...defaultExtraction, preset: '__proto__' as 'email' }),
    /类型无效/,
  )
})
test('提取资源边界明确报错，达到一万项不被截断', () => {
  const options = { ...defaultExtraction, preset: 'regex' as const, pattern: '\\d+', unique: false }
  assert.equal(extractText('001 '.repeat(10_000), options).count, 10_000)
  assert.throws(() => extractText('001 '.repeat(10_001), options), /1 万项/)
  assert.throws(() => extractText('a'.repeat(1_000_001), options), /100 万字符/)
  assert.equal(
    extractText('a'.repeat(1_000_000), { ...options, pattern: 'a+' }).text.length,
    1_000_000,
  )
  assert.throws(
    () => extractText('a'.repeat(2000), { ...options, pattern: '(?=(a{1000}))', group: 1 }),
    /结果超过/,
  )
})
test('OpenCC 真词典处理一简多繁、台湾词汇及繁转简，保留混合字符', async () => {
  assert.equal(
    await convertChinese('头发，理发，发展，后台；自行车和软件 001 😀', 'traditional'),
    '頭髮，理髮，發展，後臺；自行車和軟件 001 😀',
  )
  assert.equal(await convertChinese('自行车和软件', 'taiwan'), '腳踏車和軟體')
  assert.equal(
    await convertChinese('頭髮，理髮，發展，後臺', 'simplified'),
    '头发，理发，发展，后台',
  )
  await assert.rejects(convertChinese('a'.repeat(1_000_001), 'traditional'), /100 万/)
  await assert.rejects(convertChinese('text', 'invalid' as 'traditional'), /方向无效/)
})
test('独立对比不应用整理规则，首尾空格与空内容也构成真实差异', async () => {
  assert.deepEqual(
    await runTextExtra({ kind: 'diff', left: ' 甲 ', right: '甲' }).then((value) =>
      value.diff?.map((h) => h.kind),
    ),
    ['remove'],
  )
  assert.equal(
    (await runTextExtra({ kind: 'diff', left: '', right: '新增' })).diff?.[0].kind,
    'add',
  )
  assert.deepEqual(await runTextExtra({ kind: 'diff', left: '同文', right: '同文' }), { diff: [] })
  await assert.rejects(
    runTextExtra({ kind: 'diff', left: 'a'.repeat(200_001), right: '' }),
    /20 万/,
  )
})
test('详细统计按Unicode字符、Latin词、标点和空白段落统计', () => {
  assert.deepEqual(detailedTextStats('你𠀀😀 Hello-world, café!\n\n第二段。'), {
    characters: 28,
    nonSpace: 24,
    chinese: 5,
    words: 2,
    punctuation: 4,
    paragraphs: 2,
    readingMinutes: 1,
  })
  assert.equal(detailedTextStats('甲\r\r乙').paragraphs, 2)
  assert.equal(detailedTextStats("It's John's book").words, 3)
  assert.equal(detailedTextStats('词'.repeat(600)).readingMinutes, 2)
  assert.equal(detailedTextStats('001').readingMinutes, 1)
  assert.equal(detailedTextStats(' \n ').readingMinutes, 0)
  assert.equal(detailedTextStats('').paragraphs, 0)
})
