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
      <div className="flex items-center justify-between border-b border-white/10 p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-amber-400">
            Debug Mode
          </span>
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
            <h4 className="mb-1 font-medium text-slate-400">Dashboard</h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500">ID:</span>
              <code className="truncate font-mono text-slate-300">
                {dashboardId}
              </code>
              <span className="text-slate-500">Name:</span>
              <span className="text-slate-300">{dashboardName}</span>
              <span className="text-slate-500">Pages:</span>
              <span className="text-slate-300">{pageCount}</span>
              <span className="text-slate-500">Widgets:</span>
              <span className="text-slate-300">{widgetCount}</span>
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-slate-400">Performance</h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500">Page Load:</span>
              <span className="text-slate-300">
                {formatMs(debugInfo.pageLoadTime)}
              </span>
              {debugInfo.memoryUsage && (
                <>
                  <span className="text-slate-500">Memory:</span>
                  <span className="text-slate-300">
                    {formatBytes(debugInfo.memoryUsage.usedJSHeapSize)} /{' '}
                    {formatBytes(debugInfo.memoryUsage.jsHeapSizeLimit)}
                  </span>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-slate-400">WebSocket</h4>
            <div className="grid grid-cols-2 gap-1">
              <span className="text-slate-500">Status:</span>
              <div className="flex items-center gap-1">
                <span
                  className={`inline-block h-2 w-2 rounded-full ${
                    debugInfo.wsConnected ? 'bg-green-400' : 'bg-red-400'
                  }`}
                />
                <span className="text-slate-300">
                  {debugInfo.wsConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              {debugInfo.wsLatency !== null && (
                <>
                  <span className="text-slate-500">Latency:</span>
                  <span className="text-slate-300">
                    {debugInfo.wsLatency.toFixed(0)}ms
                  </span>
                </>
              )}
              {debugInfo.realtimeClientId && (
                <>
                  <span className="text-slate-500">Client ID:</span>
                  <code className="truncate font-mono text-slate-300">
                    {debugInfo.realtimeClientId.slice(0, 8)}...
                  </code>
                </>
              )}
            </div>
          </section>

          <section>
            <h4 className="mb-1 font-medium text-slate-400">
              Widgets ({debugInfo.widgets.size})
            </h4>
            <div className="max-h-32 overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 bg-slate-900/90">
                  <tr className="text-left text-slate-500">
                    <th className="pr-2">Type</th>
                    <th className="pr-2">ID</th>
                    <th className="pr-2">Config</th>
                    <th>Vis</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(debugInfo.widgets.values()).map((widget) => (
                    <tr key={widget.id} className="text-slate-300">
                      <td className="pr-2 font-mono text-xs">
                        {widget.type.slice(0, 12)}
                      </td>
                      <td className="pr-2 font-mono text-xs text-slate-500">
                        {widget.id.slice(0, 6)}...
                      </td>
                      <td className="pr-2 text-xs">
                        {formatBytes(widget.configSize)}
                      </td>
                      <td>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            widget.isVisible ? 'bg-green-400' : 'bg-slate-600'
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
