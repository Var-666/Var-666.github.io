import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultRenameOptions,
  parseNameList,
  renamePreview,
  validateRenameFiles,
  type RenameOptions,
} from './rename'
const options: RenameOptions = {
  ...defaultRenameOptions,
}

test('renaming preserves extensions and uses literal replacement, prefix, suffix and ordered numbers', () => {
  assert.deepEqual(
    renamePreview(['旧报告旧.PDF', '原文.tar.gz'], {
      ...options,
      find: '旧',
      replace: '$&',
      prefix: '项目-',
      suffix: '-终稿',
      start: 9,
    }).map((row) => row.name),
    ['项目-$&报告$&_009-终稿.PDF', '项目-原文.tar_010-终稿.gz'],
  )
  assert.deepEqual(
    renamePreview(['a.txt', 'b.png'], { ...options, base: '附件' }).map((row) => row.name),
    ['附件_001.txt', '附件_002.png'],
  )
})
test('extensionless and dotfiles retain their names; empty text files are allowed', () => {
  assert.deepEqual(
    renamePreview(['README', '.gitignore'], { ...options, numbered: false }).map((row) => row.name),
    ['README', '.gitignore'],
  )
  assert.doesNotThrow(() => validateRenameFiles([], [{ name: 'empty.txt', size: 0 }]))
})
test('duplicate names including case and Unicode normalization are blocked before packing', () => {
  assert.ok(
    renamePreview(['A.txt', 'a.TXT'], { ...options, numbered: false }).every((row) => row.error),
  )
  assert.ok(
    renamePreview(['é.txt', 'e\u0301.txt'], { ...options, numbered: false }).every(
      (row) => row.error,
    ),
  )
  assert.ok(
    renamePreview(['a.txt', 'b.txt'], { ...options, base: 'same', numbered: false }).every(
      (row) => row.error,
    ),
  )
  assert.ok(
    renamePreview(['a.txt', 'b.txt'], { ...options, base: 'same' }).every((row) => !row.error),
  )
})
test('illegal, reserved, overly long and invalid numbering results cannot be downloaded', () => {
  for (const name of [
    '',
    '.',
    '..',
    'bad/name',
    'C:secret',
    'NUL',
    'aux.txt',
    'COM1.pdf',
    'a\u0000b',
    'name ',
    '__proto__',
    '长'.repeat(100),
  ]) {
    assert.ok(
      renamePreview(['x'], { ...options, numbered: false, base: name, find: name ? '' : 'x' })[0]
        .error,
      name,
    )
  }
  for (const start of [-1, 0.5, Infinity, 1000001])
    assert.ok(renamePreview(['a.txt'], { ...options, start })[0].error)
})
test('combined queue enforces count and byte limits without changing the input', () => {
  const existing = [{ name: 'a', size: 50 * 1024 * 1024 }]
  assert.throws(
    () => validateRenameFiles(existing, [{ name: 'b', size: 51 * 1024 * 1024 }]),
    /100 MB/,
  )
  assert.throws(
    () =>
      validateRenameFiles(
        [],
        Array.from({ length: 101 }, () => ({ name: 'a', size: 1 })),
      ),
    /100 个/,
  )
  assert.equal(existing.length, 1)
})

test('cleanup：特殊字符替换为空格、折叠空格与重复分隔符，只作用于主名', () => {
  const cleaned = renamePreview(['a.txt'], {
    ...options,
    base: '报告:终稿?v2',
    cleanup: { specialChars: true, spaces: true, duplicateSeparators: true },
  })
  assert.equal(cleaned[0].name, '报告 终稿 v2_001.txt')
  assert.equal(cleaned[0].error, '')
  // 不开清理时同样的名称报非法字符
  const strict = renamePreview(['a.txt'], { ...options, base: '报告:终稿' })
  assert.match(strict[0].error, /不支持的字符/)
  const sep = renamePreview(['a.txt'], {
    ...options,
    base: '甲--乙__丙  丁',
    numbered: false,
    cleanup: { specialChars: false, spaces: false, duplicateSeparators: true },
  })
  assert.equal(sep[0].name, '甲-乙_丙 丁.txt')
})

test('逐项覆盖名走同一套校验，并与生成名一起参与重名检测', () => {
  const rows = renamePreview(['a.txt', 'b.txt', 'c.txt'], { ...options, base: '统一' }, [
    '自定义.txt',
    undefined,
    '统一_002.txt',
  ])
  assert.equal(rows[0].name, '自定义.txt')
  assert.equal(rows[0].overridden, true)
  // 第三行覆盖成「统一_002.txt」，与第二行的生成名撞名 → 两个都报重名
  assert.equal(rows[2].name, '统一_002.txt')
  assert.match(rows[1].error, /同名/)
  assert.match(rows[2].error, /同名/)
  // 覆盖名本身非法同样拦截
  const illegal = renamePreview(['a.txt'], options, ['坏/名字.txt'])
  assert.match(illegal[0].error, /不支持的字符/)
})

test('parseNameList：数量必须与文件数一致，空白行忽略', () => {
  assert.deepEqual(parseNameList('甲\n\n乙\n丙', 3), { names: ['甲', '乙', '丙'] })
  assert.match((parseNameList('甲\n乙', 3) as { error: string }).error, /2 个名称 vs 3 个文件/)
  assert.match((parseNameList('  \n', 1) as { error: string }).error, /先粘贴/)
})
