import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { EncryptedPdfError, loadOrganizablePdf } from './pdf-organize'
import { processPdfLocal } from './pdf-qpdf'

test('独立pypdf生成的AES-256文件被识别为加密，不冒充可读文档', async () => {
  const bytes = readFileSync(new URL('../../e2e/fixtures/encrypted.pdf', import.meta.url))
  await assert.rejects(loadOrganizablePdf(new Uint8Array(bytes)), EncryptedPdfError)
})
test('qpdf入口在启动Worker前拒绝过大输入与异常密码', async () => {
  await assert.rejects(processPdfLocal(new Blob(), 'decrypt'), /不能为空/)
  await assert.rejects(
    processPdfLocal(new Blob([new Uint8Array(20 * 1024 * 1024 + 1)]), 'decrypt'),
    /20 MB/,
  )
  await assert.rejects(processPdfLocal(new Blob(['%PDF']), 'decrypt', 'bad\npassword'), /换行/)
  await assert.rejects(processPdfLocal(new Blob(['%PDF']), 'decrypt', 'x'.repeat(1025)), /1024/)
})
