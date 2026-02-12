import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'
import {
  Globe02Icon,
  Loading03Icon,
  RefreshIcon,
  SettingsError02Icon,
} from '@hugeicons/core-free-icons'
import { fetchApiDataFn } from '@server/api/api-fetch'
import type { ApiFetchDataResponse } from '@server/api/api-fetch'

const apiMethodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

export const apiFetchWidgetConfigSchema = z
  .object({
    url: z.string().url(),
    method: apiMethodSchema.default('GET'),
    headers: z.record(z.string(), z.string()).default({}),
    body: z.string().default(''),
    timeoutMs: z.number().int().min(1000).max(20000).default(10000),
    refreshInterval: z.number().int().min(0).max(3600000).default(0),
    maxResponseBytes: z.number().int().min(1024).max(1024 * 1024).default(65536),
    allowInsecureHttp: z.boolean().default(false),
    allowPrivateNetworks: z.boolean().default(false),
    showHeaders: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if ((value.method === 'GET' || value.method === 'HEAD') && value.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: `${value.method} requests should not include a request body`,
      })
    }
  })

export type ApiFetchWidgetConfig = z.infer<typeof apiFetchWidgetConfigSchema>

type ApiFetchResult = ApiFetchDataResponse['result']

function formatBody(response: ApiFetchResult | null): string {
  if (!response) return ''
  return response.bodyText
}

function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const cleaned: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (key.trim() && value.trim()) {
      cleaned[key.trim()] = value.trim()
    }
  }
  return cleaned
}

export function ApiFetchWidget({
  config,
}: WidgetRenderProps<ApiFetchWidgetConfig>): React.ReactElement {
  const [result, setResult] = useState<ApiFetchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)

  const hasBody = config.method !== 'GET' && config.method !== 'HEAD'

  const fetchData = async () => {
    if (!config.url) {
      setError('Configure an API URL to begin')
      return
    }

    setLoading(true)

    try {
      const response = await fetchApiDataFn({
        data: {
          url: config.url,
          method: config.method,
          headers: sanitizeHeaders(config.headers),
          body: hasBody ? config.body : undefined,
          timeoutMs: config.timeoutMs,
          maxResponseBytes: config.maxResponseBytes,
          allowInsecureHttp: config.allowInsecureHttp,
          allowPrivateNetworks: config.allowPrivateNetworks,
        },
      })

      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'Failed to fetch API data')
        return
      }

      setResult(response.data.result)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown API fetch error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!config.url) {
      setResult(null)
      setError('Configure an API URL to begin')
      return
    }

    fetchData()

    if (config.refreshInterval > 0) {
      intervalRef.current = window.setInterval(fetchData, config.refreshInterval)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    config.url,
    config.method,
    JSON.stringify(config.headers),
    config.body,
    config.timeoutMs,
    config.maxResponseBytes,
    config.refreshInterval,
    config.allowInsecureHttp,
    config.allowPrivateNetworks,
  ])

  const sortedHeaders = useMemo(() => {
    if (!result) return []
    return Object.entries(result.responseHeaders).sort(([a], [b]) =>
      a.localeCompare(b),
    )
  }, [result])

  const responseText = formatBody(result)

  if (!config.url) {
    return (
      <GlassCard className="h-full p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon icon={SettingsError02Icon} size="xl" />
        <p className="text-sm text-center">Configure API URL in widget settings</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="h-full p-3 flex flex-col gap-2 overflow-hidden">
      <div className="flex items-start justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon icon={Globe02Icon} size="sm" className="text-cyan-400" />
            <p className="text-sm font-medium truncate">API Fetch</p>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium">
              {config.method}
            </span>
          </div>
          {result && (
            <p className="text-xs text-muted-foreground truncate">
              {result.status} {result.statusText} · {result.durationMs}ms
              {result.truncated ? ' · truncated' : ''}
            </p>
          )}
          {error && <p className="text-xs text-red-400 truncate">{error}</p>}
        </div>

        <button
          onClick={fetchData}
          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          title="Refresh"
        >
          <Icon
            icon={loading ? Loading03Icon : RefreshIcon}
            size="sm"
            className={loading ? 'animate-spin' : ''}
          />
        </button>
      </div>

      {loading && !result && (
        <div className="flex-1 flex items-center justify-center">
          <Icon
            icon={Loading03Icon}
            size="lg"
            className="animate-spin text-muted-foreground"
          />
        </div>
      )}

      {result && (
        <div className="flex-1 min-h-0 overflow-y-auto -mr-1 pr-1 space-y-2">
          <div className="rounded-lg bg-black/25 border border-white/10 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Request
            </p>
            <p className="text-xs break-all text-white/80">{result.finalUrl}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Content-Type: {result.contentType ?? 'unknown'}
            </p>
          </div>

          <div className="rounded-lg bg-black/25 border border-white/10 p-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              Response
            </p>
            <pre className="text-xs whitespace-pre-wrap wrap-break-word font-mono text-white/85 max-h-56 overflow-y-auto">
              {responseText || '(empty response)'}
            </pre>
          </div>

          {config.showHeaders && sortedHeaders.length > 0 && (
            <div className="rounded-lg bg-black/25 border border-white/10 p-2">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                Headers
              </p>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {sortedHeaders.map(([key, value]) => (
                  <p key={key} className="text-[11px] break-all">
                    <span className="text-muted-foreground">{key}:</span>{' '}
                    <span className="text-white/80">{value}</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  )
}

export const apiFetchWidgetDefinition: Widget<typeof apiFetchWidgetConfigSchema> = {
  type: 'api-fetch',
  displayName: 'API Fetch',
  description: 'Fetch an HTTP API endpoint and inspect JSON/text responses',
  icon: 'api',
  category: 'custom',
  configSchema: apiFetchWidgetConfigSchema,
  defaultConfig: {
    url: 'https://api.github.com/zen',
    method: 'GET',
    headers: {},
    body: '',
    timeoutMs: 10000,
    refreshInterval: 0,
    maxResponseBytes: 65536,
    allowInsecureHttp: false,
    allowPrivateNetworks: false,
    showHeaders: false,
  },
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 8, h: 6 },
}
