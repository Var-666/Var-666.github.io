import { test } from 'node:test'
import assert from 'node:assert/strict'
import { zipSync } from 'fflate'
import {
  identifyFile,
  intakeTasks,
  prepareTransfer,
  taskLimit,
  validateIntakeFiles,
} from './file-intake'

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const office = (path: string) =>
  new File(
    [zipSync({ [path]: new TextEncoder().encode('<xml/>') }) as Uint8Array<ArrayBuffer>],
    'report.zip',
  )

test('file headers identify misnamed images/PDF/Office, corrupted files do not gain conversion tasks', async () => {
  assert.equal((await identifyFile(new File([png], 'photo.txt'))).kind, 'image')
  assert.equal((await identifyFile(new File(['%PDF-1.7\n'], 'report.bin'))).kind, 'pdf')
  assert.equal((await identifyFile(office('xl/workbook.xml'))).kind, 'xlsx')
  assert.equal((await identifyFile(office('word/document.xml'))).kind, 'docx')
  assert.equal((await identifyFile(new File(['not a PDF'], 'fake.pdf'))).kind, 'unknown')
  assert.equal(
    (await identifyFile(new File(['PDF instructions: %PDF-1.7'], 'guide.txt'))).kind,
    'text',
  )
  const unknown = await identifyFile(new File([new Uint8Array([0xff, 0, 0xfe])], 'opaque.bin'))
  assert.deepEqual(
    intakeTasks([unknown]).map((task) => task.id),
    ['rename'],
  )
})

test('task compatibility and destination limits reflect actual tools, including mixed tables', async () => {
  const csv = await identifyFile(new File(['编号,名称\n001,中文'], 'one.csv'))
  const xlsx = await identifyFile(office('xl/workbook.xml'))
  assert.ok(intakeTasks([csv, xlsx]).some((task) => task.target === 'compare'))
  assert.ok(intakeTasks([csv, xlsx]).some((task) => task.target === 'table'))
  const compare = intakeTasks([csv, csv, csv]).find((task) => task.target === 'compare')!
  assert.match(taskLimit(compare, [csv, csv, csv]), /最多 2 个/)
  const large = { ...csv, file: new File(['x'.repeat(2 * 1024 * 1024 + 1)], 'large.csv') }
  assert.match(taskLimit(compare, [large]), /CSV 2/)
  assert.throws(() => validateIntakeFiles(Array.from({ length: 101 }, () => csv.file)), /100/)
  const empty = await identifyFile(new File([], 'empty.txt'))
  assert.equal(taskLimit(intakeTasks([empty])[0], [empty]), '') // Renaming empty files is valid.
})

test('handoff keeps original bytes/names for rename and avoids suffix collisions in text imports', async () => {
  const image = await identifyFile(new File([png], 'photo.txt'))
  const imageTask = intakeTasks([image]).find((task) => task.id === 'image')!
  const converted = prepareTransfer(imageTask, [image]).files![0]
  assert.equal(converted.name, 'photo.txt.png')
  assert.deepEqual(new Uint8Array(await converted.arrayBuffer()), png)
  assert.equal(
    prepareTransfer(
      intakeTasks([image]).find((task) => task.id === 'rename')!,
      [image],
    ).files![0],
    image.file,
  )
  const files = await Promise.all(
    [new File(['a,b'], 'same.csv'), new File(['text'], 'same.txt')].map(identifyFile),
  )
  const batch = prepareTransfer(
    intakeTasks(files).find((task) => task.target === 'text-batch')!,
    files,
  )
  assert.deepEqual(
    batch.files!.map((file) => file.name),
    ['same.csv.txt', 'same.txt'],
  )
})
