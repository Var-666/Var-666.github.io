import { useEffect, useRef } from 'react'
import { FileUp } from 'lucide-react'
import { useToolTransfer } from './tool-transfer'

export function GlobalFileIntake() {
  const transfer = useToolTransfer()
  useEffect(() => {
    const dragover = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes('Files')) event.preventDefault()
    }
    const dropped = (event: DragEvent) => {
      if (event.defaultPrevented || !event.dataTransfer?.files.length) return
      event.preventDefault()
      transfer?.openIntake({ files: Array.from(event.dataTransfer.files) })
    }
    const pasted = (event: ClipboardEvent) => {
      if (
        event.target instanceof HTMLElement &&
        event.target.closest('input,textarea,[contenteditable="true"]') &&
        event.clipboardData?.getData('text/plain')
      )
        return
      const files = Array.from(event.clipboardData?.files ?? [])
      if (files.length)
        queueMicrotask(() => {
          if (!event.defaultPrevented) transfer?.openIntake({ files })
        })
    }
    window.addEventListener('dragover', dragover)
    window.addEventListener('drop', dropped)
    window.addEventListener('paste', pasted)
    return () => {
      window.removeEventListener('dragover', dragover)
      window.removeEventListener('drop', dropped)
      window.removeEventListener('paste', pasted)
    }
  }, [transfer])
  return null
}

export function HomeFileDrop() {
  const transfer = useToolTransfer()
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        className="home-file-drop"
        onClick={(event) => {
          event.currentTarget.focus({ preventScroll: true })
          input.current?.click()
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          transfer?.openIntake({ files: Array.from(event.dataTransfer.files) })
        }}
      >
        <FileUp size={28} />
        <strong>选择文件，或拖到这里</strong>
        <span>PDF · 图片 · Word · 表格 · 文本</span>
      </button>
      <input
        ref={input}
        type="file"
        tabIndex={-1}
        multiple
        className="sr-only"
        aria-label="首页选择文件"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          event.target.value = ''
          if (files.length) transfer?.openIntake({ files })
        }}
      />
    </>
  )
}
