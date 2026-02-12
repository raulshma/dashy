export type WeatherUnits = 'metric' | 'imperial'

export interface WeatherCondition {
  code: number
  description: string
  icon: string
}

export interface CurrentWeather {
  time: string
  temperature: number
  feelsLike: number
  humidity: number
  pressure: number
  windSpeed: number
  windDirection: number
  isDay: boolean
  condition: WeatherCondition
}

export interface ForecastItem {
  date: string
  tempMin: number
  tempMax: number
  precipitationProbabilityMax: number
  precipitationSum: number
  condition: WeatherCondition
}

export interface WeatherLocation {
  name: string
  country: string
  admin1?: string
  latitude: number
  longitude: number
  timezone?: string
}

export interface WeatherData {
  location: WeatherLocation
  units: WeatherUnits
  current: CurrentWeather
  forecast: Array<ForecastItem>
  fetchedAt: Date
}

export interface GeocodingResult extends WeatherLocation {
  id: number
}

type FetchWeatherResult =
  | { success: true; data: WeatherData }
  | { success: false; error: string }

type GeocodeSearchResult =
  | { success: true; data: Array<GeocodingResult> }
  | { success: false; error: string }

const WEATHER_API_BASE_URL = 'https://api.open-meteo.com/v1/forecast'
const GEOCODING_API_BASE_URL =
  'https://geocoding-api.open-meteo.com/v1/search'

const DEFAULT_WEATHER_TTL_MS = 10 * 60 * 1000
const DEFAULT_GEOCODE_TTL_MS = 60 * 60 * 1000

const weatherCache = new Map<string, { data: WeatherData; expiresAt: number }>()
const geocodeCache = new Map<
  string,
  { data: Array<GeocodingResult>; expiresAt: number }
>()

function getConditionFromWeatherCode(code: number): WeatherCondition {
  if (code === 0) return { code, description: 'Clear sky', icon: '☀️' }
  if ([1, 2, 3].includes(code)) {
    return { code, description: 'Partly cloudy', icon: '⛅' }
  }
  if ([45, 48].includes(code)) return { code, description: 'Fog', icon: '🌫️' }
  if ([51, 53, 55, 56, 57].includes(code)) {
    return { code, description: 'Drizzle', icon: '🌦️' }
  }
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) {
    return { code, description: 'Rain', icon: '🌧️' }
  }
  if ([71, 73, 75, 77, 85, 86].includes(code)) {
    return { code, description: 'Snow', icon: '❄️' }
  }
  if ([95, 96, 99].includes(code)) {
    return { code, description: 'Thunderstorm', icon: '⛈️' }
  }
  return { code, description: 'Unknown', icon: '🌡️' }
}

function unitParams(units: WeatherUnits): {
  temperature_unit: 'celsius' | 'fahrenheit'
  wind_speed_unit: 'kmh' | 'mph'
  precipitation_unit: 'mm' | 'inch'
} {
  if (units === 'imperial') {
    return {
      temperature_unit: 'fahrenheit',
      wind_speed_unit: 'mph',
      precipitation_unit: 'inch',
    }
  }

  return {
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    precipitation_unit: 'mm',
  }
}

async function fetchJson<T>(
  url: URL,
  timeoutMs: number,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Dashy-Weather/1.0',
        Accept: 'application/json',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ reason: response.statusText }))

      const reason =
        typeof errorBody?.reason === 'string'
          ? errorBody.reason
          : `HTTP ${response.status}`

      return { ok: false, error: reason }
    }

    const data = (await response.json()) as T
    return { ok: true, data }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${timeoutMs}ms` }
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Unknown request error',
    }
  }
}

function parseGeocodingResults(input: unknown): Array<GeocodingResult> {
  if (!input || typeof input !== 'object') return []

  const results = (input as { results?: unknown }).results
  if (!Array.isArray(results)) return []

  const parsed: Array<GeocodingResult> = []

  for (const item of results) {
    if (!item || typeof item !== 'object') continue

    const location = item as Record<string, unknown>
    const id = typeof location.id === 'number' ? location.id : 0
    const name = typeof location.name === 'string' ? location.name : ''
    const country =
      typeof location.country === 'string' ? location.country : 'Unknown'
    const admin1 =
      typeof location.admin1 === 'string' ? location.admin1 : undefined
    const latitude =
      typeof location.latitude === 'number' ? location.latitude : NaN
    const longitude =
      typeof location.longitude === 'number' ? location.longitude : NaN
    const timezone =
      typeof location.timezone === 'string' ? location.timezone : undefined

    if (!name || Number.isNaN(latitude) || Number.isNaN(longitude)) continue

    parsed.push({
      id,
      name,
      country,
      admin1,
      latitude,
      longitude,
      timezone,
    })
  }

  return parsed
}

function buildWeatherCacheKey(
  latitude: number,
  longitude: number,
  units: WeatherUnits,
  days: number,
): string {
  return `${latitude.toFixed(4)},${longitude.toFixed(4)}:${units}:${days}`
}

function parseWeatherData(
  payload: unknown,
  location: WeatherLocation,
  units: WeatherUnits,
): WeatherData | null {
  if (!payload || typeof payload !== 'object') return null

  const data = payload as Record<string, unknown>
  const current =
    data.current && typeof data.current === 'object'
      ? (data.current as Record<string, unknown>)
      : null
  const daily =
    data.daily && typeof data.daily === 'object'
      ? (data.daily as Record<string, unknown>)
      : null

  if (!current || !daily) return null

  const weatherCode =
    typeof current.weather_code === 'number' ? current.weather_code : 0

  const currentWeather: CurrentWeather = {
    time: typeof current.time === 'string' ? current.time : new Date().toISOString(),
    temperature:
      typeof current.temperature_2m === 'number' ? current.temperature_2m : 0,
    feelsLike:
      typeof current.apparent_temperature === 'number'
        ? current.apparent_temperature
        : 0,
    humidity:
      typeof current.relative_humidity_2m === 'number'
        ? current.relative_humidity_2m
        : 0,
    pressure:
      typeof current.surface_pressure === 'number' ? current.surface_pressure : 0,
    windSpeed:
      typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : 0,
    windDirection:
      typeof current.wind_direction_10m === 'number'
        ? current.wind_direction_10m
        : 0,
    isDay: current.is_day === 1,
    condition: getConditionFromWeatherCode(weatherCode),
  }

  const times = Array.isArray(daily.time)
    ? (daily.time as Array<unknown>)
    : []
  const maxTemps = Array.isArray(daily.temperature_2m_max)
    ? (daily.temperature_2m_max as Array<unknown>)
    : []
  const minTemps = Array.isArray(daily.temperature_2m_min)
    ? (daily.temperature_2m_min as Array<unknown>)
    : []
  const weatherCodes = Array.isArray(daily.weather_code)
    ? (daily.weather_code as Array<unknown>)
    : []
  const precipProbabilityMax = Array.isArray(daily.precipitation_probability_max)
    ? (daily.precipitation_probability_max as Array<unknown>)
    : []
  const precipSum = Array.isArray(daily.precipitation_sum)
    ? (daily.precipitation_sum as Array<unknown>)
    : []

  const length = Math.min(
    times.length,
    maxTemps.length,
    minTemps.length,
    weatherCodes.length,
  )

  const forecast: Array<ForecastItem> = []
  for (let i = 0; i < length; i++) {
    const code = typeof weatherCodes[i] === 'number' ? weatherCodes[i] : 0

    forecast.push({
      date: typeof times[i] === 'string' ? times[i] : '',
      tempMax: typeof maxTemps[i] === 'number' ? maxTemps[i] : 0,
      tempMin: typeof minTemps[i] === 'number' ? minTemps[i] : 0,
      precipitationProbabilityMax:
        typeof precipProbabilityMax[i] === 'number' ? precipProbabilityMax[i] : 0,
      precipitationSum: typeof precipSum[i] === 'number' ? precipSum[i] : 0,
      condition: getConditionFromWeatherCode(code),
    })
  }

  return {
    location,
    units,
    current: currentWeather,
    forecast,
    fetchedAt: new Date(),
  }
}

export async function geocodeLocation(
  query: string,
  options?: {
    count?: number
    countryCode?: string
    language?: string
    ttlMs?: number
    timeoutMs?: number
  },
): Promise<GeocodeSearchResult> {
  const normalizedQuery = query.trim()
  if (normalizedQuery.length < 2) {
    return { success: false, error: 'Location query must be at least 2 characters' }
  }

  const count = Math.min(Math.max(options?.count ?? 5, 1), 10)
  const countryCode = options?.countryCode?.trim().slice(0, 2).toLowerCase()
  const language = options?.language?.trim().slice(0, 10).toLowerCase() ?? 'en'
  const ttlMs = options?.ttlMs ?? DEFAULT_GEOCODE_TTL_MS
  const timeoutMs = options?.timeoutMs ?? 10000

  const cacheKey = `${normalizedQuery.toLowerCase()}:${count}:${countryCode ?? ''}:${language}`
  const cached = geocodeCache.get(cacheKey)

  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, data: cached.data }
  }

  const url = new URL(GEOCODING_API_BASE_URL)
  url.searchParams.set('name', normalizedQuery)
  url.searchParams.set('count', String(count))
  url.searchParams.set('language', language)
  url.searchParams.set('format', 'json')

  if (countryCode && /^[a-z]{2}$/.test(countryCode)) {
    url.searchParams.set('countryCode', countryCode)
  }

  const response = await fetchJson<unknown>(url, timeoutMs)
  if (!response.ok) {
    return { success: false, error: response.error }
  }

  const results = parseGeocodingResults(response.data)
  geocodeCache.set(cacheKey, {
    data: results,
    expiresAt: Date.now() + ttlMs,
  })

  return { success: true, data: results }
}

export async function fetchWeatherByCoordinates(
  latitude: number,
  longitude: number,
  options?: {
    units?: WeatherUnits
    days?: number
    ttlMs?: number
    timeoutMs?: number
    location?: Partial<WeatherLocation>
  },
): Promise<FetchWeatherResult> {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { success: false, error: 'Latitude must be between -90 and 90' }
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { success: false, error: 'Longitude must be between -180 and 180' }
  }

  const units = options?.units ?? 'metric'
  const days = Math.min(Math.max(options?.days ?? 5, 1), 7)
  const ttlMs = options?.ttlMs ?? DEFAULT_WEATHER_TTL_MS
  const timeoutMs = options?.timeoutMs ?? 10000

  const cacheKey = buildWeatherCacheKey(latitude, longitude, units, days)
  const cached = weatherCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, data: cached.data }
  }

  const params = unitParams(units)

  const url = new URL(WEATHER_API_BASE_URL)
  url.searchParams.set('latitude', latitude.toString())
  url.searchParams.set('longitude', longitude.toString())
  url.searchParams.set(
    'current',
    [
      'temperature_2m',
      'apparent_temperature',
      'relative_humidity_2m',
      'surface_pressure',
      'wind_speed_10m',
      'wind_direction_10m',
      'is_day',
      'weather_code',
    ].join(','),
  )
  url.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
    ].join(','),
  )
  url.searchParams.set('temperature_unit', params.temperature_unit)
  url.searchParams.set('wind_speed_unit', params.wind_speed_unit)
  url.searchParams.set('precipitation_unit', params.precipitation_unit)
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('forecast_days', String(days))

  const response = await fetchJson<unknown>(url, timeoutMs)
  if (!response.ok) {
    return { success: false, error: response.error }
  }

  const resolvedLocation: WeatherLocation = {
    name: options?.location?.name ?? 'Selected location',
    country: options?.location?.country ?? '',
    admin1: options?.location?.admin1,
    latitude,
    longitude,
    timezone: options?.location?.timezone,
  }

  const parsed = parseWeatherData(response.data, resolvedLocation, units)
  if (!parsed) {
    return { success: false, error: 'Weather provider returned invalid data' }
  }

  weatherCache.set(cacheKey, {
    data: parsed,
    expiresAt: Date.now() + ttlMs,
  })

  return { success: true, data: parsed }
}

export async function fetchWeatherByLocation(
  query: string,
  options?: {
    units?: WeatherUnits
    days?: number
    ttlMs?: number
    timeoutMs?: number
    countryCode?: string
    language?: string
  },
): Promise<FetchWeatherResult> {
  const geocode = await geocodeLocation(query, {
    count: 1,
    countryCode: options?.countryCode,
    language: options?.language,
    timeoutMs: options?.timeoutMs,
  })

  if (!geocode.success) {
    return { success: false, error: geocode.error }
  }

  const bestMatch = geocode.data[0]
  if (!bestMatch) {
    return { success: false, error: `No location found for "${query.trim()}"` }
  }

  return fetchWeatherByCoordinates(bestMatch.latitude, bestMatch.longitude, {
    units: options?.units,
    days: options?.days,
    ttlMs: options?.ttlMs,
    timeoutMs: options?.timeoutMs,
    location: {
      name: bestMatch.name,
      country: bestMatch.country,
      admin1: bestMatch.admin1,
      timezone: bestMatch.timezone,
    },
  })
}

export function clearWeatherCache(): void {
  weatherCache.clear()
}

export function clearGeocodeCache(): void {
  geocodeCache.clear()
}

export function getWeatherCacheStats(): { weatherEntries: number; geocodeEntries: number } {
  return {
    weatherEntries: weatherCache.size,
    geocodeEntries: geocodeCache.size,
  }
}
