import type { OutputFile } from './file-convert'

export const directoryPicker = () =>
  (
    window as Window & {
      showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>
    }
  ).showDirectoryPicker?.bind(window)

export function outputParts(outputs: OutputFile[]): OutputFile[] {
  return outputs.flatMap((output) => (output.parts ? outputParts(output.parts) : [output]))
}

export function filesToShare(
  outputs: OutputFile[],
  browser: Pick<Navigator, 'canShare' | 'share'> = navigator,
) {
  if (!browser.canShare || !browser.share || !outputs.length) return null
  const files = outputs.map(
    (output) => new File([output.blob], output.name, { type: output.blob.type }),
  )
  try {
    return browser.canShare({ files }) ? files : null
  } catch {
    return null
  }
}

export async function saveToDirectory(
  directory: FileSystemDirectoryHandle,
  outputs: OutputFile[],
  onProgress: (done: number, total: number) => void = () => {},
): Promise<string[]> {
  const files = outputParts(outputs)
  if (
    !files.length ||
    files.length > 1000 ||
    files.reduce((sum, file) => sum + file.blob.size, 0) > 100 * 1024 * 1024
  )
    throw new Error('一次最多保存 1000 个文件、总计 100 MB，请减少数量或使用 ZIP。')
  if (
    files.some(
      ({ name }) =>
        !name ||
        name === '.' ||
        name === '..' ||
        name.includes('/') ||
        name.includes('\\') ||
        [...name].some((character) => character.charCodeAt(0) < 32),
    )
  )
    throw new Error('文件名不能包含路径或控制字符，请改名后重试或下载 ZIP。')
  const saved: string[] = [],
    used = new Set<string>()
  try {
    for (const output of files) {
      const dot = output.name.lastIndexOf('.'),
        base = dot > 0 ? output.name.slice(0, dot) : output.name,
        extension = dot > 0 ? output.name.slice(dot) : ''
      let name = output.name,
        suffix = 1
      while (true) {
        let exists = used.has(name.normalize('NFC').toLowerCase())
        if (!exists) {
          try {
            await directory.getFileHandle(name)
            exists = true
          } catch (error) {
            if ((error as DOMException).name === 'TypeMismatchError') exists = true
            else if ((error as DOMException).name !== 'NotFoundError') throw error
          }
        }
        if (!exists) break
        used.add(name.normalize('NFC').toLowerCase())
        if (++suffix > 10_000) throw new Error('同名文件过多，请换一个文件夹。')
        name = `${base} (${suffix})${extension}`
      }
      const handle = await directory.getFileHandle(name, { create: true })
      const writer = await handle.createWritable()
      try {
        await writer.write(output.blob)
        await writer.close()
      } catch (error) {
        await writer.abort().catch(() => {})
        throw error
      }
      used.add(name.normalize('NFC').toLowerCase())
      saved.push(name)
      onProgress(saved.length, files.length)
    }
  } catch (error) {
    throw new Error(
      `已保存 ${saved.length}/${files.length} 个文件，后续保存失败：${error instanceof Error ? error.message : '请检查文件夹权限或剩余空间'}。已保存的文件保留，请检查后重试或下载 ZIP。`,
      { cause: error },
    )
  }
  return saved
}
