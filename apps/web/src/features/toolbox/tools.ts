import {
  ArrowRightLeft,
  Braces,
  CalendarClock,
  ClipboardList,
  Columns3,
  Combine,
  Crop,
  Eye,
  FileSpreadsheet,
  FileStack,
  FileText,
  Files,
  FileType,
  Filter,
  FolderDown,
  GitCompare,
  Image,
  ImagePlus,
  KeyRound,
  Languages,
  Layers,
  Link2,
  ListOrdered,
  Lock,
  Minimize2,
  PencilLine,
  Regex,
  RotateCw,
  ScanText,
  Scissors,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stamp,
  Table2,
  WifiOff,
  WrapText,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Tool = {
  id: string
  title: string
  tagline: string
  description: string
  icon: LucideIcon
  tags: string[]
  color: string
  gradient: string
  modes?: { route: string; label: string }[]
  features: { icon: LucideIcon; title: string; body: string }[]
  limits: string[]
}

export const tools: Tool[] = [
  {
    id: 'text',
    title: '文本整理',
    tagline: '乱糟糟的文字，一键理顺。',
    description: '清理、去重、PDF 断行修复、中文排版',
    icon: FileText,
    tags: ['文字', 'Markdown', '差异高亮'],
    color: '#30d158',
    gradient: 'linear-gradient(140deg, #5be37d, #00a68a)',
    features: [
      {
        icon: Sparkles,
        title: '日常清理',
        body: '空格、空行、重复行与名单去重，中文排版一键整理。',
      },
      {
        icon: WrapText,
        title: 'PDF 断行修复',
        body: '保守 / 标准两种模式，识别标题、编号、表格与代码。',
      },
      {
        icon: GitCompare,
        title: '差异高亮',
        body: '原文标出删除，结果标出新增，修改明细点击即定位。',
      },
      { icon: ScanText, title: '内容提取', body: '邮箱、手机号、网址、身份证，或自定义正则。' },
      { icon: Languages, title: '简繁转换', body: 'OpenCC 本地词典，简体、繁体与台湾常用词。' },
      { icon: Files, title: '批量文件', body: '一次最多 20 份 TXT / MD，统一规则，ZIP 打包。' },
    ],
    limits: [
      '单个 2 MB · 100 万字符',
      '对比合计 20 万字符',
      '最多 12 个预设',
      'UTF-8 · GBK · GB18030',
    ],
  },
  {
    id: 'files',
    title: '文件格式转换',
    tagline: '任何格式，原样转换。',
    description: '图片、文本、表格与办公文档转换',
    icon: Files,
    tags: ['PNG / JPG / WebP', 'CSV / JSON', 'Word / PDF'],
    color: '#0a84ff',
    gradient: 'linear-gradient(140deg, #40a9ff, #5e5ce6)',
    features: [
      { icon: Image, title: '图片互转', body: 'PNG、JPG、WebP、AVIF 与 HEIC，直接粘贴截图即可。' },
      {
        icon: Minimize2,
        title: '压缩到指定大小',
        body: '100 KB 至 1 MB；达不到时如实显示实际大小。',
      },
      { icon: Crop, title: '裁剪、旋转与水印', body: '按比例裁剪、精确缩放、斜向平铺文字水印。' },
      {
        icon: ImagePlus,
        title: '图片合成 PDF',
        body: 'A4 / A3 / Letter，拖动排序，每张图片一页。',
      },
      {
        icon: FileType,
        title: 'PDF ↔ 图片 / Word',
        body: '144 DPI 导出图片或长图；文字型 PDF 提取为 Word。',
      },
      {
        icon: Braces,
        title: '表格与数据',
        body: 'Excel、CSV、JSON、Markdown 互转，前导零原样保留。',
      },
    ],
    limits: [
      '图片单张 20 MB · 2400 万像素',
      '一次最多 10 个文件',
      '办公文档 10 MB · 50 页',
      '文本类 2 MB',
    ],
  },
  {
    id: 'table',
    title: '表格工具',
    tagline: '两张表，差异一眼看清。',
    description: '比较差异、合并、连接与清洗 CSV / Excel 表格',
    icon: Table2,
    tags: ['表格对比', '合并 / 连接', '去重 / 筛选'],
    color: '#ff9f0a',
    gradient: 'linear-gradient(140deg, #ffb340, #ff5e3a)',
    modes: [
      { route: 'table', label: '批量处理' },
      { route: 'compare', label: '表格对比' },
    ],
    features: [
      { icon: Combine, title: '追加与对齐', body: '同结构追加，或按列名并集对齐自动补空。' },
      { icon: Link2, title: '主键连接', body: '左 / 内 / 全连接，一对多时保留所有匹配。' },
      { icon: Filter, title: '去重与筛选', body: '关键列去重保留首条或末条，包含 / 排除筛选。' },
      {
        icon: Columns3,
        title: '列整理与拆分',
        body: '删列、改名、排序，按字段拆分为 ZIP 或多工作表。',
      },
      { icon: GitCompare, title: '表格对比', body: '单列或组合主键，新增、删除、修改逐列对照。' },
      {
        icon: FileSpreadsheet,
        title: '高亮报告',
        body: '红绿高亮 XLSX 或 CSV ZIP，编号一律按文本写入。',
      },
    ],
    limits: ['单个 10 MB · 最多 10 份', '合计 20 万行 · 100 万格', '最多拆分 1000 组'],
  },
  {
    id: 'pdf',
    title: 'PDF 页面整理',
    tagline: '每一页，都在掌控之中。',
    description: '合并、提取、删除、旋转与页面排序',
    icon: FileStack,
    tags: ['保留页面图文', '按页整理'],
    color: '#ff375f',
    gradient: 'linear-gradient(140deg, #ff6482, #bf5af2)',
    features: [
      { icon: Layers, title: '合并与排序', body: '拖动或箭头排序，保留原有图文与页面尺寸。' },
      {
        icon: RotateCw,
        title: '提取、删除、旋转',
        body: '缩略图逐页操作，可整页放大到 400% 核对。',
      },
      {
        icon: ImagePlus,
        title: '插入图片与空白页',
        body: '图片直接转成一页，可重复添加 A4 空白页。',
      },
      { icon: Stamp, title: '页码与水印', body: '按选中顺序连续编号，中文文字水印。' },
      {
        icon: Scissors,
        title: '拆分与压缩',
        body: '每页 / 每 N 页 / 自定义范围；结构压缩不降画质。',
      },
      { icon: KeyRound, title: '已知密码解密', body: '本地解密，不猜测、不保存密码。' },
    ],
    limits: ['最多 10 个文件 · 单个 20 MB', '列表最多 100 页', '输出最多 100 MB'],
  },
  {
    id: 'rename',
    title: '批量重命名',
    tagline: '一百个文件，一次命名。',
    description: '统一编号、替换文字、添加前后缀',
    icon: PencilLine,
    tags: ['实时预览', 'ZIP 下载'],
    color: '#bf5af2',
    gradient: 'linear-gradient(140deg, #d17bff, #5e5ce6)',
    features: [
      {
        icon: ListOrdered,
        title: '四种快速模式',
        body: '编号、替换、前后缀、统一名称，可组合使用。',
      },
      { icon: Regex, title: '正则替换', body: '支持捕获组，独立线程预览，超时自动终止。' },
      { icon: CalendarClock, title: '按日期命名', body: '文件修改时间，或照片 EXIF 拍摄时间。' },
      { icon: ClipboardList, title: '名称清单导入', body: '每行一个名称，导入后仍可逐项微调。' },
      { icon: ShieldAlert, title: '冲突拦截', body: '重名、非法字符、系统保留名，导出前就拦下。' },
      { icon: FolderDown, title: 'ZIP 或存到文件夹', body: '内容与原文件完全相同，原文件不动。' },
    ],
    limits: ['最多 100 个文件', '总计 100 MB', '任意文件格式'],
  },
]

export const PROMISES: { icon: LucideIcon; title: string; body: string; color: string }[] = [
  {
    icon: Lock,
    title: '本地处理，不上传',
    body: '文件只在当前标签页内存中，刷新或关闭即清空。',
    color: '#0a84ff',
  },
  {
    icon: WifiOff,
    title: '断网也能用',
    body: '首次准备约 12 MB 缓存，之后全部工具离线可开。',
    color: '#30d158',
  },
  {
    icon: Eye,
    title: '下载前先预览',
    body: '图片、PDF、表格结果都可先核对，再决定下载。',
    color: '#ff9f0a',
  },
  {
    icon: ArrowRightLeft,
    title: '工具间继续处理',
    body: '图片合成 PDF、Excel 转 CSV 后再对比，一气呵成。',
    color: '#bf5af2',
  },
  {
    icon: Share2,
    title: '分享或存到文件夹',
    body: '支持系统分享；Chromium 可直接写入本地目录。',
    color: '#ff375f',
  },
  {
    icon: ShieldCheck,
    title: '诚实可靠',
    body: '做不到的明说，失败保留原文件，不假装成功。',
    color: '#64d2ff',
  },
]
