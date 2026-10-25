// 首页搜索与任务式入口：按名称、功能与常见任务关键词匹配；
// 任务入口只指向已上线的能力，未上线的功能不提前露出。

export type ToolInfo = { id: string; title: string; description: string; keywords: string[] }
export type TaskEntry = {
  id: string
  title: string
  toolId: string
  hash: string
  keywords: string[]
}

export const homeTasks: TaskEntry[] = [
  {
    id: 'compress-image',
    title: '压缩图片到指定大小',
    toolId: 'files',
    hash: '#/files?mode=image-compress',
    keywords: ['压缩', '体积', 'KB', '目标大小', '缩图'],
  },
  {
    id: 'excel-csv',
    title: 'Excel 转 CSV',
    toolId: 'files',
    hash: '#/files?mode=excel-csv',
    keywords: ['xlsx', '表格', '工作簿', '导出'],
  },
  {
    id: 'csv-json',
    title: 'CSV 转 JSON',
    toolId: 'files',
    hash: '#/files?mode=csv-json',
    keywords: ['表格', '数据', '字段'],
  },
  {
    id: 'word-pdf',
    title: 'Word 转 PDF',
    toolId: 'files',
    hash: '#/files?mode=word-pdf',
    keywords: ['docx', '文档', '办公'],
  },
  {
    id: 'image-pdf',
    title: '多张图片合成 PDF',
    toolId: 'files',
    hash: '#/files?mode=image-pdf',
    keywords: ['合并', '图片', '扫描'],
  },
  {
    id: 'merge-csv',
    title: '合并 / 拆分多份 CSV',
    toolId: 'table',
    hash: '#/table',
    keywords: ['合并', '拆分', '去重', '清洗'],
  },
  {
    id: 'compare-tables',
    title: '比较两份表格差异',
    toolId: 'compare',
    hash: '#/compare',
    keywords: ['对比', '比较', '差异', '核对', '表格', '主键'],
  },
  {
    id: 'pdf-organize',
    title: 'PDF 提取 / 合并页面',
    toolId: 'pdf',
    hash: '#/pdf',
    keywords: ['合并', '拆分', '提取', '删除', '旋转', '排序', '页面'],
  },
  {
    id: 'text-cleanup',
    title: '整理 PDF 复制的文本',
    toolId: 'text',
    hash: '#/text',
    keywords: ['断行', '清理', '空格', '去重', '排版'],
  },
  {
    id: 'batch-rename',
    title: '批量修改文件名',
    toolId: 'rename',
    hash: '#/rename',
    keywords: ['文件名', '改名', '编号', '前缀'],
  },
]

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')

export function searchHome<T extends ToolInfo>(
  query: string,
  tools: T[],
  tasks: TaskEntry[] = homeTasks,
): { tools: T[]; tasks: TaskEntry[] } {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (!terms.length) return { tools, tasks }
  // 多个关键词按空格切分后须全部命中（AND），命中的字段可以不同
  const hit = (...fields: string[]) => {
    const haystack = normalize(fields.join(' '))
    return terms.every((term) => haystack.includes(term))
  }
  return {
    tools: tools.filter((tool) => hit(tool.title, tool.description, ...tool.keywords)),
    tasks: tasks.filter((task) => hit(task.title, ...task.keywords)),
  }
}
