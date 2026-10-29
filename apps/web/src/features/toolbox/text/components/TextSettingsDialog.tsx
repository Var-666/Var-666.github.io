import { Check, RotateCcw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { presets, type Options, type Preset } from '@/features/toolbox/text/text'
import type { StoredUserPreset } from '@/features/toolbox/lib/storage'

function Rule({
  title,
  description,
  checked,
  onChange,
  id,
}: {
  title: string
  description?: string
  checked: boolean
  onChange: (checked: boolean) => void
  id: string
}) {
  return (
    <div className="rule">
      <label htmlFor={id}>
        <span>{title}</span>
        {description && <small>{description}</small>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}
export function TextSettingsDialog({
  advancedOpen,
  setAdvancedOpen,
  preset,
  options,
  update,
  presetName,
  setPresetName,
  userPresets,
  saveCurrentUserPreset,
  applyUserPreset,
  removeUserPreset,
  choosePreset,
}: {
  advancedOpen: boolean
  setAdvancedOpen: (open: boolean) => void
  preset: Preset
  options: Options
  update: <K extends keyof Options>(key: K, value: Options[K]) => void
  presetName: string
  setPresetName: (value: string) => void
  userPresets: StoredUserPreset[]
  saveCurrentUserPreset: () => void
  applyUserPreset: (preset: StoredUserPreset) => void
  removeUserPreset: (id: string) => void
  choosePreset: (preset: Preset) => void
}) {
  const rule = (key: keyof Options, title: string, description?: string) => (
    <Rule
      key={key}
      id={`option-${key}`}
      title={title}
      description={description}
      checked={!!options[key]}
      onChange={(value) => update(key, value as never)}
    />
  )
  const blankSelect = (
    <div className="rule">
      <label htmlFor="blank-lines">
        空白行处理<small>按需要保留段落之间的留白</small>
      </label>
      <Select
        value={options.blankLines}
        onValueChange={(value) => update('blankLines', value as Options['blankLines'])}
      >
        <SelectTrigger id="blank-lines" className="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="keep">全部保留</SelectItem>
          <SelectItem value="single">最多留一行</SelectItem>
          <SelectItem value="remove">全部删除</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
  return (
    <Dialog open={advancedOpen} onOpenChange={setAdvancedOpen}>
      <DialogContent className="settings-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 size={18} />
            整理设置
          </DialogTitle>
          <DialogDescription>
            当前场景：{presets[preset].title}。所有规则都从原文重新处理。
          </DialogDescription>
        </DialogHeader>
        <div className="settings-scroll">
          <div className="settings-section">
            <span className="settings-label">空格与空行</span>
            {rule('trimLines', '清理行首行尾空格', '移除每行两端的空格和制表符')}
            {rule('collapseSpaces', '合并连续空格', '将多个空格或制表符合并成一个空格')}
            {blankSelect}
          </div>
          <Accordion type="multiple" defaultValue={['scene']}>
            <AccordionItem value="scene">
              <AccordionTrigger>场景规则</AccordionTrigger>
              <AccordionContent>
                {rule(
                  'markdownPlain',
                  'Markdown 转纯文本',
                  '保留正文、代码和链接；表格转成制表符分隔的文本',
                )}
                {rule(
                  'repairBreaks',
                  '修复 PDF 断行',
                  '规则推测连接断句；尽量保留段落、列表与链接',
                )}
                <div className="rule">
                  <label htmlFor="repair-mode">
                    断行修复模式
                    <small>保守尽量保留原结构，标准更积极合并软换行</small>
                  </label>
                  <Select
                    value={options.repairMode}
                    onValueChange={(value) => update('repairMode', value as Options['repairMode'])}
                  >
                    <SelectTrigger id="repair-mode" className="w-[130px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conservative">保守修复</SelectItem>
                      <SelectItem value="standard">标准修复</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {rule('dedupe', '删除重复行', '保留第一次出现的行与原有顺序')}
                {rule('ignoreWhitespace', '去重时忽略首尾空格')}
                {rule('ignoreCase', '去重时忽略英文大小写')}
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="typography">
              <AccordionTrigger>中文排版</AccordionTrigger>
              <AccordionContent>
                {rule('fullwidth', '全角字符转半角', '转换全角英文字母、数字、符号与空格')}
                {rule('cjkSpacing', '调整中英文间距', '在汉字与英文字母、数字之间补一个空格')}
                {rule(
                  'chinesePunctuation',
                  '转换中文标点',
                  '含中文的片段中转换逗号、冒号等，保护链接与小数',
                )}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="user-preset-manager">
            <h3>自定义预设</h3>
            <div className="user-preset-save">
              <input
                aria-label="预设名称"
                placeholder="预设名称，如：日报清理"
                maxLength={30}
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
              />
              <Button variant="outline" size="sm" onClick={saveCurrentUserPreset}>
                保存当前规则
              </Button>
            </div>
            {userPresets.map((entry) => (
              <div className="user-preset-row" key={entry.id}>
                <span>{entry.name}</span>
                <div>
                  <Button variant="outline" size="sm" onClick={() => applyUserPreset(entry)}>
                    应用
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`删除自定义预设 ${entry.name}`}
                    onClick={() => {
                      removeUserPreset(entry.id)
                      toast.success(`已删除「${entry.name}」`)
                    }}
                  >
                    删除
                  </Button>
                </div>
              </div>
            ))}
            {!userPresets.length && (
              <p className="user-preset-empty">
                把当前场景与规则组合保存为预设，之后一键应用（只保存规则，不保存正文）。
              </p>
            )}
          </div>
        </div>
        <div className="dialog-footer">
          <Button
            variant="outline"
            onClick={() => {
              choosePreset(preset)
              toast.success('已恢复当前场景的默认规则')
            }}
          >
            <RotateCcw size={14} />
            恢复默认
          </Button>
          <Button onClick={() => setAdvancedOpen(false)}>
            完成
            <Check size={14} />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
