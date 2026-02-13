/**
 * Health Check Service
 *
 * Performs HTTP/HTTPS health checks with latency tracking.
 * Supports configurable timeouts, expected status codes, and history tracking.
 *
 * Usage:
 *   import { performHealthCheck, HealthCheckHistory } from '@server/services/health'
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown'

export interface HealthCheckResult {
  status: HealthStatus
  latencyMs: number | null
  statusCode: number | null
  error: string | null
  timestamp: string
  checkedAt: Date
}

export interface HealthCheckConfig {
  url: string
  method?: 'GET' | 'HEAD' | 'POST' | 'PUT' | 'OPTIONS'
  expectedStatus?: number | Array<number>
  timeout?: number
  headers?: Record<string, unknown>
  body?: string
}

export interface TcpCheckConfig {
  host: string
  port: number
  timeout?: number
}

export type CheckConfig = HealthCheckConfig | TcpCheckConfig

export function isTcpConfig(config: CheckConfig): config is TcpCheckConfig {
  return 'port' in config
}

export interface HealthHistoryEntry extends HealthCheckResult {
  id: string
}

const MAX_HISTORY_SIZE = 100

const healthHistoryStore = new Map<string, Array<HealthHistoryEntry>>()

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function determineStatus(
  statusCode: number | null,
  latencyMs: number | null,
  expectedStatus: number | Array<number>,
  error: string | null,
): HealthStatus {
  if (error) return 'unhealthy'
  if (statusCode === null) return 'unknown'

  const expected = Array.isArray(expectedStatus)
    ? expectedStatus
    : [expectedStatus]
  if (!expected.includes(statusCode)) return 'unhealthy'

  if (latencyMs === null) return 'unknown'
  if (latencyMs < 500) return 'healthy'
  if (latencyMs < 2000) return 'degraded'
  return 'unhealthy'
}

export async function performHealthCheck(
  checkConfig: HealthCheckConfig,
): Promise<HealthCheckResult> {
  const {
    url,
    method = 'GET',
    expectedStatus = [200, 201, 202, 204, 301, 302, 304],
    timeout = 10000,
    headers = {},
    body,
  } = checkConfig

  const timestamp = new Date().toISOString()
  const startTime = performance.now()

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const stringHeaders: Record<string, string> = {
      'User-Agent': 'Dashy-HealthCheck/1.0',
    }
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        stringHeaders[key] = value
      } else if (value !== undefined && value !== null) {
        stringHeaders[key] = String(value)
      }
    }

    const response = await fetch(url, {
      method,
      headers: stringHeaders,
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
      signal: controller.signal,
      redirect: 'follow',
    })

    clearTimeout(timeoutId)

    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    const status = determineStatus(
      response.status,
      latencyMs,
      expectedStatus,
      null,
    )

    return {
      status,
      latencyMs,
      statusCode: response.status,
      error: null,
      timestamp,
      checkedAt: new Date(),
    }
  } catch (err) {
    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    let errorMessage = 'Unknown error'
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        errorMessage = `Request timed out after ${timeout}ms`
      } else {
        errorMessage = err.message
      }
    }

    return {
      status: 'unhealthy',
      latencyMs: timeout >= latencyMs ? latencyMs : null,
      statusCode: null,
      error: errorMessage,
      timestamp,
      checkedAt: new Date(),
    }
  }
}

export async function performTcpCheck(
  config: TcpCheckConfig,
): Promise<HealthCheckResult> {
  const { host, port, timeout = 10000 } = config
  const timestamp = new Date().toISOString()
  const startTime = performance.now()

  try {
    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Connection timed out after ${timeout}ms`))
      }, timeout)

      Bun.connect({
        hostname: host,
        port,
        socket: {
          data() {},
          open() {
            clearTimeout(timeoutId)
            resolve()
          },
          error(_, error) {
            clearTimeout(timeoutId)
            reject(error)
          },
          close() {},
        },
      }).catch((err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
    })

    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    const status =
      latencyMs < 100 ? 'healthy' : latencyMs < 500 ? 'degraded' : 'unhealthy'

    return {
      status,
      latencyMs,
      statusCode: null,
      error: null,
      timestamp,
      checkedAt: new Date(),
    }
  } catch (err) {
    const endTime = performance.now()
    const latencyMs = Math.round(endTime - startTime)

    let errorMessage = 'Connection failed'
    if (err instanceof Error) {
      errorMessage = err.message
    }

    return {
      status: 'unhealthy',
      latencyMs: latencyMs < timeout ? latencyMs : null,
      statusCode: null,
      error: errorMessage,
      timestamp,
      checkedAt: new Date(),
    }
  }
}

export async function performCheck(
  config: CheckConfig,
): Promise<HealthCheckResult> {
  if (isTcpConfig(config)) {
    return performTcpCheck(config)
  }
  return performHealthCheck(config)
}

export function getHistory(widgetId: string): Array<HealthHistoryEntry> {
  return healthHistoryStore.get(widgetId) ?? []
}

export function addHistoryEntry(
  widgetId: string,
  result: HealthCheckResult,
): Array<HealthHistoryEntry> {
  const history = healthHistoryStore.get(widgetId) ?? []
  const entry: HealthHistoryEntry = {
    ...result,
    id: generateId(),
  }

  const newHistory = [entry, ...history].slice(0, MAX_HISTORY_SIZE)
  healthHistoryStore.set(widgetId, newHistory)

  return newHistory
}

export function clearHistory(widgetId: string): void {
  healthHistoryStore.delete(widgetId)
}

export function getLatestResult(widgetId: string): HealthHistoryEntry | null {
  const history = healthHistoryStore.get(widgetId)
  return history?.[0] ?? null
}

export function getHistoryStats(widgetId: string): {
  total: number
  healthy: number
  degraded: number
  unhealthy: number
  avgLatency: number | null
  uptimePercent: number
} {
  const history = getHistory(widgetId)

  if (history.length === 0) {
    return {
      total: 0,
      healthy: 0,
      degraded: 0,
      unhealthy: 0,
      avgLatency: null,
      uptimePercent: 100,
    }
  }

  let healthy = 0
  let degraded = 0
  let unhealthy = 0
  let totalLatency = 0
  let latencyCount = 0

  for (const entry of history) {
    if (entry.status === 'healthy') healthy++
    else if (entry.status === 'degraded') degraded++
    else if (entry.status === 'unhealthy') unhealthy++

    if (entry.latencyMs !== null) {
      totalLatency += entry.latencyMs
      latencyCount++
    }
  }

  const avgLatency =
    latencyCount > 0 ? Math.round(totalLatency / latencyCount) : null
  const uptimePercent = Math.round(
    ((healthy + degraded) / history.length) * 100,
  )

  return {
    total: history.length,
    healthy,
    degraded,
    unhealthy,
    avgLatency,
    uptimePercent,
  }
}

export interface PollingConfig {
  widgetId: string
  checkConfig: CheckConfig
  intervalMs: number
  maxChecks?: number
}

const activePollers = new Map<string, ReturnType<typeof setInterval>>()

export function startPolling(pollConfig: PollingConfig): void {
  const { widgetId, checkConfig, intervalMs, maxChecks } = pollConfig

  if (activePollers.has(widgetId)) {
    stopPolling(widgetId)
  }

  let checkCount = 0

  const runCheck = async (): Promise<void> => {
    if (maxChecks !== undefined && checkCount >= maxChecks) {
      stopPolling(widgetId)
      return
    }

    const result = await performCheck(checkConfig)
    addHistoryEntry(widgetId, result)
    checkCount++
  }

  runCheck()

  const intervalId = setInterval(runCheck, intervalMs)
  activePollers.set(widgetId, intervalId)
}

export function stopPolling(widgetId: string): boolean {
  const intervalId = activePollers.get(widgetId)
  if (intervalId) {
    clearInterval(intervalId)
    activePollers.delete(widgetId)
    return true
  }
  return false
}

export function isPolling(widgetId: string): boolean {
  return activePollers.has(widgetId)
}

export function getActivePollers(): Array<string> {
  return Array.from(activePollers.keys())
}

export function stopAllPollers(): void {
  for (const widgetId of activePollers.keys()) {
    stopPolling(widgetId)
  }
}
