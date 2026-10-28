# shadcn/ui

Components in src/components/ui were obtained from https://ui.shadcn.com/r/styles/new-york/.

MIT License

Copyright (c) 2023 shadcn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## File conversion libraries

- Papa Parse: MIT, https://github.com/mholt/PapaParse
- docx-preview: Apache-2.0, https://github.com/VolodymyrBaydalka/docxjs
- docx: MIT, https://github.com/dolanmiu/docx
- PDF.js: Apache-2.0, https://github.com/mozilla/pdf.js
- pdf-lib: MIT, https://github.com/Hopding/pdf-lib
- jsPDF: MIT, https://github.com/parallax/jsPDF
- html2canvas: MIT, https://github.com/niklasvh/html2canvas
- fflate: MIT, https://github.com/101arrowz/fflate
- exifr 7.1.3: MIT, https://github.com/MikeKovarik/exifr (EXIF date parsing, loaded on demand)

The distributed packages retain their own copyright and license notices.

## SheetJS CE

- Version: 0.20.3, Apache-2.0 (see `vendor/XLSX-LICENSE.txt`; the archive retains upstream notices).
- Official source: https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
- The unchanged official archive is included at `vendor/xlsx-0.20.3.tgz` so CI does not depend on that CDN being available. Its SHA-512 matches the pre-existing npm lockfile: `oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==`.

## OpenCC JavaScript

- opencc-js 1.4.2, https://github.com/nk2028/opencc-js, MIT (implementation) AND Apache-2.0 (bundled opencc-data dictionary derivatives).
- Original upstream copyright, license texts and data attribution are redistributed at `public/licenses/opencc-js.txt` (also available in the published site's `/licenses/opencc-js.txt`). No runtime CDN or dictionary requests are used.

## HEIC decoder

- libheif-js 1.23.5 / libheif 1.23.5, LGPL-3.0, https://github.com/catdad-experiments/libheif-js . The unchanged WASM bundle is imported only by a dedicated local Worker.
- Upstream library and codec licenses, sources/build links and replacement instructions are redistributed in `public/licenses/libheif-js.txt`, published at `/licenses/libheif-js.txt`. No decoder/CDN requests leave this origin.
- `e2e/fixtures/colors.heic` is a synthetic 64×40 four-quadrant RGB fixture generated for this project with macOS sips; it contains no personal photo or personal metadata.

## PDF structure processing

- @neslinesli93/qpdf-wasm 0.3.0 (npm metadata: ISC), build source: https://github.com/neslinesli93/qpdf-wasm/tree/e661db2d17e391a9fbe6b350b4ea6dbd8c385891 . Unmodified generated JavaScript and WASM are served locally, loaded only by the PDF worker.
- Native qpdf 12.2.0, Apache-2.0; build pins qpdf commit 856d32c610334855d30e96d25eb5f9636fb62f08, zlib 21767c654d31d2dccdde4330529775c6c5fd5389, and libjpeg-turbo 7aa2a898c564041a24b09d0a6e780aaa632d08d3. Native copyright, Apache-2.0, libjpeg-turbo/IJG and zlib notices are redistributed at `public/licenses/qpdf.txt`, published at `/licenses/qpdf.txt`; source and build links are included there.
- `e2e/fixtures/encrypted.pdf` is a synthetic two-page ReportLab/pypdf fixture with selectable text, a bookmark, rotation and AES-256 encryption. Its test password (including surrounding spaces) is ` 密碼-123 `; no personal document or private credential is included.
