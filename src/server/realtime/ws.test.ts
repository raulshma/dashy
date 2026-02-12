import { describe, expect, it } from 'vitest'
import { isValidDashboardId, parseClientMessage } from './protocol'

describe('realtime websocket parser', () => {
  it('accepts ping messages', () => {
    const parsed = parseClientMessage(JSON.stringify({ type: 'ping' }))
    expect(parsed).toEqual({ type: 'ping' })
  })

  it('accepts subscribe messages with valid dashboard ids', () => {
    const parsed = parseClientMessage(
      JSON.stringify({ type: 'subscribe', dashboardId: 'dashboard_123-abc' }),
    )

    expect(parsed).toEqual({
      type: 'subscribe',
      dashboardId: 'dashboard_123-abc',
    })
  })

  it('rejects invalid dashboard ids', () => {
    const parsed = parseClientMessage(
      JSON.stringify({ type: 'subscribe', dashboardId: '../bad' }),
    )

    expect(parsed).toBeNull()
  })

  it('rejects unknown message types', () => {
    const parsed = parseClientMessage(JSON.stringify({ type: 'dance' }))
    expect(parsed).toBeNull()
  })

  it('validates dashboard id format directly', () => {
    expect(isValidDashboardId('dash-001')).toBe(true)
    expect(isValidDashboardId('dash/001')).toBe(false)
  })
})
