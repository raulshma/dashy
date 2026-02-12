/**
 * Health Check API Server Functions
 *
 * Server-side functions for performing health checks and managing history.
 */
import { z } from 'zod'
import { protectedPostFn } from '@server/api/auth'
import { handleServerError } from '@server/api/utils'
import {
  performCheck,
  getHistory,
  getHistoryStats,
  startPolling,
  stopPolling,
  isPolling,
  type CheckConfig,
  type HealthCheckResult,
  type HealthHistoryEntry,
} from '@server/services/health'
import type { ApiResponse } from '@shared/types'

const healthCheckSchema = z.discriminatedUnion('checkType', [
  z.object({
    checkType: z.literal('http'),
    widgetId: z.string().uuid(),
    url: z.string().url(),
    method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS']).default('GET'),
    expectedStatus: z
      .union([
        z.number().int().min(100).max(599),
        z.array(z.number().int().min(100).max(599)),
      ])
      .default([200, 201, 202, 204, 301, 302, 304]),
    timeout: z.number().int().min(1000).max(60000).default(10000),
    headers: z.record(z.string(), z.unknown()).optional(),
    body: z.string().optional(),
  }),
  z.object({
    checkType: z.literal('tcp'),
    widgetId: z.string().uuid(),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    timeout: z.number().int().min(1000).max(60000).default(10000),
  }),
])

const historySchema = z.object({
  widgetId: z.string().uuid(),
  limit: z.number().int().min(1).max(100).default(20),
})

const pollingSchema = z.discriminatedUnion('checkType', [
  z.object({
    checkType: z.literal('http'),
    widgetId: z.string().uuid(),
    url: z.string().url(),
    method: z.enum(['GET', 'HEAD', 'POST', 'PUT', 'OPTIONS']).default('GET'),
    expectedStatus: z
      .union([
        z.number().int().min(100).max(599),
        z.array(z.number().int().min(100).max(599)),
      ])
      .default([200, 201, 202, 204, 301, 302, 304]),
    timeout: z.number().int().min(1000).max(60000).default(10000),
    interval: z.number().int().min(5000).max(3600000).default(60000),
    headers: z.record(z.string(), z.unknown()).optional(),
    body: z.string().optional(),
  }),
  z.object({
    checkType: z.literal('tcp'),
    widgetId: z.string().uuid(),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    timeout: z.number().int().min(1000).max(60000).default(10000),
    interval: z.number().int().min(5000).max(3600000).default(60000),
  }),
])

const stopPollingSchema = z.object({
  widgetId: z.string().uuid(),
})

export interface HealthCheckResponse {
  result: HealthCheckResult
}

export interface HistoryResponse {
  history: Array<HealthHistoryEntry>
  stats: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
    avgLatency: number | null
    uptimePercent: number
  }
}

export interface PollingStatusResponse {
  widgetId: string
  isPolling: boolean
}

export const runHealthCheckFn = protectedPostFn
  .inputValidator(healthCheckSchema)
  .handler(async ({ data }): Promise<ApiResponse<HealthCheckResponse>> => {
    try {
      let checkConfig: CheckConfig

      if (data.checkType === 'http') {
        checkConfig = {
          url: data.url,
          method: data.method,
          expectedStatus: data.expectedStatus,
          timeout: data.timeout,
          headers: data.headers,
          body: data.body,
        }
      } else {
        checkConfig = {
          host: data.host,
          port: data.port,
          timeout: data.timeout,
        }
      }

      const result = await performCheck(checkConfig)

      return {
        success: true,
        data: { result },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const getHealthHistoryFn = protectedPostFn
  .inputValidator(historySchema)
  .handler(async ({ data }): Promise<ApiResponse<HistoryResponse>> => {
    try {
      const history = getHistory(data.widgetId).slice(0, data.limit)
      const stats = getHistoryStats(data.widgetId)

      return {
        success: true,
        data: { history, stats },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const startHealthPollingFn = protectedPostFn
  .inputValidator(pollingSchema)
  .handler(async ({ data }): Promise<ApiResponse<PollingStatusResponse>> => {
    try {
      let checkConfig: CheckConfig

      if (data.checkType === 'http') {
        checkConfig = {
          url: data.url,
          method: data.method,
          expectedStatus: data.expectedStatus,
          timeout: data.timeout,
          headers: data.headers,
          body: data.body,
        }
      } else {
        checkConfig = {
          host: data.host,
          port: data.port,
          timeout: data.timeout,
        }
      }

      startPolling({
        widgetId: data.widgetId,
        checkConfig,
        intervalMs: data.interval,
      })

      return {
        success: true,
        data: {
          widgetId: data.widgetId,
          isPolling: true,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const stopHealthPollingFn = protectedPostFn
  .inputValidator(stopPollingSchema)
  .handler(async ({ data }): Promise<ApiResponse<PollingStatusResponse>> => {
    try {
      stopPolling(data.widgetId)

      return {
        success: true,
        data: {
          widgetId: data.widgetId,
          isPolling: false,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const getPollingStatusFn = protectedPostFn
  .inputValidator(stopPollingSchema)
  .handler(async ({ data }): Promise<ApiResponse<PollingStatusResponse>> => {
    try {
      return {
        success: true,
        data: {
          widgetId: data.widgetId,
          isPolling: isPolling(data.widgetId),
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
