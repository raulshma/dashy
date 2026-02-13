/**
 * Debug Panel Component
 *
 * Displays debug information for dashboard development.
 * Shown when ?debug=true is present in the URL.
 */
import { useState } from 'react'
import type { DebugInfo } from '@/hooks/use-debug-mode'
import { formatBytes, formatMs } from '@/hooks/use-debug-mode'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'

interface DebugPanelProps {
  debugInfo: DebugInfo
  dashboardId: string
  dashboardName: string
  pageCount: number
  widgetCount: number
}

export function DebugPanel({
  debugInfo,
  dashboardId,
  dashboardName,
  pageCount,
  widgetCount,
}: DebugPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!debugInfo.enabled) return null

  return (
    <GlassCard className="fixed bottom-4 right-4 z-50 max-w-md overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-warning">Debug Mode</span>
          <Badge variant="outline" className="text-xs">
            Active
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 px-2 text-xs"
        >
          {isExpanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {isExpanded && (
        <div className="space-y-3 p-3 text-xs">
          <section>
            <h4 className="mb-1 font-medium text-muted-foreground">
              Dashboard
            </h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">ID:</span>
              <code className="truncate font-mono text-foreground">
                {dashboardId}
              </code>
              <span className="text-muted-foreground">Name:</span>
              <span className="text-foreground">{dashboardName}</span>
              <span className="text-muted-foreground">Pages:</span>
              <span className="text-foreground">{pageCount}</span>
              <span className="text-muted-foreground">Widgets:</span>
              <span className="text-foreground">{widgetCount}</span>
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-muted-foreground">
              Performance
            </h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Page Load:</span>
              <span className="text-foreground">
                {formatMs(debugInfo.pageLoadTime)}
              </span>
              {debugInfo.memoryUsage && (
                <>
                  <span className="text-muted-foreground">Memory:</span>
                  <span className="text-foreground">
                    {formatBytes(debugInfo.memoryUsage.usedJSHeapSize)} /{' '}
                    {formatBytes(debugInfo.memoryUsage.jsHeapSizeLimit)}
                  </span>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-muted-foreground">
              WebSocket
            </h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-muted-foreground">Status:</span>
              <div className="flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    debugInfo.wsConnected ? 'bg-success' : 'bg-destructive'
                  }`}
                />
                <span className="text-foreground">
                  {debugInfo.wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {debugInfo.wsLatency !== null && (
                <>
                  <span className="text-muted-foreground">Latency:</span>
                  <span className="text-foreground">
                    {debugInfo.wsLatency.toFixed(0)}ms
                  </span>
                </>
              )}
              {debugInfo.realtimeClientId && (
                <>
                  <span className="text-muted-foreground">Client ID:</span>
                  <code className="truncate font-mono text-foreground">
                    {debugInfo.realtimeClientId.slice(0, 8)}...
                  </code>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-muted-foreground">
              Widgets ({debugInfo.widgets.size})
            </h4>
            <div className="max-h-32 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-muted/90">
                  <tr className="text-left text-muted-foreground">
                    <th className="pr-2">Type</th>
                    <th className="pr-2">ID</th>
                    <th className="pr-2">Config</th>
                    <th>Vis</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(debugInfo.widgets.values()).map((widget) => (
                    <tr key={widget.id} className="text-foreground">
                      <td className="pr-2 font-mono text-xs">
                        {widget.type.slice(0, 12)}
                      </td>
                      <td className="pr-2 font-mono text-xs text-muted-foreground">
                        {widget.id.slice(0, 6)}...
                      </td>
                      <td className="pr-2 text-xs">
                        {formatBytes(widget.configSize)}
                      </td>
                      <td>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            widget.isVisible
                              ? 'bg-success'
                              : 'bg-muted-foreground'
                          }`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </GlassCard>
  )
}
