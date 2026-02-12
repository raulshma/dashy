/**
 * Background Polling Scheduler
 *
 * Centralized scheduler for background tasks like health checks, RSS feeds, and weather updates.
 * Provides deduplication, priority-based scheduling, and unified task management.
 */

export type TaskPriority = 'high' | 'normal' | 'low'

export type TaskStatus = 'pending' | 'running' | 'paused' | 'error' | 'stopped'

export type TaskType = 'health-check' | 'rss' | 'weather' | 'custom'

export interface TaskResult<T = unknown> {
  success: boolean
  data?: T
  error?: string
  durationMs: number
  timestamp: Date
}

export interface TaskDefinition<T = unknown> {
  id: string
  type: TaskType
  intervalMs: number
  priority?: TaskPriority
  execute: () => Promise<TaskResult<T>>
  onResult?: (result: TaskResult<T>) => void
  onError?: (error: string) => void
  dedupeKey?: string
  maxRetries?: number
  retryDelayMs?: number
}

export interface TaskState {
  id: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  intervalMs: number
  lastRunAt: Date | null
  lastResult: TaskResult | null
  nextRunAt: Date | null
  errorCount: number
  isDeduped: boolean
}

interface ScheduledTask extends TaskDefinition {
  status: TaskStatus
  lastRunAt: Date | null
  lastResult: TaskResult | null
  nextRunAt: Date | null
  errorCount: number
  timeoutId: ReturnType<typeof setTimeout> | null
  isDeduped: boolean
}

const tasks = new Map<string, ScheduledTask>()
const dedupeGroups = new Map<string, string[]>()
const DEFAULT_RETRY_DELAY_MS = 5000
const DEFAULT_MAX_RETRIES = 3

function getDefaultPriority(type: TaskType): TaskPriority {
  switch (type) {
    case 'health-check':
      return 'high'
    case 'weather':
      return 'normal'
    case 'rss':
      return 'low'
    default:
      return 'normal'
  }
}

function clearTaskTimeout(task: ScheduledTask): void {
  if (task.timeoutId !== null) {
    clearTimeout(task.timeoutId)
    task.timeoutId = null
  }
}

function removeFromDedupeGroup(
  taskId: string,
  dedupeKey: string | undefined,
): void {
  if (!dedupeKey) return

  const group = dedupeGroups.get(dedupeKey)
  if (!group) return

  const index = group.indexOf(taskId)
  if (index > -1) {
    group.splice(index, 1)
    if (group.length === 0) {
      dedupeGroups.delete(dedupeKey)
    }
  }
}

async function executeTask(task: ScheduledTask): Promise<void> {
  if (task.status === 'stopped' || task.status === 'paused') {
    return
  }

  task.status = 'running'
  const startTime = performance.now()

  try {
    const result = await task.execute()
    result.durationMs = Math.round(performance.now() - startTime)
    result.timestamp = new Date()

    task.lastResult = result
    task.lastRunAt = new Date()
    task.errorCount = 0

    if (!result.success) {
      task.errorCount++
      task.onError?.(result.error ?? 'Unknown error')
    }

    task.onResult?.(result)
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error'

    task.lastResult = {
      success: false,
      error: errorMessage,
      durationMs,
      timestamp: new Date(),
    }
    task.lastRunAt = new Date()
    task.errorCount++
    task.onError?.(errorMessage)
  }

  if (task.errorCount >= (task.maxRetries ?? DEFAULT_MAX_RETRIES)) {
    task.status = 'error'
    return
  }

  task.status = 'pending'
  scheduleNextRun(task)
}

function scheduleNextRun(task: ScheduledTask): void {
  clearTaskTimeout(task)

  if (task.status === 'stopped' || task.status === 'paused') {
    return
  }

  const delay =
    task.errorCount > 0
      ? (task.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS) * task.errorCount
      : task.intervalMs

  task.nextRunAt = new Date(Date.now() + delay)
  task.status = 'pending'

  task.timeoutId = setTimeout(() => {
    executeTask(task)
  }, delay)
}

export function scheduleTask<T = unknown>(
  definition: TaskDefinition<T>,
): string {
  const {
    id,
    type,
    intervalMs,
    priority = getDefaultPriority(type),
    execute,
    onResult,
    onError,
    dedupeKey,
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = definition

  if (tasks.has(id)) {
    stopTask(id)
  }

  const task: ScheduledTask = {
    id,
    type,
    intervalMs: Math.max(intervalMs, 1000),
    priority,
    execute: execute as () => Promise<TaskResult<unknown>>,
    onResult: onResult as ((result: TaskResult<unknown>) => void) | undefined,
    onError,
    dedupeKey,
    maxRetries,
    retryDelayMs,
    status: 'pending',
    lastRunAt: null,
    lastResult: null,
    nextRunAt: null,
    errorCount: 0,
    timeoutId: null,
    isDeduped: false,
  }

  if (dedupeKey) {
    const group = dedupeGroups.get(dedupeKey) ?? []

    if (group.length > 0) {
      task.isDeduped = true
      const primaryId = group[0]
      const primary = tasks.get(primaryId)
      if (primary) {
        task.intervalMs = primary.intervalMs
      }
    }

    group.push(id)
    dedupeGroups.set(dedupeKey, group)
  }

  tasks.set(id, task)
  scheduleNextRun(task)

  return id
}

export function stopTask(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task) return false

  clearTaskTimeout(task)
  removeFromDedupeGroup(taskId, task.dedupeKey)
  task.status = 'stopped'
  tasks.delete(taskId)

  return true
}

export function pauseTask(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task) return false

  clearTaskTimeout(task)
  task.status = 'paused'
  task.nextRunAt = null

  return true
}

export function resumeTask(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task || task.status === 'stopped') return false

  if (task.status === 'paused') {
    task.status = 'pending'
    scheduleNextRun(task)
  }

  return true
}

export function runTaskNow(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task || task.status === 'stopped') return false

  clearTaskTimeout(task)
  executeTask(task)

  return true
}

export function getTaskState(taskId: string): TaskState | null {
  const task = tasks.get(taskId)
  if (!task) return null

  return {
    id: task.id,
    type: task.type,
    status: task.status,
    priority: task.priority ?? 'normal',
    intervalMs: task.intervalMs,
    lastRunAt: task.lastRunAt,
    lastResult: task.lastResult,
    nextRunAt: task.nextRunAt,
    errorCount: task.errorCount,
    isDeduped: task.isDeduped,
  }
}

export function getAllTaskStates(): TaskState[] {
  return Array.from(tasks.values()).map((task) => ({
    id: task.id,
    type: task.type,
    status: task.status,
    priority: task.priority ?? 'normal',
    intervalMs: task.intervalMs,
    lastRunAt: task.lastRunAt,
    lastResult: task.lastResult,
    nextRunAt: task.nextRunAt,
    errorCount: task.errorCount,
    isDeduped: task.isDeduped,
  }))
}

export function getTasksByType(type: TaskType): TaskState[] {
  return getAllTaskStates().filter((t) => t.type === type)
}

export function getActiveTasks(): TaskState[] {
  return getAllTaskStates().filter((t) => t.status !== 'stopped')
}

export function stopAllTasks(): void {
  for (const taskId of tasks.keys()) {
    stopTask(taskId)
  }
}

export function pauseAllTasks(): void {
  for (const task of tasks.values()) {
    pauseTask(task.id)
  }
}

export function resumeAllTasks(): void {
  for (const task of tasks.values()) {
    resumeTask(task.id)
  }
}

export function stopTasksByType(type: TaskType): void {
  for (const task of tasks.values()) {
    if (task.type === type) {
      stopTask(task.id)
    }
  }
}

export function getSchedulerStats(): {
  totalTasks: number
  activeTasks: number
  pausedTasks: number
  errorTasks: number
  dedupeGroups: number
  byType: Record<TaskType, number>
} {
  const states = getAllTaskStates()
  const byType: Record<TaskType, number> = {
    'health-check': 0,
    rss: 0,
    weather: 0,
    custom: 0,
  }

  let active = 0
  let paused = 0
  let errors = 0

  for (const state of states) {
    byType[state.type]++
    if (state.status === 'paused') paused++
    else if (state.status === 'error') errors++
    else if (state.status !== 'stopped') active++
  }

  return {
    totalTasks: states.length,
    activeTasks: active,
    pausedTasks: paused,
    errorTasks: errors,
    dedupeGroups: dedupeGroups.size,
    byType,
  }
}

export function isTaskScheduled(taskId: string): boolean {
  return tasks.has(taskId)
}

export function updateTaskInterval(
  taskId: string,
  intervalMs: number,
): boolean {
  const task = tasks.get(taskId)
  if (!task) return false

  task.intervalMs = Math.max(intervalMs, 1000)

  if (task.status === 'pending') {
    scheduleNextRun(task)
  }

  return true
}

import {
  performCheck,
  addHistoryEntry,
  type CheckConfig,
  type HealthCheckResult,
} from './health'
import { fetchRssFeed, type FetchResult } from './rss'
import {
  fetchWeatherByCoordinates,
  fetchWeatherByLocation,
  type WeatherData,
} from './weather'

export interface HealthCheckTaskOptions {
  widgetId: string
  checkConfig: CheckConfig
  intervalMs?: number
  onResult?: (result: HealthCheckResult) => void
}

export function scheduleHealthCheck(options: HealthCheckTaskOptions): string {
  const { widgetId, checkConfig, intervalMs = 30000, onResult } = options

  const dedupeKey = JSON.stringify({
    type: 'health',
    url: 'url' in checkConfig ? checkConfig.url : undefined,
    host: 'host' in checkConfig ? checkConfig.host : undefined,
    port: 'port' in checkConfig ? checkConfig.port : undefined,
  })

  return scheduleTask<HealthCheckResult>({
    id: `health-${widgetId}`,
    type: 'health-check',
    intervalMs,
    dedupeKey,
    execute: async () => {
      const startTime = performance.now()
      try {
        const result = await performCheck(checkConfig)
        addHistoryEntry(widgetId, result)
        return {
          success: true,
          data: result,
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      }
    },
    onResult: onResult
      ? (result) => {
          if (result.success && result.data) {
            onResult(result.data)
          }
        }
      : undefined,
  })
}

export interface RssTaskOptions {
  widgetId: string
  feedUrl: string
  intervalMs?: number
  onResult?: (result: FetchResult) => void
}

export function scheduleRssRefresh(options: RssTaskOptions): string {
  const { widgetId, feedUrl, intervalMs = 300000, onResult } = options

  return scheduleTask<FetchResult>({
    id: `rss-${widgetId}`,
    type: 'rss',
    intervalMs,
    dedupeKey: `rss:${feedUrl}`,
    execute: async () => {
      const startTime = performance.now()
      try {
        const result = await fetchRssFeed(feedUrl)
        return {
          success: result.success,
          data: result,
          error: result.error,
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      }
    },
    onResult,
  })
}

export interface WeatherTaskOptions {
  widgetId: string
  mode: 'coordinates' | 'location'
  latitude?: number
  longitude?: number
  locationQuery?: string
  units?: 'metric' | 'imperial'
  days?: number
  intervalMs?: number
  onResult?: (data: WeatherData) => void
}

export function scheduleWeatherRefresh(options: WeatherTaskOptions): string {
  const {
    widgetId,
    mode,
    latitude,
    longitude,
    locationQuery,
    units = 'metric',
    days = 5,
    intervalMs = 600000,
    onResult,
  } = options

  const dedupeKey =
    mode === 'coordinates'
      ? `weather:coords:${latitude},${longitude}:${units}`
      : `weather:location:${locationQuery}:${units}`

  return scheduleTask<{ weather?: WeatherData; error?: string }>({
    id: `weather-${widgetId}`,
    type: 'weather',
    intervalMs,
    dedupeKey,
    execute: async () => {
      const startTime = performance.now()
      try {
        const result =
          mode === 'coordinates'
            ? await fetchWeatherByCoordinates(latitude!, longitude!, {
                units,
                days,
              })
            : await fetchWeatherByLocation(locationQuery!, { units, days })

        return {
          success: result.success,
          data: result.success
            ? { weather: result.data }
            : { error: result.error },
          error: result.success ? undefined : result.error,
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: Math.round(performance.now() - startTime),
          timestamp: new Date(),
        }
      }
    },
    onResult: onResult
      ? (result) => {
          if (result.success && result.data?.weather) {
            onResult(result.data.weather)
          }
        }
      : undefined,
  })
}
