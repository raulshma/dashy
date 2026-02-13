import { z } from 'zod'
import { handleServerError, publicPostFn } from '@server/api/utils'
import {
  clearFeedCache,
  fetchRssFeed,
  getCachedFeed,
} from '@server/services/rss'
import type { RssFeed } from '@server/services/rss'
import type { ApiResponse } from '@shared/types'

const fetchFeedSchema = z.object({
  url: z.string().url(),
  timeout: z.number().int().min(1000).max(60000).optional(),
  ttlMs: z.number().int().min(60000).max(86400000).optional(),
})

const getCachedSchema = z.object({
  url: z.string().url(),
})

const clearCacheSchema = z.object({
  url: z.string().url().optional(),
})

export interface RssFeedResponse {
  feed: RssFeed
}

export const fetchRssFeedFn = publicPostFn
  .inputValidator(fetchFeedSchema)
  .handler(async ({ data }): Promise<ApiResponse<RssFeedResponse>> => {
    try {
      const result = await fetchRssFeed(data.url, {
        timeout: data.timeout,
        ttlMs: data.ttlMs,
      })

      if (result.success && result.feed) {
        return {
          success: true,
          data: { feed: result.feed },
        }
      }

      return {
        success: false,
        error: {
          code: 'FETCH_ERROR',
          message: result.error || 'Failed to fetch RSS feed',
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const getCachedRssFeedFn = publicPostFn
  .inputValidator(getCachedSchema)
  .handler(({ data }): ApiResponse<RssFeedResponse> => {
    try {
      const feed = getCachedFeed(data.url)

      if (feed) {
        return {
          success: true,
          data: { feed },
        }
      }

      return {
        success: false,
        error: {
          code: 'NOT_CACHED',
          message: 'Feed not found in cache',
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const clearRssCacheFn = publicPostFn
  .inputValidator(clearCacheSchema)
  .handler(({ data }): ApiResponse<{ cleared: boolean }> => {
    try {
      clearFeedCache(data.url)
      return { success: true, data: { cleared: true } }
    } catch (error) {
      return handleServerError(error)
    }
  })
