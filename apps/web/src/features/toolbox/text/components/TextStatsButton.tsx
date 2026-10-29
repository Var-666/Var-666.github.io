import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { detailedTextStats } from '@/features/toolbox/text/text-statistics'

export function TextStatsButton({
  text,
  stats,
  label,
}: {
  text: string
  stats: { chars: number; lines: number }
  label: string
}) {
  const [open, setOpen] = useState(false)
  const details = useMemo(() => (open ? detailedTextStats(text) : null), [open, text])
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-stats-button"
          onClick={(event) => event.currentTarget.focus({ preventScroll: true })}
          aria-label={`${label}详细统计 ${stats.chars.toLocaleString()} 字符 ${stats.lines.toLocaleString()} 行`}
        >
          <b>{stats.chars.toLocaleString()}</b> 字符
          <span className="stat-divider" /> <b>{stats.lines.toLocaleString()}</b> 行{' '}
          <ChevronDown size={11} aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="text-stats-dialog">
        <DialogHeader>
          <DialogTitle>{label}详细统计</DialogTitle>
          <DialogDescription>按当前文本统计；英文连字符与撇号词按一个单词计算。</DialogDescription>
        </DialogHeader>
        {details && (
          <dl className="text-stats-grid">
            {(
              [
                ['全部字符', details.characters],
                ['不含空白', details.nonSpace],
                ['汉字', details.chinese],
                ['英文单词', details.words],
                ['标点', details.punctuation],
                ['段落', details.paragraphs],
                ['行数', stats.lines],
                ['预计阅读', `${details.readingMinutes} 分钟`],
              ] as const
            ).map(([name, value]) => (
              <div key={name}>
                <dt>{name}</dt>
                <dd>{typeof value === 'number' ? value.toLocaleString() : value}</dd>
              </div>
            ))}
          </dl>
        )}
        <p className="text-ops-meta">空白行分段；阅读时长按每分钟 300 汉字 / 200 英文单词估算。</p>
      </DialogContent>
    </Dialog>
  )
}
