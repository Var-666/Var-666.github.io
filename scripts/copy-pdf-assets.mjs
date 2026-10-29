import { cpSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = fileURLToPath(new URL('../apps/web/', import.meta.url))
const require = createRequire(join(web, 'package.json'))
const pdf = dirname(require.resolve('pdfjs-dist/package.json'))
const target = join(web, 'public/pdf-assets')
mkdirSync(target, { recursive: true })
for (const directory of ['cmaps', 'standard_fonts'])
  cpSync(join(pdf, directory), join(target, directory), { recursive: true })
const workerTarget = join(web, 'public/tools/pdf-assets')
mkdirSync(workerTarget, { recursive: true })
cpSync(join(pdf, 'build/pdf.worker.min.mjs'), join(workerTarget, 'pdf.worker.min.mjs'))
cpSync(require.resolve('@neslinesli93/qpdf-wasm/dist/qpdf.wasm'), join(target, 'qpdf.wasm'))
