import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument, PDFName, degrees } from 'pdf-lib'
import { loadOrganizablePdf, organizePdf, type PdfPageEntry } from './pdf-organize'
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
