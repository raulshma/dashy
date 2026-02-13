/**
 * Rate Limiter Service
 *
 * In-memory sliding window rate limiting with configurable limits per endpoint.
 * Protects against abuse, brute force attacks, and resource exhaustion.
 *
 * Features:
 * - Sliding window algorithm for smooth rate distribution
 * - Configurable limits per endpoint type
 * - Per-user and per-IP tracking
 * - Automatic cleanup of expired entries
 * - Standard X-RateLimit headers
 */
import { config } from '@server/config'
import type { ApiResponse, ErrorCode } from '@shared/types'

export interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  keyPrefix: string
  skipFailedRequests?: boolean
  skipSuccessfulRequests?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: number
  retryAfter?: number
}

interface RateLimitEntry {
  timestamps: Array<number>
  lastAccess: number
}

interface EndpointLimits {
  windowMs: number
  maxRequests: number
}

const DEFAULT_CLEANUP_INTERVAL_MS = 60_000
const DEFAULT_ENTRY_TTL_MS = 300_000
const WINDOW_MS = 60_000

function getEndpointLimits(): Record<string, EndpointLimits> {
  return {
    auth: { windowMs: WINDOW_MS, maxRequests: config.rateLimit.authMax },
    authStrict: {
      windowMs: WINDOW_MS,
      maxRequests: config.rateLimit.authStrictMax,
    },
    api: { windowMs: WINDOW_MS, maxRequests: config.rateLimit.apiMax },
    apiWrite: {
      windowMs: WINDOW_MS,
      maxRequests: config.rateLimit.apiWriteMax,
    },
    public: { windowMs: WINDOW_MS, maxRequests: config.rateLimit.publicMax },
    websocket: { windowMs: WINDOW_MS, maxRequests: 200 },
  }
}

export class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: ReturnType<typeof setInterval> | null = null
  private cleanupIntervalMs: number
  private entryTtlMs: number

  constructor(options?: { cleanupIntervalMs?: number; entryTtlMs?: number }) {
    this.cleanupIntervalMs =
      options?.cleanupIntervalMs ?? DEFAULT_CLEANUP_INTERVAL_MS
    this.entryTtlMs = options?.entryTtlMs ?? DEFAULT_ENTRY_TTL_MS
    this.startCleanup()
  }

  check(
    key: string,
    rateConfig: RateLimitConfig,
    timestamp: number = Date.now(),
  ): RateLimitResult {
    const entry = this.store.get(key)
    const windowStart = timestamp - rateConfig.windowMs

    let timestamps: Array<number>

    if (!entry) {
      timestamps = []
    } else {
      timestamps = entry.timestamps.filter((ts) => ts > windowStart)
    }

    const currentCount = timestamps.length
    const remaining = Math.max(0, rateConfig.maxRequests - currentCount)
    const allowed = currentCount < rateConfig.maxRequests

    if (allowed) {
      timestamps.push(timestamp)
    }

    this.store.set(key, {
      timestamps,
      lastAccess: timestamp,
    })

    const resetAt = timestamp + rateConfig.windowMs
    const result: RateLimitResult = {
      allowed,
      limit: rateConfig.maxRequests,
      remaining: allowed ? remaining - 1 : 0,
      resetAt,
    }

    if (!allowed) {
      const oldestInWindow =
        timestamps.length > 0 ? Math.min(...timestamps) : timestamp
      result.retryAfter = Math.ceil(
        (oldestInWindow + rateConfig.windowMs - timestamp) / 1000,
      )
    }

    return result
  }

  recordRequest(
    identifier: string,
    endpointType:
      | 'auth'
      | 'authStrict'
      | 'api'
      | 'apiWrite'
      | 'public'
      | 'websocket',
    userId?: string,
  ): RateLimitResult {
    const limits = getEndpointLimits()[endpointType]
    const key = userId
      ? `user:${userId}:${endpointType}`
      : `ip:${identifier}:${endpointType}`

    return this.check(key, {
      windowMs: limits.windowMs,
      maxRequests: limits.maxRequests,
      keyPrefix: endpointType,
    })
  }

  checkAndRecord(
    ip: string,
    endpointType:
      | 'auth'
      | 'authStrict'
      | 'api'
      | 'apiWrite'
      | 'public'
      | 'websocket',
    userId?: string,
  ): RateLimitResult {
    if (userId) {
      const userResult = this.recordRequest(ip, endpointType, userId)
      if (!userResult.allowed) {
        return userResult
      }
    }

    return this.recordRequest(ip, endpointType, userId)
  }

  reset(key: string): void {
    this.store.delete(key)
  }

  resetAll(): void {
    this.store.clear()
  }

  getStats(): { totalEntries: number; totalRequests: number } {
    let totalRequests = 0
    for (const entry of this.store.values()) {
      totalRequests += entry.timestamps.length
    }
    return {
      totalEntries: this.store.size,
      totalRequests,
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, this.cleanupIntervalMs)
  }

  private cleanup(): void {
    const now = Date.now()
    const expireThreshold = now - this.entryTtlMs

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccess < expireThreshold) {
        this.store.delete(key)
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store.clear()
  }
}

export const globalRateLimiter = new RateLimiter()

export function getRateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
    ...(result.retryAfter ? { 'Retry-After': String(result.retryAfter) } : {}),
  }
}

export function createRateLimitErrorResponse(
  result: RateLimitResult,
): ApiResponse<never> {
  return {
    success: false,
    error: {
      code: 'RATE_LIMITED' as ErrorCode,
      message: `Too many requests. Please try again in ${result.retryAfter ?? 60} seconds.`,
    },
  }
}

export type { RateLimitResult as RateLimitResultType }
