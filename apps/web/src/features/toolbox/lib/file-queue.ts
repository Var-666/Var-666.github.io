export function validateQueueFiles(
  existing: File[],
  incoming: File[],
  accept: string,
  limitMb: number,
): void {
  const all = [...existing, ...incoming]
  if (all.length > 10 || all.reduce((sum, file) => sum + file.size, 0) > 50 * 1024 * 1024)
    throw new Error('队列最多 10 个文件，总大小不超过 50 MB')
  const extensions = accept.split(',')
  if (
    incoming.some(
      (file) => !extensions.some((extension) => file.name.toLowerCase().endsWith(extension)),
    )
  )
    throw new Error(`请选择 ${accept} 文件`)
  if (incoming.some((file) => !file.size || file.size > limitMb * 1024 * 1024))
    throw new Error(`文件不能为空，且单个不超过 ${limitMb} MB`)
}
