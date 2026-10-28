import { useEffect, useState } from 'react'
import type { ImageSize, PdfSheetSize } from '@/lib/media-options'
import { readFileOptions, saveFileOptions, type FileOptionSchema } from '@/lib/storage'

export type FileOptions = {
  format: 'png' | 'jpeg' | 'webp'
  imageSize: ImageSize
  quality: number
  compressTarget: '100' | '200' | '500' | '1000'
  compressFormat: 'jpeg' | 'webp'
  pdfFormat: 'png' | 'jpeg'
  pdfLayout: 'pages' | 'long'
  mergeSize: PdfSheetSize
  mergeOrientation: 'portrait' | 'landscape'
  mergeFit: 'contain' | 'cover'
  pages: string
  detectNumbers: boolean
}
export const defaultFileOptions: FileOptions = {
  format: 'png',
  imageSize: 'original',
  quality: 90,
  compressTarget: '200',
  compressFormat: 'jpeg',
  pdfFormat: 'png',
  pdfLayout: 'pages',
  mergeSize: 'a4',
  mergeOrientation: 'portrait',
  mergeFit: 'contain',
  pages: '',
  detectNumbers: false,
}
// 参数记忆的 schema：只存选项值（枚举 / 数值 / 布尔），永不存文件内容
export const fileOptionSchema: FileOptionSchema = {
  format: (value) => value === 'png' || value === 'jpeg' || value === 'webp',
  imageSize: (value) =>
    value === 'original' || value === '1920' || value === '1280' || value === 'half',
  quality: (value) => typeof value === 'number' && value >= 10 && value <= 100,
  compressTarget: (value) => ['100', '200', '500', '1000'].includes(value as string),
  compressFormat: (value) => value === 'jpeg' || value === 'webp',
  pdfFormat: (value) => value === 'png' || value === 'jpeg',
  pdfLayout: (value) => value === 'pages' || value === 'long',
  mergeSize: (value) => value === 'a4' || value === 'a3' || value === 'letter',
  mergeOrientation: (value) => value === 'portrait' || value === 'landscape',
  mergeFit: (value) => value === 'contain' || value === 'cover',
  pages: (value) => typeof value === 'string' && value.length <= 50,
  detectNumbers: (value) => typeof value === 'boolean',
}

export function useFileOptions() {
  const [options, setOptions] = useState<FileOptions>(() => ({
    ...defaultFileOptions,
    ...readFileOptions(localStorage, fileOptionSchema),
  }))
  useEffect(() => {
    const timer = setTimeout(() => saveFileOptions(localStorage, options, fileOptionSchema), 300)
    return () => clearTimeout(timer)
  }, [options])
  return [options, setOptions] as const
}
