import { Button } from '@/components/ui/button'

interface GlobalErrorBoundaryProps {
  error: unknown
  reset: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

function getErrorStack(error: unknown): string | null {
  if (error instanceof Error && error.stack) {
    return error.stack
  }

  try {
    return JSON.stringify(error, null, 2)
  } catch {
    return null
  }
}

export function GlobalErrorBoundary({
  error,
  reset,
}: GlobalErrorBoundaryProps): React.ReactElement {
  const isDev = process.env.NODE_ENV === 'development'
  const stack = getErrorStack(error)

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-lg">
        <p className="text-xs uppercase tracking-wider text-destructive">
          Application Error
        </p>
        <h1 className="mt-2 text-xl font-semibold text-foreground">
          Something went sideways.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {getErrorMessage(error)}
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button
            variant="outline"
            onClick={() => {
              window.location.reload()
            }}
          >
            Reload app
          </Button>
        </div>

        {isDev && stack && (
          <details className="mt-5 rounded-xl border border-border bg-muted p-3">
            <summary className="cursor-pointer text-sm text-foreground">
              Developer stack trace
            </summary>
            <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-destructive">
              {stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
