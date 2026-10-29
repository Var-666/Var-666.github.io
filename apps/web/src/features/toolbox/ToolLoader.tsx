import { PureComponent, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { recoverPreloadError } from '@/features/toolbox/lib/preload-recovery'
import { ToolPlaceholder } from '@/features/toolbox/components/ToolPlaceholder'

type Props = {
  load: () => Promise<{ default: ComponentType<{ active: boolean }> }>
  active: boolean
  title: string
}

// Each tool owns its failure state so a missing chunk cannot unmount other drafts.
export class ToolLoader extends PureComponent<Props> {
  state: { failed: boolean; Tool: ComponentType<{ active: boolean }> | null } = {
    failed: false,
    Tool: null,
  }
  private mounted = false

  componentDidMount() {
    this.mounted = true
    void this.loadTool()
  }

  componentWillUnmount() {
    this.mounted = false
  }

  // Reveal a ready module immediately, without Suspense's fallback reveal delay.
  loadTool = async () => {
    this.setState({ failed: false, Tool: null })
    try {
      const { default: Tool } = await this.props.load()
      if (this.mounted) this.setState({ failed: false, Tool })
    } catch (error) {
      if (!this.mounted) return
      this.setState({ failed: true })
      recoverPreloadError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    recoverPreloadError(error)
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="main-content tool-load-error" role="alert">
          <h1>{this.props.title}加载失败</h1>
          <p>请检查网络后重试。刷新页面会清空尚未下载的内容。</p>
          <div>
            <Button onClick={this.loadTool}>重试加载</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <a href="#/">返回全部工具</a>
          </div>
        </main>
      )
    }
    const Tool = this.state.Tool
    return Tool ? (
      <Tool active={this.props.active} />
    ) : (
      <ToolPlaceholder label={`正在加载${this.props.title}`} />
    )
  }
}
