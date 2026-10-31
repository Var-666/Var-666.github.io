import { useEffect, useRef, useState } from 'react'
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
  const [over, setOver] = useState(false)
  return (
    <>
      {/* blur-in 放在包裹层：它的 fill 会锁死 transform，不能挂在有拖入缩放的按钮上 */}
      <div className="tb-blur-in" style={{ animationDelay: '0.3s' }}>
        <button
          className={`home-file-drop${over ? ' is-over' : ''}`}
          onClick={(event) => {
            event.currentTarget.focus({ preventScroll: true })
            input.current?.click()
          }}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setOver(false)
            transfer?.openIntake({ files: Array.from(event.dataTransfer.files) })
          }}
        >
          <span className="home-file-drop-icon" aria-hidden="true">
            <FileUp size={30} strokeWidth={1.75} />
          </span>
          <strong>{over ? '松手，看看能做什么' : '选择文件，或拖到这里'}</strong>
          <span className="home-file-drop-formats">
            {['PDF', '图片', 'Word', '表格', '文本'].map((label) => (
              <span key={label}>{label}</span>
            ))}
          </span>
          <span className="home-file-drop-hint">
            也可以直接粘贴截图 · 最多 100 个文件、总计 100 MB · 不上传
          </span>
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
      </div>
    </>
  )
}
