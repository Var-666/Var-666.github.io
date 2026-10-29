import { Component, lazy, Suspense, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'
import { recoverPreloadError } from '@/features/toolbox/lib/preload-recovery'
import { ToolPlaceholder } from '@/features/toolbox/components/ToolPlaceholder'

type Props = {
  load: () => Promise<{ default: ComponentType<{ active: boolean }> }>
  active: boolean
  title: string
}

// Each tool owns its failure state so a missing chunk cannot unmount other drafts.
export class ToolLoader extends Component<Props> {
  state = { failed: false, Tool: lazy(this.props.load) }

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
            <Button onClick={() => this.setState({ failed: false, Tool: lazy(this.props.load) })}>
              重试加载
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              刷新页面
            </Button>
            <a href="#/">返回全部工具</a>
          </div>
        </main>
      )
    }
    const Tool = this.state.Tool
    return (
      <Suspense fallback={<ToolPlaceholder label={`正在加载${this.props.title}`} />}>
        <Tool active={this.props.active} />
      </Suspense>
    )
  }
}
