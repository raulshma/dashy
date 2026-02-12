/**
 * Realtime message protocol contracts.
 *
 * Shared between server and client to keep WebSocket message handling typed,
 * explicit, and forward-compatible.
 */

export type RealtimeProtocolVersion = 1

export interface RealtimeMessageBase {
  type: string
  timestamp: number
  protocolVersion?: RealtimeProtocolVersion
}

export type RealtimeClientMessage =
  | {
      type: 'ping'
      timestamp?: number
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'subscribe'
      dashboardId: string
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'unsubscribe'
      dashboardId?: string
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'widget:update'
      dashboardId: string
      pageId: string
      widgetId: string
      patch: Record<string, unknown>
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'layout:change'
      dashboardId: string
      pageId: string
      positions: Array<{
        id: string
        x: number
        y: number
        w: number
        h: number
      }>
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'page:switch'
      dashboardId: string
      pageId: string
      protocolVersion?: RealtimeProtocolVersion
    }
  | {
      type: 'cursor:move'
      dashboardId: string
      x: number
      y: number
      protocolVersion?: RealtimeProtocolVersion
    }

export type RealtimeServerMessage =
  | {
      type: 'hello'
      clientId: string
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'pong'
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'subscribed'
      dashboardId: string
      clients: number
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'unsubscribed'
      dashboardId: string
      clients: number
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'presence'
      action: 'joined' | 'left'
      dashboardId: string
      clientId: string
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'broadcast'
      event:
        | 'widget:update'
        | 'layout:change'
        | 'page:switch'
        | 'cursor:move'
      dashboardId: string
      actorId: string
      payload: Record<string, unknown>
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
  | {
      type: 'error'
      code: string
      message: string
      timestamp: number
      protocolVersion: RealtimeProtocolVersion
    }
