import { useEffect, useMemo, useRef, useState } from 'react'
import { z } from 'zod'
import { format } from 'date-fns'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'
import { Loading03Icon, SettingsError02Icon } from '@hugeicons/core-free-icons'
import {
  getWeatherByCoordinatesFn,
  getWeatherByLocationFn,
} from '@server/api/weather'
import type { WeatherData } from '@server/services/weather'

export const weatherWidgetConfigSchema = z.object({
  locationMode: z.enum(['city', 'coordinates']).default('city'),
  city: z.string().trim().min(2).default('Berlin'),
  latitude: z.number().min(-90).max(90).default(52.52),
  longitude: z.number().min(-180).max(180).default(13.41),
  units: z.enum(['metric', 'imperial']).default('metric'),
  forecastDays: z.number().int().min(1).max(7).default(5),
  refreshInterval: z.number().int().min(60000).max(3600000).default(600000),
  showForecast: z.boolean().default(true),
})

export type WeatherWidgetConfig = z.infer<typeof weatherWidgetConfigSchema>

function formatForecastDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return format(parsed, 'EEE')
}

function formatLocation(data: WeatherData): string {
  const { name, admin1, country } = data.location
  if (admin1 && country) return `${name}, ${admin1}, ${country}`
  if (country) return `${name}, ${country}`
  return name
}

export function WeatherWidget({
  config,
}: WidgetRenderProps<WeatherWidgetConfig>) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshRef = useRef<number | null>(null)

  const legacyLocation = (config as unknown as { location?: string }).location
  const cityQuery = config.city || legacyLocation || ''

  const hasValidConfig = useMemo(() => {
    if (config.locationMode === 'city') {
      return cityQuery.trim().length >= 2
    }

    return (
      Number.isFinite(config.latitude) &&
      Number.isFinite(config.longitude) &&
      config.latitude >= -90 &&
      config.latitude <= 90 &&
      config.longitude >= -180 &&
      config.longitude <= 180
    )
  }, [config.locationMode, cityQuery, config.latitude, config.longitude])

  useEffect(() => {
    if (!hasValidConfig) {
      setLoading(false)
      return
    }

    const fetchWeather = async () => {
      try {
        const result =
          config.locationMode === 'city'
            ? await getWeatherByLocationFn({
                data: {
                  query: cityQuery,
                  units: config.units,
                  days: config.forecastDays,
                  timeoutMs: 12000,
                },
              })
            : await getWeatherByCoordinatesFn({
                data: {
                  latitude: config.latitude,
                  longitude: config.longitude,
                  units: config.units,
                  days: config.forecastDays,
                  timeoutMs: 12000,
                },
              })

        if (!result.success || !result.data) {
          setError(result.error?.message ?? 'Failed to fetch weather')
          return
        }

        setWeather(result.data.weather)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown weather error')
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchWeather()

    refreshRef.current = window.setInterval(fetchWeather, config.refreshInterval)

    return () => {
      if (refreshRef.current) {
        clearInterval(refreshRef.current)
      }
    }
  }, [
    hasValidConfig,
    config.locationMode,
    cityQuery,
    config.latitude,
    config.longitude,
    config.units,
    config.forecastDays,
    config.refreshInterval,
  ])

  if (!hasValidConfig) {
    return (
      <GlassCard className="h-full p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon icon={SettingsError02Icon} size="xl" />
        <p className="text-sm text-center">
          Configure a city or coordinates for weather
        </p>
      </GlassCard>
    )
  }

  if (loading && !weather) {
    return (
      <GlassCard className="h-full p-4 flex items-center justify-center">
        <Icon
          icon={Loading03Icon}
          size="lg"
          className="animate-spin text-muted-foreground"
        />
      </GlassCard>
    )
  }

  if (error && !weather) {
    return (
      <GlassCard className="h-full p-4 flex flex-col items-center justify-center gap-2 text-red-400">
        <p className="text-sm text-center">{error}</p>
      </GlassCard>
    )
  }

  if (!weather) {
    return (
      <GlassCard className="h-full p-4 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">No weather data</p>
      </GlassCard>
    )
  }

  const temperatureUnit = weather.units === 'imperial' ? '°F' : '°C'
  const windUnit = weather.units === 'imperial' ? 'mph' : 'km/h'
  const precipitationUnit = weather.units === 'imperial' ? 'in' : 'mm'

  return (
    <GlassCard className="h-full p-3 flex flex-col gap-3 overflow-hidden">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{formatLocation(weather)}</p>
          <p className="text-xs text-muted-foreground truncate">
            Updated {format(new Date(weather.fetchedAt), 'HH:mm')}
          </p>
        </div>
        <span className="text-2xl" aria-hidden>
          {weather.current.condition.icon}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Temperature</p>
          <p className="text-lg font-semibold">
            {Math.round(weather.current.temperature)}
            {temperatureUnit}
          </p>
          <p className="text-xs text-muted-foreground">
            Feels like {Math.round(weather.current.feelsLike)}
            {temperatureUnit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Conditions</p>
          <p className="text-sm font-medium">{weather.current.condition.description}</p>
          <p className="text-xs text-muted-foreground">
            Wind {Math.round(weather.current.windSpeed)} {windUnit}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Humidity</p>
          <p className="text-sm font-medium">{Math.round(weather.current.humidity)}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Pressure</p>
          <p className="text-sm font-medium">{Math.round(weather.current.pressure)} hPa</p>
        </div>
      </div>

      {config.showForecast && weather.forecast.length > 0 && (
        <div className="mt-auto">
          <p className="text-xs text-muted-foreground mb-2">Forecast</p>
          <div className="grid grid-cols-5 gap-1">
            {weather.forecast.slice(0, 5).map((day) => (
              <div
                key={day.date}
                className="rounded-lg bg-white/5 px-1.5 py-1 text-center"
                title={`${day.condition.description} · ${day.precipitationProbabilityMax}% rain chance · ${day.precipitationSum}${precipitationUnit}`}
              >
                <p className="text-[10px] text-muted-foreground">
                  {formatForecastDate(day.date)}
                </p>
                <p className="text-sm" aria-hidden>
                  {day.condition.icon}
                </p>
                <p className="text-[10px] font-medium">
                  {Math.round(day.tempMax)}°
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {Math.round(day.tempMin)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && weather && (
        <p className="text-xs text-red-400 truncate" title={error}>
          {error}
        </p>
      )}
    </GlassCard>
  )
}

export const weatherWidgetDefinition: Widget<typeof weatherWidgetConfigSchema> = {
  type: 'weather',
  displayName: 'Weather',
  description: 'Current conditions and short forecast for a city or coordinates',
  icon: 'cloud',
  category: 'utilities',
  configSchema: weatherWidgetConfigSchema,
  defaultConfig: {
    locationMode: 'city',
    city: 'Berlin',
    latitude: 52.52,
    longitude: 13.41,
    units: 'metric',
    forecastDays: 5,
    refreshInterval: 600000,
    showForecast: true,
  },
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 5, h: 4 },
}
