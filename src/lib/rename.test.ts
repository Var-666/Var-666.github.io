import test from 'node:test'
import assert from 'node:assert/strict'
import { renamePreview, validateRenameFiles, type RenameOptions } from './rename'
const options: RenameOptions = {
  base: '',
  find: '',
  replace: '',
  prefix: '',
  suffix: '',
  numbered: true,
  start: 1,
  digits: 3,
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
