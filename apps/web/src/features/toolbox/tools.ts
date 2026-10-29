import { FileText, Files, FileStack, PencilLine, Table2 } from 'lucide-react'
export const tools = [
  {
    id: 'text',
    title: '文本整理',
    description: '清理、去重、PDF 断行修复、中文排版',
    icon: FileText,
    tags: ['文字', 'Markdown'],
  },
  {
    id: 'files',
    title: '文件格式转换',
    description: '图片、文本、表格与办公文档转换',
    icon: Files,
    tags: ['PNG / JPG / WebP', 'CSV / JSON', 'Word / PDF'],
  },
  {
    id: 'table',
    title: '表格工具',
    description: '比较差异、合并、连接与清洗 CSV / Excel 表格',
    icon: Table2,
    tags: ['表格对比', '合并 / 连接', '去重 / 筛选'],
  },
  {
    id: 'pdf',
    title: 'PDF 页面整理',
    description: '合并、提取、删除、旋转与页面排序',
    icon: FileStack,
    tags: ['保留页面图文', '按页整理'],
  },
  {
    id: 'rename',
    title: '批量重命名',
    description: '统一编号、替换文字、添加前后缀',
    icon: PencilLine,
    tags: ['实时预览', 'ZIP 下载'],
  },
]
