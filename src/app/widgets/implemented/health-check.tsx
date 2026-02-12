import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart'
import { Area, AreaChart, YAxis } from 'recharts'
import { SettingsError02Icon } from '@hugeicons/core-free-icons'
import {
  getHealthHistoryFn,
  startHealthPollingFn,
  stopHealthPollingFn,
  type HistoryResponse,
} from '@server/api/health'
import type { HealthStatus } from '@server/services/health'

export const healthCheckConfigSchema = z.object({
  name: z.string().min(1).default('My Service'),
  checkType: z.enum(['http', 'tcp']).default('http'),
  url: z.string().url().optional(),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS']).default('GET'),
  expectedStatus: z.union([z.number(), z.array(z.number())]).optional(),
  timeout: z.number().int().positive().default(10000),
  interval: z.number().int().positive().default(60000),
})

export type HealthCheckWidgetConfig = z.infer<typeof healthCheckConfigSchema>

const statusColors: Record<HealthStatus, string> = {
  healthy: 'text-green-400',
  degraded: 'text-yellow-400',
  unhealthy: 'text-red-400',
  unknown: 'text-gray-400',
}

const statusBgColors: Record<HealthStatus, string> = {
  healthy: 'bg-green-400/20',
  degraded: 'bg-yellow-400/20',
  unhealthy: 'bg-red-400/20',
  unknown: 'bg-gray-400/20',
}

export function HealthCheckWidget({
  id,
  config,
}: WidgetRenderProps<HealthCheckWidgetConfig>) {
  const [data, setData] = useState<HistoryResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollingRef = useRef(false)
  const intervalRef = useRef<number | null>(null)

  const hasValidConfig =
    (config.checkType === 'http' && config.url) ||
    (config.checkType === 'tcp' && config.host && config.port)

  useEffect(() => {
    if (!hasValidConfig) return

    const fetchData = async () => {
      try {
        const result = await getHealthHistoryFn({
          data: { widgetId: id, limit: 20 },
        })
        if (result.success && result.data) {
          setData(result.data)
          setError(null)
        }
      } catch {
        // Silently fail, will retry
      }
    }

    const startPolling = async () => {
      if (pollingRef.current) return
      pollingRef.current = true

      try {
        if (config.checkType === 'http' && config.url) {
          await startHealthPollingFn({
            data: {
              checkType: 'http',
              widgetId: id,
              url: config.url,
              method: config.method,
              expectedStatus: config.expectedStatus ?? [
                200, 201, 202, 204, 301, 302, 304,
              ],
              timeout: config.timeout,
              interval: config.interval,
            },
          })
        } else if (config.checkType === 'tcp' && config.host && config.port) {
          await startHealthPollingFn({
            data: {
              checkType: 'tcp',
              widgetId: id,
              host: config.host,
              port: config.port,
              timeout: config.timeout,
              interval: config.interval,
            },
          })
        }
      } catch {
        setError('Failed to start health monitoring')
      }
    }

    fetchData()
    startPolling()

    intervalRef.current = window.setInterval(fetchData, 5000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (pollingRef.current) {
        stopHealthPollingFn({ data: { widgetId: id } }).catch(() => {})
        pollingRef.current = false
      }
    }
  }, [id, config, hasValidConfig])

  const latest = data?.history[0]
  const status = latest?.status ?? 'unknown'
  const stats = data?.stats

  const chartData = (data?.history ?? [])
    .slice(0, 20)
    .reverse()
    .map((entry, index) => ({
      index,
      latency: entry.latencyMs ?? 0,
      status: entry.status,
    }))

  if (!hasValidConfig) {
    return (
      <GlassCard className="h-full p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon icon={SettingsError02Icon} size="xl" />
        <p className="text-sm text-center">Configure health check endpoint</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="h-full p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${statusBgColors[status]} ${statusColors[status].replace('text-', 'bg-')}`}
          />
          <span className="font-medium text-sm truncate">{config.name}</span>
        </div>
        <div
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusBgColors[status]} ${statusColors[status]}`}
        >
          {status.toUpperCase()}
        </div>
      </div>

      {latest && (
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground text-xs">Latency</span>
            <p className={`font-mono ${statusColors[status]}`}>
              {latest.latencyMs !== null ? `${latest.latencyMs}ms` : '—'}
            </p>
          </div>
          {latest.statusCode && (
            <div>
              <span className="text-muted-foreground text-xs">Status</span>
              <p className="font-mono">{latest.statusCode}</p>
            </div>
          )}
          {stats && (
            <div>
              <span className="text-muted-foreground text-xs">Uptime</span>
              <p className="font-mono">{stats.uptimePercent}%</p>
            </div>
          )}
          {stats?.avgLatency && (
            <div>
              <span className="text-muted-foreground text-xs">Avg</span>
              <p className="font-mono">{stats.avgLatency}ms</p>
            </div>
          )}
        </div>
      )}

      {chartData.length > 1 && (
        <div className="flex-1 min-h-0">
          <ChartContainer
            config={{
              latency: { label: 'Latency', color: 'hsl(var(--chart-1))' },
            }}
            className="h-full w-full"
          >
            <AreaChart
              data={chartData}
              margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            >
              <YAxis hide domain={[0, 'auto']} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => [`${value}ms`, 'Latency']}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="latency"
                stroke="hsl(var(--chart-1))"
                fill="hsl(var(--chart-1))"
                fillOpacity={0.2}
                strokeWidth={1.5}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      )}

      {(latest?.error || error) && (
        <p
          className="text-xs text-red-400 truncate"
          title={latest?.error ?? error ?? ''}
        >
          {latest?.error ?? error}
        </p>
      )}
    </GlassCard>
  )
}

export const healthCheckWidgetDefinition: Widget<typeof healthCheckWidgetConfigSchema> =
  {
    type: 'health-check',
    displayName: 'Health Check',
    description: 'Monitor the health and uptime of HTTP endpoints or TCP ports',
    icon: 'pulse',
    category: 'monitoring',
    configSchema: healthCheckConfigSchema,
    defaultConfig: {
      name: 'My Service',
      checkType: 'http',
      url: '',
      method: 'GET',
      timeout: 10000,
      interval: 60000,
    },
    defaultSize: { w: 2, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 4, h: 3 },
  }
