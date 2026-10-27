import { Component, lazy, Suspense, type ComponentType } from 'react'
import { Button } from '@/components/ui/button'

type Props = {
  load: () => Promise<{ default: ComponentType<{ active: boolean }> }>
  active: boolean
  title: string
  loading: string
}

// Each tool owns its failure state so a missing chunk cannot unmount other drafts.
export class ToolLoader extends Component<Props> {
  state = { failed: false, Tool: lazy(this.props.load) }

  static getDerivedStateFromError() {
    return { failed: true }
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
      <Suspense fallback={<main className="main-content">{this.props.loading}</main>}>
        <Tool active={this.props.active} />
      </Suspense>
    )
  }
}
