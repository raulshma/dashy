import { z } from 'zod'
import { publicPostFn, handleServerError } from '@server/api/utils'
import type { ApiResponse } from '@shared/types'
import {
  fetchWeatherByCoordinates,
  fetchWeatherByLocation,
  geocodeLocation,
  type GeocodingResult,
  type WeatherData,
} from '@server/services/weather'

const weatherUnitsSchema = z.enum(['metric', 'imperial'])

const searchLocationsSchema = z.object({
  query: z.string().trim().min(2).max(100),
  count: z.number().int().min(1).max(10).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/)
    .optional(),
  language: z.string().trim().min(2).max(10).optional(),
})

const weatherByCoordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  units: weatherUnitsSchema.optional(),
  days: z.number().int().min(1).max(7).optional(),
  ttlMs: z.number().int().min(60000).max(3600000).optional(),
  timeoutMs: z.number().int().min(1000).max(20000).optional(),
})

const weatherByLocationSchema = z.object({
  query: z.string().trim().min(2).max(100),
  units: weatherUnitsSchema.optional(),
  days: z.number().int().min(1).max(7).optional(),
  ttlMs: z.number().int().min(60000).max(3600000).optional(),
  timeoutMs: z.number().int().min(1000).max(20000).optional(),
  countryCode: z
    .string()
    .trim()
    .regex(/^[a-zA-Z]{2}$/)
    .optional(),
  language: z.string().trim().min(2).max(10).optional(),
})

export interface SearchLocationsResponse {
  locations: Array<GeocodingResult>
}

export interface WeatherResponse {
  weather: WeatherData
}

export const searchLocationsFn = publicPostFn
  .inputValidator(searchLocationsSchema)
  .handler(async ({ data }): Promise<ApiResponse<SearchLocationsResponse>> => {
    try {
      const result = await geocodeLocation(data.query, {
        count: data.count,
        countryCode: data.countryCode,
        language: data.language,
      })

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: result.error,
          },
        }
      }

      return {
        success: true,
        data: {
          locations: result.data,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const getWeatherByCoordinatesFn = publicPostFn
  .inputValidator(weatherByCoordinatesSchema)
  .handler(async ({ data }): Promise<ApiResponse<WeatherResponse>> => {
    try {
      const result = await fetchWeatherByCoordinates(data.latitude, data.longitude, {
        units: data.units,
        days: data.days,
        ttlMs: data.ttlMs,
        timeoutMs: data.timeoutMs,
      })

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: result.error,
          },
        }
      }

      return {
        success: true,
        data: {
          weather: result.data,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })

export const getWeatherByLocationFn = publicPostFn
  .inputValidator(weatherByLocationSchema)
  .handler(async ({ data }): Promise<ApiResponse<WeatherResponse>> => {
    try {
      const result = await fetchWeatherByLocation(data.query, {
        units: data.units,
        days: data.days,
        ttlMs: data.ttlMs,
        timeoutMs: data.timeoutMs,
        countryCode: data.countryCode,
        language: data.language,
      })

      if (!result.success) {
        return {
          success: false,
          error: {
            code: 'FETCH_ERROR',
            message: result.error,
          },
        }
      }

      return {
        success: true,
        data: {
          weather: result.data,
        },
      }
    } catch (error) {
      return handleServerError(error)
    }
  })
