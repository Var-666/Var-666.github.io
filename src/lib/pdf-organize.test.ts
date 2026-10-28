import type { PDFRawStream as RawStream } from 'pdf-lib'
import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName, degrees } from 'pdf-lib'
import {
  loadOrganizablePdf,
  organizePdf,
  organizePdfSegments,
  splitSegments,
  type PdfPageEntry,
  type SplitMode,
} from './pdf-organize'
const entry = (sourceId: string, index: number, rotation = 0, selected = true): PdfPageEntry => ({
  id: `${sourceId}-${index}`,
  sourceId,
  index,
  rotation,
  selected,
})

test('merge and extraction retain page geometry, selected order and original rotation without modifying sources', async () => {
  const first = await PDFDocument.create()
  first.addPage([200, 300]).drawText('FIRST')
  first.addPage([400, 500]).drawText('SECOND')
  first.getPage(1).setRotation(degrees(90))
  const second = await PDFDocument.create()
  const third = second.addPage([600, 700])
  third.drawText('THIRD')
  third.drawImage(
    await second.embedPng(
      'iVBORw0KGgoAAAANSUhEUgAAAKAAAABkCAYAAAABtjuPAAABcElEQVR4nO3OMQHAMADDMFMbnLIqtTEpDB/xoV9857+JBTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZBt2INuwA9mGHcg27EC2YQeyDTuQbdiBbMMOZNsDIFqHaj2cFN4AAAAASUVORK5CYII=',
    ),
    { x: 10, y: 20, width: 160, height: 100 },
  )
  const source = await loadOrganizablePdf(await first.save())
  const output = await organizePdf(
    new Map([
      ['a', source],
      ['b', second],
    ]),
    [entry('b', 0), entry('a', 0, 0, false), entry('a', 1, 90)],
  )
  const result = await PDFDocument.load(await output.arrayBuffer())
  assert.equal(result.getPageCount(), 2)
  assert.deepEqual(
    result.getPages().map((page) => page.getSize()),
    [
      { width: 600, height: 700 },
      { width: 400, height: 500 },
    ],
  )
  assert.deepEqual(
    result.getPages().map((page) => page.getRotation().angle),
    [0, 180],
  )
  assert.ok(result.getPages().every((page) => page.node.Contents()))
  assert.ok(result.getPage(0).node.Resources()?.has(PDFName.of('XObject')))
  assert.equal(source.getPageCount(), 2)
  assert.equal(source.getPage(1).getRotation().angle, 90)
})
test('form fields and orphan widgets are rejected rather than silently lost', async () => {
  const doc = await PDFDocument.create()
  doc.getForm().createTextField('name').addToPage(doc.addPage())
  await assert.rejects(loadOrganizablePdf(await doc.save()), /表单/)
  doc.catalog.delete(PDFName.of('AcroForm'))
  await assert.rejects(
    loadOrganizablePdf(await doc.save({ updateFieldAppearances: false })),
    /表单/,
  )
})
test('certified documents, invalid files and oversized page counts are rejected', async () => {
  const doc = await PDFDocument.create()
  doc.addPage()
  doc.catalog.set(PDFName.of('Perms'), doc.context.obj({}))
  await assert.rejects(loadOrganizablePdf(await doc.save()), /签名/)
  await assert.rejects(loadOrganizablePdf(new TextEncoder().encode('not a PDF')), /无法读取/)
  const big = await PDFDocument.create()
  for (let i = 0; i < 101; i++) big.addPage()
  await assert.rejects(loadOrganizablePdf(await big.save()), /100 页/)
})
test('empty selections and invalid page references or angles cannot produce a misleading PDF', async () => {
  const doc = await PDFDocument.create()
  doc.addPage()
  const sources = new Map([['a', doc]])
  for (const pages of [
    [],
    [entry('a', 0, 0, false)],
    [entry('missing', 0)],
    [entry('a', -1)],
    [entry('a', 1)],
    [entry('a', 0, 45)],
  ]) {
    await assert.rejects(organizePdf(sources, pages))
  }
})

test('splitSegments：每页 / 每 N 页 / 自定义页码段三种模式', () => {
  assert.deepEqual(splitSegments({ mode: 'each' }, 3), [[1], [2], [3]])
  assert.deepEqual(splitSegments({ mode: 'every', size: 2 }, 5), [[1, 2], [3, 4], [5]])
  assert.deepEqual(splitSegments({ mode: 'ranges', ranges: '1-3,4-5' }, 5), [
    [1, 2, 3],
    [4, 5],
  ])
  // 段序按用户输入保留（位置指当前排序中的第 N 页），不做重排
  assert.deepEqual(splitSegments({ mode: 'ranges', ranges: '2,1,3' }, 3), [[2], [1], [3]])
  for (const bad of [
    { mode: 'every', size: 0 },
    { mode: 'every', size: 5 },
    { mode: 'ranges', ranges: '1-2' },
    { mode: 'ranges', ranges: '1-3,5' }, // 漏掉第 4 页
  ] as SplitMode[])
    assert.throws(() => splitSegments(bad, 5))
  assert.throws(() => splitSegments({ mode: 'each' }, 0))
})

test('organizePdfSegments 按当前顺序与旋转分段导出', async () => {
  const { PDFDocument } = await import('pdf-lib')
  const source = await PDFDocument.create()
  for (let page = 0; page < 4; page++) {
    const added = source.addPage([200, 100])
    added.drawText(String(page + 1), { x: 10, y: 10, size: 40 })
  }
  const sources = new Map([['a', source]])
  const pages = [
    entry('a', 2, 90),
    entry('a', 0),
    entry('a', 3, 0, false), // 未勾选的页不参与拆分
    entry('a', 1),
  ]
  const outputs = await organizePdfSegments(
    sources,
    pages.filter((page) => page.selected),
    splitSegments({ mode: 'every', size: 2 }, 3),
  )
  assert.deepEqual(
    outputs.map((output) => [output.name, output.pages]),
    [
      ['拆分-01.pdf', 2],
      ['拆分-02.pdf', 1],
    ],
  )
  const first = await PDFDocument.load(new Uint8Array(await outputs[0].blob.arrayBuffer()))
  assert.equal(first.getPageCount(), 2)
  assert.equal(first.getPage(0).getRotation().angle, 90) // 当前顺序第 1 位 = 原第 3 页且已旋转
  const second = await PDFDocument.load(new Uint8Array(await outputs[1].blob.arrayBuffer()))
  assert.equal(second.getPageCount(), 1)
})

test('页码保持原文与页面旋转，按选中顺序编号，源文档不变', async () => {
  const { decodePDFRawStream, PDFArray, PDFRawStream } = await import('pdf-lib')
  const source = await PDFDocument.create()
  source.addPage([300, 400]).drawText('ORIGINAL')
  source.addPage([300, 400]).setRotation(degrees(-90))
  const before = await source.save()
  const result = await PDFDocument.load(
    await (
      await organizePdf(new Map([['a', source]]), [entry('a', 0), entry('a', 1)], {
        numbering: { start: 7 },
      })
    ).arrayBuffer(),
  )
  const content = (index: number) => {
    const contents = result.getPage(index).node.Contents()!
    return (contents instanceof PDFArray ? contents.asArray() : [contents])
      .map((ref) => result.context.lookup(ref))
      .filter((value): value is RawStream => value instanceof PDFRawStream)
      .map((stream) => new TextDecoder().decode(decodePDFRawStream(stream).decode()))
      .join('\n')
  }
  assert.match(content(0), /<4F524947494E414C>/)
  assert.match(content(0), /<37>/)
  assert.match(content(1), /<38>/)
  assert.equal(result.getPage(1).getRotation().angle, 270)
  assert.deepEqual(await source.save(), before)
})

test('水印图片只嵌入一次并设置透明度，拆分每份独立从起始值编号', async () => {
  const { PDFDict } = await import('pdf-lib')
  const source = await PDFDocument.create()
  source.addPage([200, 300])
  source.addPage([200, 300])
  const watermark = {
    bytes: Uint8Array.from(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAFElEQVR4nGN0S33BgA0wYRUdtBIAPicBo5sMNB0AAAAASUVORK5CYII=',
        'base64',
      ),
    ),
    opacity: 0.2,
  }
  const options = { numbering: { start: 9 }, watermark }
  const output = await PDFDocument.load(
    await (
      await organizePdf(new Map([['a', source]]), [entry('a', 0), entry('a', 1)], options)
    ).arrayBuffer(),
  )
  const refs = output.getPages().map((page) => {
    const objects = page.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict)
    assert.equal(objects.keys().length, 1)
    const states = page.node.Resources()!.lookup(PDFName.of('ExtGState'), PDFDict)
    assert.match(states.toString(), /ca 0\.2/)
    return objects.values()[0].toString()
  })
  assert.equal(refs[0], refs[1])
  const parts = await organizePdfSegments(
    new Map([['a', source]]),
    [entry('a', 0), entry('a', 1)],
    [[1], [2]],
    options,
  )
  assert.deepEqual(
    parts.map((part) => part.pages),
    [1, 1],
  )
  await assert.rejects(
    organizePdf(new Map([['a', source]]), [entry('a', 0)], { numbering: { start: 0 } }),
    /起始页码/,
  )
  await assert.rejects(
    organizePdf(new Map([['a', source]]), [entry('a', 0)], {
      watermark: { ...watermark, opacity: NaN },
    }),
    /不透明度/,
  )
  await assert.rejects(
    organizePdf(new Map([['a', source]]), [entry('a', 0)], {
      watermark: { ...watermark, bytes: new Uint8Array(1_000_001) },
    }),
    /水印/,
  )
})
