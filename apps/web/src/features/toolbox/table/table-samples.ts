/**
 * 「载入示例」数据：移植自设计源 TableTool 的 SAMPLE_JAN / SAMPLE_FEB / SAMPLE_OLD / SAMPLE_NEW
 * 常量（Redesign Personal Portfolio Website src/tools/TableTool.tsx）。
 * 设计源里是已解析的 Table 对象；本项目导入走现有校验/读取管线，
 * 因此包装成 File 交给 addFiles / loadFile，不绕过任何现有逻辑。
 */

const sampleCsv = (name: string, text: string) => new File([text], name, { type: 'text/csv' })

/** 设计源 SAMPLE_JAN：订单-一月 */
const SAMPLE_JAN_CSV = [
  '订单号,客户,城市,金额',
  '000123,张三,上海,1280',
  '000124,李四,北京,960',
  '000125,王五,上海,730',
  '000126,赵六,广州,510',
].join('\n')

/** 设计源 SAMPLE_FEB：订单-二月（与一月有重复订单号 000124，适合演示去重） */
const SAMPLE_FEB_CSV = [
  '订单号,客户,城市,金额',
  '000127,钱七,北京,2200',
  '000124,李四,北京,960',
  '000128,孙八,深圳,1500',
].join('\n')

/** 设计源 SAMPLE_OLD：员工-上月 */
const SAMPLE_OLD_CSV = [
  '工号,姓名,部门,城市',
  'A1019,赵六,市场,广州',
  'A1024,张三,研发,上海',
  'A1025,李四,设计,北京',
  'A1027,周九,研发,杭州',
].join('\n')

/** 设计源 SAMPLE_NEW：员工-本月（与上月有新增/删除/修改） */
const SAMPLE_NEW_CSV = [
  '工号,姓名,部门,城市',
  'A1024,张三,研发,上海',
  'A1025,李四,产品,北京',
  'A1026,王五,研发,深圳',
  'A1027,周九,研发,成都',
].join('\n')

/** 批量处理模式示例：两份同结构订单表 */
export function sampleBatchFiles(): File[] {
  return [sampleCsv('订单-一月.csv', SAMPLE_JAN_CSV), sampleCsv('订单-二月.csv', SAMPLE_FEB_CSV)]
}

/** 表格对比模式示例：旧表与新表（第一个元素给旧表，第二个给新表） */
export function sampleCompareFiles(): [File, File] {
  return [sampleCsv('员工-上月.csv', SAMPLE_OLD_CSV), sampleCsv('员工-本月.csv', SAMPLE_NEW_CSV)]
}
