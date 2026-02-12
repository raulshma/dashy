/**
 * Realtime WebSocket handler
 *
 * Provides a secure baseline for dashboard-scoped realtime channels:
 * - Connection lifecycle management
 * - Dashboard room subscriptions
 * - Heartbeat/ping handling
 * - Defensive message validation and cleanup
 */
import { defineWebSocketHandler } from 'nitro/h3'
import type { RealtimeServerMessage } from '@shared/contracts'
import { parseClientMessage } from './protocol'

const HEARTBEAT_INTERVAL_MS = 30_000
const STALE_CONNECTION_MS = 90_000
const MAX_ROOMS_PER_CLIENT = 10
const REALTIME_PROTOCOL_VERSION = 1
const MAX_BROADCAST_PAYLOAD_BYTES = 24_576

type RealtimePeer = {
  send: (data: string) => void
  close?: (code?: number, reason?: string) => void
}

interface ConnectionState {
  id: string
  peer: RealtimePeer
  connectedAt: number
  lastSeenAt: number
  joinedDashboards: Set<string>
}

const connections = new Map<string, ConnectionState>()
const peerToConnectionId = new WeakMap<object, string>()
const dashboardRooms = new Map<string, Set<string>>()
let heartbeatTimer: ReturnType<typeof setInterval> | null = null

const DASHBOARD_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/

type RealtimeBroadcastEvent = Extract<
  RealtimeServerMessage,
  { type: 'broadcast' }
>['event']

type PublishDashboardEventInput = {
  dashboardId: string
  actorId: string
  event: RealtimeBroadcastEvent
  payload: Record<string, unknown>
  excludeClientId?: string
}

function createConnectionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `ws-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function now(): number {
  return Date.now()
}

function isValidDashboardId(value: string): boolean {
  return DASHBOARD_ID_PATTERN.test(value)
}

function sanitizeBroadcastPayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const safePayload = structuredClone(payload)
  const encoded = JSON.stringify(safePayload)

  if (encoded.length > MAX_BROADCAST_PAYLOAD_BYTES) {
    throw new Error(
      `Broadcast payload exceeds ${MAX_BROADCAST_PAYLOAD_BYTES} bytes`,
    )
  }

  return safePayload
}

function safelySend(peer: RealtimePeer, payload: RealtimeServerMessage): void {
  try {
    peer.send(JSON.stringify(payload))
  } catch {
    // Avoid throwing from websocket callbacks.
  }
}

function sendError(
  peer: RealtimePeer,
  code: string,
  message: string,
): void {
  safelySend(peer, {
    type: 'error',
    code,
    message,
    timestamp: now(),
    protocolVersion: REALTIME_PROTOCOL_VERSION,
  })
}

function broadcastToDashboard(
  dashboardId: string,
  payload: RealtimeServerMessage,
  excludeClientId?: string,
): void {
  const room = dashboardRooms.get(dashboardId)
  if (!room) {
    return
  }

  for (const clientId of room) {
    if (excludeClientId && clientId === excludeClientId) {
      continue
    }

    const connection = connections.get(clientId)
    if (!connection) {
      continue
    }

    safelySend(connection.peer, payload)
  }
}

export function publishDashboardEvent({
  dashboardId,
  actorId,
  event,
  payload,
  excludeClientId,
}: PublishDashboardEventInput): void {
  try {
    if (!isValidDashboardId(dashboardId)) {
      return
    }

    const safeActorId = actorId.trim()
    if (!safeActorId) {
      return
    }

    const safePayload = sanitizeBroadcastPayload(payload)

    broadcastToDashboard(
      dashboardId,
      {
        type: 'broadcast',
        event,
        dashboardId,
        actorId: safeActorId,
        payload: safePayload,
        timestamp: now(),
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      },
      excludeClientId,
    )
  } catch {
    // Best-effort realtime: persistence should not fail because broadcast failed.
  }
}

function removeFromDashboard(
  connection: ConnectionState,
  dashboardId: string,
  notify = true,
): void {
  const room = dashboardRooms.get(dashboardId)
  if (room) {
    room.delete(connection.id)
    if (room.size === 0) {
      dashboardRooms.delete(dashboardId)
    }
  }

  connection.joinedDashboards.delete(dashboardId)

  if (notify) {
    const clients = dashboardRooms.get(dashboardId)?.size ?? 0
    safelySend(connection.peer, {
      type: 'unsubscribed',
      dashboardId,
      clients,
      timestamp: now(),
      protocolVersion: REALTIME_PROTOCOL_VERSION,
    })

    broadcastToDashboard(
      dashboardId,
      {
        type: 'presence',
        action: 'left',
        dashboardId,
        clientId: connection.id,
        timestamp: now(),
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      },
      connection.id,
    )
  }
}

function cleanupConnection(peerRef: object): void {
  const connectionId = peerToConnectionId.get(peerRef)
  if (!connectionId) {
    return
  }

  const connection = connections.get(connectionId)
  peerToConnectionId.delete(peerRef)

  if (!connection) {
    return
  }

  const dashboards = [...connection.joinedDashboards]
  for (const dashboardId of dashboards) {
    removeFromDashboard(connection, dashboardId, true)
  }

  connections.delete(connection.id)

  if (connections.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
}

function subscribeToDashboard(
  connection: ConnectionState,
  dashboardId: string,
): void {
  if (connection.joinedDashboards.has(dashboardId)) {
    const clients = dashboardRooms.get(dashboardId)?.size ?? 0
    safelySend(connection.peer, {
      type: 'subscribed',
      dashboardId,
      clients,
      timestamp: now(),
      protocolVersion: REALTIME_PROTOCOL_VERSION,
    })
    return
  }

  if (connection.joinedDashboards.size >= MAX_ROOMS_PER_CLIENT) {
    sendError(
      connection.peer,
      'MAX_ROOMS_REACHED',
      `Maximum of ${MAX_ROOMS_PER_CLIENT} dashboard subscriptions reached`,
    )
    return
  }

  const room = dashboardRooms.get(dashboardId) ?? new Set<string>()
  room.add(connection.id)
  dashboardRooms.set(dashboardId, room)
  connection.joinedDashboards.add(dashboardId)

  const clients = room.size

  safelySend(connection.peer, {
    type: 'subscribed',
    dashboardId,
    clients,
    timestamp: now(),
    protocolVersion: REALTIME_PROTOCOL_VERSION,
  })

  broadcastToDashboard(
    dashboardId,
    {
      type: 'presence',
      action: 'joined',
      dashboardId,
      clientId: connection.id,
      timestamp: now(),
      protocolVersion: REALTIME_PROTOCOL_VERSION,
    },
    connection.id,
  )
}

function extractMessageText(message: unknown): string | null {
  if (typeof message === 'string') {
    return message
  }

  if (
    message &&
    typeof message === 'object' &&
    'text' in message &&
    typeof (message as { text: unknown }).text === 'function'
  ) {
    try {
      const maybeText = (message as { text: () => unknown }).text()
      return typeof maybeText === 'string' ? maybeText : null
    } catch {
      return null
    }
  }

  return null
}

function ensureHeartbeatTimer(): void {
  if (heartbeatTimer) {
    return
  }

  heartbeatTimer = setInterval(() => {
    const staleBefore = now() - STALE_CONNECTION_MS

    for (const connection of connections.values()) {
      if (connection.lastSeenAt < staleBefore) {
        connection.peer.close?.(1001, 'Heartbeat timeout')
        cleanupConnection(connection.peer as unknown as object)
        continue
      }

      safelySend(connection.peer, {
        type: 'pong',
        timestamp: now(),
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      })
    }

    if (connections.size === 0 && heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }, HEARTBEAT_INTERVAL_MS)

  heartbeatTimer.unref?.()
}

export const dashyRealtimeWebSocketHandler = defineWebSocketHandler({
  open(peer) {
    const connectionId = createConnectionId()
    const connection: ConnectionState = {
      id: connectionId,
      peer: peer as unknown as RealtimePeer,
      connectedAt: now(),
      lastSeenAt: now(),
      joinedDashboards: new Set<string>(),
    }

    connections.set(connectionId, connection)
    peerToConnectionId.set(peer as unknown as object, connectionId)
    ensureHeartbeatTimer()

    safelySend(connection.peer, {
      type: 'hello',
      clientId: connectionId,
      timestamp: connection.connectedAt,
      protocolVersion: REALTIME_PROTOCOL_VERSION,
    })
  },

  message(peer, message) {
    const connectionId = peerToConnectionId.get(peer as unknown as object)
    if (!connectionId) {
      sendError(peer as unknown as RealtimePeer, 'UNKNOWN_CONNECTION', 'Connection not initialized')
      return
    }

    const connection = connections.get(connectionId)
    if (!connection) {
      sendError(peer as unknown as RealtimePeer, 'UNKNOWN_CONNECTION', 'Connection not found')
      return
    }

    connection.lastSeenAt = now()

    const text = extractMessageText(message)
    if (!text) {
      sendError(connection.peer, 'INVALID_MESSAGE', 'Message payload must be valid JSON text')
      return
    }

    const parsed = parseClientMessage(text)
    if (!parsed) {
      sendError(connection.peer, 'INVALID_MESSAGE', 'Unsupported message format')
      return
    }

    if (parsed.type === 'ping') {
      safelySend(connection.peer, {
        type: 'pong',
        timestamp: now(),
        protocolVersion: REALTIME_PROTOCOL_VERSION,
      })
      return
    }

    if (parsed.type === 'subscribe') {
      subscribeToDashboard(connection, parsed.dashboardId)
      return
    }

    if (parsed.dashboardId) {
      removeFromDashboard(connection, parsed.dashboardId, true)
      return
    }

    const joinedDashboards = [...connection.joinedDashboards]
    for (const dashboardId of joinedDashboards) {
      removeFromDashboard(connection, dashboardId, true)
    }
  },

  close(peer) {
    cleanupConnection(peer as unknown as object)
  },

  error(peer) {
    cleanupConnection(peer as unknown as object)
  },
})

