export type TextEncoding = 'auto' | 'utf-8' | 'gb18030'
export type DecodedText = { text: string; encoding: 'UTF-8' | 'GBK / GB18030' }

export function decodeText(bytes: ArrayBuffer, requested: TextEncoding = 'auto'): DecodedText {
  const encodings = requested === 'auto' ? ['utf-8', 'gb18030'] : [requested]
  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes)
      if (text.includes('\0')) throw new Error('Text contains null bytes')
      return { text, encoding: encoding === 'utf-8' ? 'UTF-8' : 'GBK / GB18030' }
    } catch {
      /* Try the next explicitly supported encoding. */
    }
  }
  throw new Error(
    requested === 'auto'
      ? '无法按 UTF-8 或 GBK / GB18030 读取，请检查文件编码。'
      : `无法按 ${requested === 'utf-8' ? 'UTF-8' : 'GBK / GB18030'} 读取，请切换读取编码或检查文件。`,
  )
}

export async function readTextFile(
  file: Pick<File, 'arrayBuffer'>,
  encoding: TextEncoding = 'auto',
) {
  return decodeText(await file.arrayBuffer(), encoding)
}

export const encodingNotices = (encoding: DecodedText['encoding']) =>
  encoding === 'UTF-8' ? [] : [`已按 ${encoding} 读取`]
