import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { processText, type Options, type ProcessResult } from '@/lib/text'
import { textDiff, type DiffHunk } from '@/lib/text-diff'

export function useTextProcessing(source: string, options: Options, composing: boolean) {
  const [result, setResult] = useState<ProcessResult>({ text: '', changes: [] })
  const [processing, setProcessing] = useState(false)
  const [failed, setFailed] = useState(false)
  const [diff, setDiff] = useState<DiffHunk[] | null>(null)
  const worker = useRef<Worker | null>(null)
  const request = useRef(0)
  useEffect(() => {
    let instance: Worker | null = null
    try {
      instance = new Worker(new URL('../lib/text.worker.ts', import.meta.url), { type: 'module' })
      worker.current = instance
      instance.onmessage = ({ data }) => {
        if (data.id !== request.current) return
        setProcessing(false)
        if (data.error) {
          setFailed(true)
          setDiff(null)
          toast.error(data.error)
        } else {
          setResult(data.result)
          setDiff(data.diff ?? null)
          setFailed(false)
        }
      }
      instance.onerror = () => {
        instance?.terminate()
        worker.current = null
        setFailed(true)
        setDiff(null)
        setProcessing(false)
        toast.error('处理线程暂时不可用，请修改文字重试，或刷新页面。')
      }
    } catch {
      worker.current = null
    }
    return () => {
      instance?.terminate()
      worker.current = null
    }
  }, [])
  useEffect(() => {
    const id = ++request.current
    setFailed(false)
    if (composing) {
      setProcessing(true)
      return
    }
    if (!source) {
      setResult({ text: '', changes: [] })
      setDiff([])
      setProcessing(false)
      return
    }
    setProcessing(true)
    const timer = setTimeout(() => {
      if (worker.current) worker.current.postMessage({ id, text: source, options })
      else {
        const processed = processText(source, options)
        setResult(processed)
        setDiff(textDiff(source, processed.text))
        setProcessing(false)
      }
    }, 180)
    return () => clearTimeout(timer)
  }, [source, options, composing])
  return { result, processing, failed, diff, request }
}
