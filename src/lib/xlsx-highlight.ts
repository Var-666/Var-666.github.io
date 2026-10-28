import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import type { OutputFile } from './file-convert'

/** Adds fills to this app's three-sheet diff export; it never parses an uploaded workbook. */
export async function highlightDiffWorkbook(output: OutputFile): Promise<OutputFile> {
  const files = unzipSync(new Uint8Array(await output.blob.arrayBuffer()))
  const stylesFile = files['xl/styles.xml']
  if (!stylesFile) throw new Error('无法生成高亮工作簿，请改用 CSV 导出。')
  let styles = strFromU8(stylesFile)
  const fills = styles.match(/<fills count="(\d+)">([\s\S]*?)<\/fills>/),
    xfs = styles.match(/<cellXfs count="(\d+)">([\s\S]*?)<\/cellXfs>/)
  if (!fills || !xfs) throw new Error('工作簿样式结构不兼容，请改用 CSV 导出。')
  const firstFill = Number(fills[1]),
    firstStyle = Number(xfs[1])
  const colors = ['FFFCE4E4', 'FFE2F0D9']
  styles = styles.replace(
    fills[0],
    `<fills count="${firstFill + 2}">${fills[2]}${colors.map((color) => `<fill><patternFill patternType="solid"><fgColor rgb="${color}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills>`,
  )
  styles = styles.replace(
    xfs[0],
    `<cellXfs count="${firstStyle + 2}">${xfs[2]}${colors.map((_, index) => `<xf numFmtId="0" fontId="0" fillId="${firstFill + index}" borderId="0" xfId="0" applyFill="1"/>`).join('')}</cellXfs>`,
  )
  files['xl/styles.xml'] = strToU8(styles)
  for (let index = 0; index < 3; index++) {
    const path = `xl/worksheets/sheet${index + 1}.xml`
    if (!files[path]) throw new Error('差异工作簿缺少工作表，请改用 CSV 导出。')
    const xml = strFromU8(files[path]).replace(
      /<c\b[^>]*\br="([A-Z]+)(\d+)"[^>]*>/g,
      (cell, column: string, row: string) => {
        if (Number(row) < 2) return cell
        const color =
          index === 0 ? 1 : index === 1 ? 0 : column === 'C' ? 0 : column === 'D' ? 1 : -1
        if (color < 0) return cell
        return cell.replace(/\s+s="\d+"/, '').replace(/(\/?>)$/, ` s="${firstStyle + color}"$1`)
      },
    )
    files[path] = strToU8(xml)
  }
  const data = zipSync(files, { level: 6 })
  return {
    ...output,
    blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: output.blob.type }),
  }
}
