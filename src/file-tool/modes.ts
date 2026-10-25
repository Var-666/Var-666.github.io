// 文件转换的模式与类别元数据：标题、可接受的扩展名与界面提示文案
import { FileText, FileType2, Image, Table2 } from 'lucide-react'

export const modes = {
  image: {
    category: 'image',
    title: '图片互转',
    accept: '.png,.jpg,.jpeg,.webp',
    hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素',
    note: 'JPG 透明区域填充白色；动画只转换第一帧，导出不保留原始元数据。',
  },
  'image-pdf': {
    category: 'image',
    title: '图片 → PDF',
    accept: '.png,.jpg,.jpeg,.webp',
    hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素',
    note: '按队列顺序，每张图片一页，页面尺寸可选 A4 / A3 / Letter、纵向或横向，适配方式可选完整显示（留白）或填满页面（超出部分不可见）；透明背景填白，按 144 DPI 上限缩放并使用 JPG 编码。可拖动或用箭头排序。',
  },
  'image-compress': {
    category: 'image',
    title: '图片压缩',
    accept: '.png,.jpg,.jpeg,.webp',
    hint: 'PNG / JPG / WebP · 单张 20 MB，最多 2400 万像素',
    note: '指定目标大小（如 100 KB）：优先降低编码质量，仍超限时按比例缩小尺寸（最低到原图 25%）；无法达标时如实显示实际大小，不会假装成功。JPG 透明区域填白；输出为 JPG 或 WebP。',
  },
  markdown: {
    category: 'text',
    title: 'Markdown → TXT',
    accept: '.md,.markdown',
    hint: 'Markdown 文件 · 单个 2 MB · UTF-8 编码',
    note: '去除格式标记，保留正文、代码和链接。',
  },
  'csv-json': {
    category: 'table',
    title: 'CSV → JSON',
    accept: '.csv',
    hint: '逗号分隔 CSV · 单个 2 MB · UTF-8 编码',
    note: '第一行作为列名，空表头按「列N」、重复表头加序号后缀（与 Excel → JSON 一致）；单元格保留为字符串，避免丢失编号中的前导零。',
  },
  'json-csv': {
    category: 'table',
    title: 'JSON → CSV',
    accept: '.json',
    hint: 'JSON 文件 · 单个 2 MB · UTF-8 编码',
    note: '支持对象数组，不含嵌套字段。疑似表格公式的文本会添加单引号保护。',
  },
  'csv-markdown': {
    category: 'table',
    title: '表格 → Markdown',
    accept: '.csv,.tsv',
    hint: 'CSV / TSV · 单个 2 MB · UTF-8 编码',
    note: '首行作为表头；也可以粘贴从 Excel 复制的表格内容。',
  },
  'markdown-csv': {
    category: 'table',
    title: 'Markdown → CSV',
    accept: '.md,.markdown',
    hint: 'Markdown 文件 · 单个 2 MB · UTF-8 编码',
    note: '提取文档中的 Markdown 表格，多张表格打包为 ZIP；疑似公式添加单引号保护。',
  },
  'excel-csv': {
    category: 'table',
    title: 'Excel → CSV',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '按单元格显示值导出：保留文本单元格原值、数字格式渲染的前导零与日期显示形式；公式取缓存结果。CSV 含 BOM 并对疑似公式加保护。',
  },
  'excel-json': {
    category: 'table',
    title: 'Excel → JSON',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '第一行作为字段名，单元格保留显示文本；空表头按「列N」、重复表头加序号后缀，预览中会提示。不保留样式、公式与合并单元格。',
  },
  'excel-md': {
    category: 'table',
    title: 'Excel → Markdown',
    accept: '.xlsx',
    hint: 'XLSX 工作簿 · 单个 10 MB · 单表最多 10 万行 × 1024 列',
    note: '首行作为表头；竖线、换行等特殊字符安全转义，与表格 → Markdown 使用同一套规则。',
  },
  'csv-excel': {
    category: 'table',
    title: 'CSV → Excel',
    accept: '.csv',
    hint: '逗号分隔 CSV · 单个 2 MB · UTF-8 编码',
    note: '默认全部按文本写入 .xlsx，保留前导零与长编号；可开启「尝试识别数字」，只转换无前导零、非科学计数的明确数字。',
  },
  'pdf-image': {
    category: 'office',
    title: 'PDF → 图片',
    accept: '.pdf',
    hint: 'PDF · 单个 10 MB · 最多 50 页 · 144 DPI',
    note: '支持扫描件。多页图片打包为 ZIP；长图最多 2400 万像素、高度 16384 px，不支持加密 PDF。',
  },
  'word-pdf': {
    category: 'office',
    title: 'Word → PDF',
    accept: '.docx',
    hint: 'DOCX 文档 · 单个 10 MB · 最多输出 50 页',
    note: '在浏览器中渲染 Word 页面并生成图片型 A4 PDF：适合浏览与视觉交付，文字无法选择、复制或搜索；字体、分页与复杂排版可能变化，建议核对预览；不支持旧版 .doc。',
  },
  'pdf-word': {
    category: 'office',
    title: 'PDF → Word',
    accept: '.pdf',
    hint: '文字型 PDF · 单个 10 MB · 最多 50 页',
    note: '提取 PDF 中的文字生成可编辑 DOCX：不保留图片、表格、页眉页脚与原排版；扫描件无法提取文字（需要 OCR），加密与含无文字页的文件会被拒绝，避免遗漏内容。',
  },
} as const
export const categories = [
  { id: 'image', title: '图片', icon: Image },
  { id: 'text', title: '文本', icon: FileText },
  { id: 'table', title: '表格', icon: Table2 },
  { id: 'office', title: '办公文档', icon: FileType2 },
] as const
export type Mode = keyof typeof modes
export const modeKeys = Object.keys(modes) as Mode[]
