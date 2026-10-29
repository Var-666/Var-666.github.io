import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { Document, Packer, Paragraph, TextRun } from 'docx'
import { zipSync, strToU8 } from 'fflate'
import {
  verifyPdfBlob,
  verifyDocxBlob,
  wordToPdfReport,
  pdfToWordReport,
  formatSize,
} from './convert-report'

async function pdfBlob(pages: number): Promise<Blob> {
  const document = await PDFDocument.create()
  for (let index = 0; index < pages; index++) document.addPage([595, 842])
  const bytes = await document.save()
  return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' })
}

async function docxBlob(): Promise<Blob> {
  const blob = await Packer.toBlob(
    new Document({
      sections: [{ children: [new Paragraph({ children: [new TextRun('你好')] })] }],
    }),
  )
  return blob
}

test('生成的 PDF 可以被现有解析器重新打开并报告页数', async () => {
  assert.deepEqual(await verifyPdfBlob(await pdfBlob(2)), { ok: true, pages: 2 })
  assert.deepEqual(await verifyPdfBlob(new Blob([new Uint8Array([1, 2, 3])])), {
    ok: false,
    pages: 0,
  })
  assert.deepEqual(await verifyPdfBlob(new Blob([])), { ok: false, pages: 0 })
})

test('生成的 DOCX 通过 zip 结构与 document.xml 校验', async () => {
  assert.equal(await verifyDocxBlob(await docxBlob()), true)
  assert.equal(await verifyDocxBlob(new Blob([new Uint8Array([1, 2, 3])])), false)
  // 是合法 zip 但缺少 word/document.xml
  const otherZip = new Blob([zipSync({ 'hello.txt': strToU8('x') })])
  assert.equal(await verifyDocxBlob(otherZip), false)
})

test('Word → PDF 报告：成功时说明图片型属性，不宣称文字可搜索', () => {
  const report = wordToPdfReport({
    pages: 7,
    sections: 3,
    failedSections: 0,
    bytes: 512 * 1024,
    verify: { ok: true, pages: 7 },
  })
  assert.equal(report.status, 'ok')
  assert.ok(report.issues.some((issue) => issue.text.includes('图片型')))
  assert.ok(report.issues.every((issue) => !issue.text.includes('可搜索')))
  assert.deepEqual(
    report.metrics.map((metric) => metric.label),
    ['PDF 页数', '文件大小', '文档分节'],
  )
  assert.equal(report.metrics[0].value, '7 页')
  assert.equal(report.metrics[1].value, formatSize(512 * 1024))
})

test('Word → PDF 报告：渲染失败分节与校验异常都成为警告', () => {
  const partial = wordToPdfReport({
    pages: 5,
    sections: 4,
    failedSections: 1,
    bytes: 1000,
    verify: { ok: true, pages: 5 },
  })
  assert.equal(partial.status, 'notes')
  assert.ok(
    partial.issues.some(
      (issue) => issue.level === 'warning' && issue.text.includes('1 个文档分节渲染失败'),
    ),
  )

  const unopenable = wordToPdfReport({
    pages: 3,
    sections: 1,
    failedSections: 0,
    bytes: 1000,
    verify: { ok: false, pages: 0 },
  })
  assert.equal(unopenable.status, 'notes')
  assert.ok(unopenable.issues.some((issue) => issue.text.includes('重新打开校验')))

  const mismatch = wordToPdfReport({
    pages: 4,
    sections: 1,
    failedSections: 0,
    bytes: 1000,
    verify: { ok: true, pages: 3 },
  })
  assert.equal(mismatch.status, 'notes')
  assert.ok(mismatch.issues.some((issue) => issue.text.includes('读到 3 页')))
})

test('PDF → Word 报告：说明文字提取属性并提示核对，不宣称还原排版', () => {
  const report = pdfToWordReport({
    pages: 3,
    chars: 1234,
    paragraphs: 40,
    bytes: 20 * 1024,
    docxValid: true,
  })
  assert.equal(report.status, 'ok')
  assert.ok(report.issues.some((issue) => issue.text.includes('不保留图片、表格与原始排版')))
  assert.ok(
    report.issues.every(
      (issue) => !issue.text.includes('完美') && !issue.text.includes('完整还原'),
    ),
  )
  assert.deepEqual(
    report.metrics.map((metric) => metric.value),
    ['1,234', '40', '3 页', formatSize(20 * 1024)],
  )
})

test('PDF → Word 报告：DOCX 校验失败成为警告但不影响文件存在', () => {
  const report = pdfToWordReport({
    pages: 2,
    chars: 10,
    paragraphs: 2,
    bytes: 1024,
    docxValid: false,
  })
  assert.equal(report.status, 'notes')
  assert.ok(
    report.issues.some((issue) => issue.level === 'warning' && issue.text.includes('结构校验')),
  )
})
