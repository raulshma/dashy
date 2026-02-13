import { z } from 'zod'
import { handleServerError, publicPostFn } from '@server/api/utils'
import { fetchApiData } from '@server/services/api-fetch'
import type {
  ApiFetchMethod,
  ApiFetchResponse,
} from '@server/services/api-fetch'

const methodSchema = z.enum([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
])

const fetchApiDataSchema = z
  .object({
    url: z.string().url(),
    method: methodSchema.default('GET'),
    headers: z.record(z.string().max(100), z.string().max(2000)).optional(),
    body: z.string().max(20000).optional(),
    timeoutMs: z.number().int().min(1000).max(20000).optional(),
    maxResponseBytes: z
      .number()
      .int()
      .min(1024)
      .max(1024 * 1024)
      .optional(),
    allowInsecureHttp: z.boolean().optional(),
    allowPrivateNetworks: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.method === 'GET' || value.method === 'HEAD') && value.body) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['body'],
        message: `${value.method} requests cannot include a request body`,
      })
    }
  })

export interface ApiFetchDataResponse {
  result: Omit<ApiFetchResponse, 'body'> & {
    bodyText: string
  }
}

function toBodyText(value: unknown): string {
  if (value == null) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export const fetchApiDataFn = publicPostFn
  .inputValidator(fetchApiDataSchema)
  .handler(async ({ data }) => {
    try {
      const result = await fetchApiData({
        url: data.url,
        method: data.method as ApiFetchMethod,
        headers: data.headers,
        body: data.body,
        timeoutMs: data.timeoutMs,
        maxResponseBytes: data.maxResponseBytes,
        allowInsecureHttp: data.allowInsecureHttp,
        allowPrivateNetworks: data.allowPrivateNetworks,
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: result.error || 'Failed to fetch API response',
          },
        }
      }

      return {
        success: true,
        data: {
          result: (() => {
            const { body, ...rest } = result.data
            return {
              ...rest,
              bodyText: toBodyText(body),
            }
          })(),
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
