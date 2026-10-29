export function ToolPlaceholder({ label }: { label: string }) {
  return (
    <main
      className="main-content tool-placeholder"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <div className="tool-placeholder-shapes" aria-hidden="true">
        <div className="tool-placeholder-title" />
        <div className="tool-placeholder-panel" />
      </div>
    </main>
  )
}
