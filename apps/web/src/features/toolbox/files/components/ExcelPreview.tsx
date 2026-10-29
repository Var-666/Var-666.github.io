// Excel / CSV 数据预览面板：工作表选择、行列表格与保真提示
import { useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  isSafeNumberText,
  jsonHeaderNotices,
  sheetNotices,
} from '@/features/toolbox/files/file-excel'
import type { WorkbookData } from '@/features/toolbox/files/file-excel'
import { cn } from '@/lib/utils'
import { sizeLabel } from '../types'

export type ExcelReadMode = 'excel-csv' | 'excel-json' | 'excel-md'

export function ExcelPreview({
  excel,
  sheetName,
  onSheetChange,
  mode,
  disabled,
}: {
  excel: { file: File; workbook: WorkbookData }
  sheetName: string
  onSheetChange: (name: string) => void
  mode: ExcelReadMode
  disabled: boolean
}) {
  // 选中的工作表在渲染时物化（工作簿内部有缓存，同一工作表只解析一次）
  const preview = useMemo(() => {
    if (!sheetName) return null
    try {
      const data = excel.workbook.sheet(sheetName)
      const notices = [...sheetNotices(data)]
      if (mode === 'excel-json') notices.push(...jsonHeaderNotices(data.rows[0] ?? []))
      return { data, notices }
    } catch (error) {
      return { error: error instanceof Error ? error.message : '无法读取工作表', notices: [] }
    }
  }, [excel, sheetName, mode])
  return (
    <div className="excel-panel">
      <div className="excel-panel-head">
        <label className="excel-sheet-select">
          工作表
          <Select value={sheetName} disabled={disabled} onValueChange={onSheetChange}>
            <SelectTrigger aria-label="选择工作表">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {excel.workbook.sheets.map((sheet) => (
                <SelectItem key={sheet.name} value={sheet.name}>
                  {sheet.name}（{sheet.rows} 行 × {sheet.cols} 列）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <span className="excel-sheet-info">
          {excel.file.name} · {sizeLabel(excel.file.size)} →{' '}
          {mode === 'excel-csv' ? 'CSV' : mode === 'excel-json' ? 'JSON' : 'Markdown 表格'}
        </span>
      </div>
      {preview?.error ? (
        <p className="excel-error" role="alert">
          {preview.error}
        </p>
      ) : preview?.data ? (
        <MatrixPreview rows={preview.data.rows} notices={preview.notices} />
      ) : null}
    </div>
  )
}

export function CsvExcelPreview({
  file,
  rows,
  notices,
  detectNumbers,
}: {
  file: File
  rows: string[][]
  notices: string[]
  detectNumbers: boolean
}) {
  return (
    <div className="excel-panel">
      <div className="excel-panel-head">
        <strong>预览：{file.name}</strong>
        <span>{detectNumbers ? '识别出的数字将按数值写入，其余为文本' : '全部按文本写入'}</span>
      </div>
      <MatrixPreview rows={rows} notices={notices} markNumbers={detectNumbers} />
    </div>
  )
}

// 数据预览：仅渲染有限行与列，避免大表生成海量 DOM
function MatrixPreview({
  rows,
  notices,
  markNumbers = false,
}: {
  rows: string[][]
  notices: string[]
  markNumbers?: boolean
}) {
  if (!rows.length) return <p className="excel-error">没有可读取的数据。</p>
  const shown = rows.slice(0, 21)
  const totalCols = rows[0]?.length ?? 0
  return (
    <div className="excel-preview">
      <div className="matrix-scroll">
        <div className="matrix-table" role="table" aria-label="数据预览（前 20 行）">
          {shown.map((row, index) => (
            <div className={cn('matrix-row', index === 0 && 'matrix-head')} role="row" key={index}>
              {row.slice(0, 50).map((cell, col) => (
                <span
                  className={cn(
                    'matrix-cell',
                    markNumbers && index > 0 && isSafeNumberText(cell) && 'is-number',
                  )}
                  role="cell"
                  key={col}
                  title={cell || undefined}
                >
                  {cell}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="matrix-meta">
        共 {rows.length.toLocaleString()} 行 × {totalCols} 列
        {rows.length > 20 ? ' · 预览前 20 行' : ''}
        {totalCols > 50 ? ' · 仅显示前 50 列' : ''} · 首行样式仅便于阅读
      </div>
      {notices.map((notice) => (
        <p className="matrix-notice" key={notice}>
          {notice}
        </p>
      ))}
    </div>
  )
}
