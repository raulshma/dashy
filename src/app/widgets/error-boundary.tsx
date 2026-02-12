/**
 * Widget Error Boundary — Catches render errors in widgets and shows fallback UI.
 */
import { Component } from 'react'
import { Alert02Icon, RefreshIcon } from '@hugeicons/core-free-icons'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'

interface WidgetErrorBoundaryProps {
  children: React.ReactNode
  widgetId: string
  widgetType: string
  onRetry?: () => void
}

interface WidgetErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class WidgetErrorBoundary extends Component<
  WidgetErrorBoundaryProps,
  WidgetErrorBoundaryState
> {
  constructor(props: WidgetErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<WidgetErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ errorInfo })
    console.error(
      `[WidgetErrorBoundary] Widget "${this.props.widgetType}" (${this.props.widgetId}) crashed:`,
      error,
      errorInfo,
    )
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    this.props.onRetry?.()
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <GlassCard variant="solid" className="h-full p-4">
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="rounded-full bg-red-500/10 p-3">
              <Icon icon={Alert02Icon} size="lg" className="text-red-400" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Widget Error</p>
              <p className="text-xs text-white/60">
                {this.props.widgetType} encountered an error
              </p>
            </div>
            <Button
              variant="glass"
              size="sm"
              onClick={this.handleRetry}
              className="mt-2"
            >
              <Icon icon={RefreshIcon} size="sm" />
              Retry
            </Button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-2 w-full text-left">
                <summary className="cursor-pointer text-xs text-white/40 hover:text-white/60">
                  Error details
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-black/20 p-2 text-[10px] text-red-300/80">
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
          </div>
        </GlassCard>
      )
    }

    return this.props.children
  }
}
