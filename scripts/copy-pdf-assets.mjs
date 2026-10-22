import { cpSync, mkdirSync } from 'node:fs'
// PDF.js needs these local resources to read CJK fonts without external requests.
mkdirSync('public/pdf-assets', { recursive: true })
for (const directory of ['cmaps', 'standard_fonts']) {
  cpSync(`node_modules/pdfjs-dist/${directory}`, `public/pdf-assets/${directory}`, { recursive: true })
}
