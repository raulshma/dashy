import type { RealtimeClientMessage } from '@shared/contracts'

const MAX_MESSAGE_LENGTH = 16_384
const DASHBOARD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/

export type RealtimeControlMessage = Extract<
  RealtimeClientMessage,
  { type: 'ping' | 'subscribe' | 'unsubscribe' }
>

export function isValidDashboardId(value: string): boolean {
  return DASHBOARD_ID_PATTERN.test(value)
}

export function parseClientMessage(
  text: string,
): RealtimeControlMessage | null {
  if (!text || text.length > MAX_MESSAGE_LENGTH) {
    return null
  }

  let raw: unknown

  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  if (!raw || typeof raw !== 'object') {
    return null
  }

  const candidate = raw as {
    type?: unknown
    dashboardId?: unknown
  }

  if (candidate.type === 'ping') {
    return { type: 'ping' }
  }

  if (candidate.type === 'subscribe') {
    if (typeof candidate.dashboardId !== 'string') {
      return null
    }

    const dashboardId = candidate.dashboardId.trim()
    if (!isValidDashboardId(dashboardId)) {
      return null
    }

    return {
      type: 'subscribe',
      dashboardId,
    }
  }

  if (candidate.type === 'unsubscribe') {
    if (candidate.dashboardId === undefined) {
      return { type: 'unsubscribe' }
    }

    if (typeof candidate.dashboardId !== 'string') {
      return null
    }

    const dashboardId = candidate.dashboardId.trim()
    if (!isValidDashboardId(dashboardId)) {
      return null
    }

    return {
      type: 'unsubscribe',
      dashboardId,
    }
  }

  return null
}
