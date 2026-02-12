import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

export type ApiFetchMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS'

export interface ApiFetchConfig {
  url: string
  method?: ApiFetchMethod
  headers?: Record<string, string>
  body?: string
  timeoutMs?: number
  maxResponseBytes?: number
  allowInsecureHttp?: boolean
  allowPrivateNetworks?: boolean
}

export interface ApiFetchResponse {
  requestUrl: string
  finalUrl: string
  method: ApiFetchMethod
  ok: boolean
  status: number
  statusText: string
  durationMs: number
  fetchedAt: string
  contentType: string | null
  bodyType: 'json' | 'text' | 'empty'
  body: unknown
  truncated: boolean
  responseHeaders: Record<string, string>
}

export interface ApiFetchResult {
  success: boolean
  data?: ApiFetchResponse
  error?: string
}

interface HostSafetyCacheEntry {
  isPrivate: boolean
  expiresAt: number
}

const HOST_SAFETY_CACHE_TTL_MS = 5 * 60 * 1000
const MAX_REDIRECTS = 3
const DEFAULT_TIMEOUT_MS = 10000
const DEFAULT_MAX_RESPONSE_BYTES = 64 * 1024

const hostSafetyCache = new Map<string, HostSafetyCacheEntry>()

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
  '::',
  '::1',
])

const FORBIDDEN_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-connection',
])

function normalizeHostname(hostname: string): string {
  const clean = hostname.trim().toLowerCase()
  return clean.startsWith('[') && clean.endsWith(']')
    ? clean.slice(1, -1)
    : clean
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number(part))
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true
  }

  const [a, b] = parts

  if (a === 10) return true
  if (a === 127) return true
  if (a === 0) return true
  if (a === 169 && b === 254) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true

  return false
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase().split('%')[0]

  if (normalized === '::1' || normalized === '::') return true
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9')) return true
  if (normalized.startsWith('fea') || normalized.startsWith('feb')) return true

  return false
}

function isPrivateIpAddress(ip: string): boolean {
  const ipVersion = isIP(ip)
  if (ipVersion === 4) return isPrivateIPv4(ip)
  if (ipVersion === 6) return isPrivateIPv6(ip)
  return true
}

async function isPrivateHostname(hostname: string): Promise<boolean> {
  const normalized = normalizeHostname(hostname)

  if (BLOCKED_HOSTNAMES.has(normalized)) {
    return true
  }

  if (isIP(normalized)) {
    return isPrivateIpAddress(normalized)
  }

  const cached = hostSafetyCache.get(normalized)
  if (cached && cached.expiresAt > Date.now()) {
    return cached.isPrivate
  }

  try {
    const records = await lookup(normalized, { all: true, verbatim: true })
    const isPrivate = records.length
      ? records.some((record) => isPrivateIpAddress(record.address))
      : true

    hostSafetyCache.set(normalized, {
      isPrivate,
      expiresAt: Date.now() + HOST_SAFETY_CACHE_TTL_MS,
    })

    return isPrivate
  } catch {
    return true
  }
}

async function validateTargetUrl(
  rawUrl: string,
  options: {
    allowInsecureHttp: boolean
    allowPrivateNetworks: boolean
  },
): Promise<{ url?: URL; error?: string }> {
  const value = rawUrl.trim()
  if (!value) {
    return { error: 'URL is required' }
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    return { error: 'Invalid URL format' }
  }

  const protocol = parsed.protocol.toLowerCase()
  if (protocol !== 'https:' && protocol !== 'http:') {
    return {
      error:
        'Only HTTP(S) URLs are allowed. file:, data:, and javascript: URLs are blocked.',
    }
  }

  if (protocol === 'http:' && !options.allowInsecureHttp) {
    return {
      error:
        'HTTP URL blocked. Use HTTPS or enable allowInsecureHttp for trusted endpoints.',
    }
  }

  const privateHost = await isPrivateHostname(parsed.hostname)
  if (privateHost && !options.allowPrivateNetworks) {
    return {
      error:
        'Private/local network targets are blocked by default. Enable allowPrivateNetworks only for trusted APIs.',
    }
  }

  return { url: parsed }
}

function sanitizeHeaders(
  headers: Record<string, string> | undefined,
): Record<string, string> {
  const sanitized: Record<string, string> = {
    'User-Agent': 'Dashy-ApiFetch/1.0',
    Accept: 'application/json, text/plain;q=0.9, */*;q=0.5',
  }

  if (!headers) return sanitized

  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.trim()
    const lowerKey = key.toLowerCase()

    if (!key || FORBIDDEN_HEADERS.has(lowerKey)) continue
    if (key.includes('\n') || key.includes('\r')) continue

    const value = rawValue.trim()
    if (value.includes('\n') || value.includes('\r')) continue

    sanitized[key] = value
  }

  return sanitized
}

function parseContentType(contentType: string | null): {
  isJson: boolean
  isText: boolean
} {
  if (!contentType) return { isJson: false, isText: true }

  const normalized = contentType.toLowerCase()
  const isJson =
    normalized.includes('application/json') || normalized.includes('+json')
  const isText =
    normalized.startsWith('text/') ||
    isJson ||
    normalized.includes('xml') ||
    normalized.includes('javascript') ||
    normalized.includes('application/x-www-form-urlencoded')

  return { isJson, isText }
}

function collectResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const [key, value] of response.headers.entries()) {
    headers[key] = value
  }
  return headers
}

async function fetchWithRedirectValidation(
  requestUrl: URL,
  requestInit: RequestInit,
  options: {
    allowInsecureHttp: boolean
    allowPrivateNetworks: boolean
  },
): Promise<{ response: Response; finalUrl: string }> {
  let currentUrl = requestUrl

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(currentUrl, {
      ...requestInit,
      redirect: 'manual',
    })

    const isRedirect = response.status >= 300 && response.status < 400
    if (!isRedirect) {
      return { response, finalUrl: currentUrl.toString() }
    }

    const location = response.headers.get('location')
    if (!location) {
      throw new Error('Redirect response missing Location header')
    }

    if (redirectCount === MAX_REDIRECTS) {
      throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`)
    }

    const nextUrl = new URL(location, currentUrl)
    const validation = await validateTargetUrl(nextUrl.toString(), options)
    if (!validation.url) {
      throw new Error(validation.error || 'Blocked redirect target')
    }

    currentUrl = validation.url
  }

  throw new Error('Request failed due to redirect handling')
}

export async function fetchApiData(
  config: ApiFetchConfig,
): Promise<ApiFetchResult> {
  const method = (config.method ?? 'GET').toUpperCase() as ApiFetchMethod
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxResponseBytes = config.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const allowInsecureHttp = config.allowInsecureHttp ?? false
  const allowPrivateNetworks = config.allowPrivateNetworks ?? false

  try {
    const validation = await validateTargetUrl(config.url, {
      allowInsecureHttp,
      allowPrivateNetworks,
    })

    if (!validation.url) {
      return {
        success: false,
        error: validation.error || 'Invalid URL',
      }
    }

    const headers = sanitizeHeaders(config.headers)
    const controller = new AbortController()
    const startedAt = performance.now()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    let response: Response
    let finalUrl: string

    try {
      const fetchResult = await fetchWithRedirectValidation(
        validation.url,
        {
          method,
          headers,
          body:
            method === 'GET' || method === 'HEAD'
              ? undefined
              : (config.body ?? ''),
          signal: controller.signal,
        },
        { allowInsecureHttp, allowPrivateNetworks },
      )

      response = fetchResult.response
      finalUrl = fetchResult.finalUrl
    } finally {
      clearTimeout(timeoutId)
    }

    const contentType = response.headers.get('content-type')
    const contentLengthHeader = response.headers.get('content-length')
    const contentLength = contentLengthHeader ? Number(contentLengthHeader) : 0

    if (Number.isFinite(contentLength) && contentLength > maxResponseBytes) {
      return {
        success: false,
        error: `Response too large (${contentLength} bytes). Increase maxResponseBytes if you trust this endpoint.`,
      }
    }

    const { isJson, isText } = parseContentType(contentType)
    let bodyType: ApiFetchResponse['bodyType'] = 'empty'
    let body: unknown = null
    let truncated = false

    if (method !== 'HEAD' && response.status !== 204) {
      if (!isText) {
        bodyType = 'text'
        body = 'Binary response omitted (non-text content type)'
      } else {
        const text = await response.text()
        const safeText =
          text.length > maxResponseBytes
            ? text.slice(0, maxResponseBytes)
            : text

        if (text.length > maxResponseBytes) {
          truncated = true
        }

        if (isJson) {
          try {
            body = JSON.parse(safeText)
            bodyType = 'json'
          } catch {
            body = safeText
            bodyType = 'text'
          }
        } else {
          body = safeText
          bodyType = 'text'
        }
      }
    }

    const durationMs = Math.round(performance.now() - startedAt)

    return {
      success: true,
      data: {
        requestUrl: validation.url.toString(),
        finalUrl,
        method,
        ok: response.ok,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        fetchedAt: new Date().toISOString(),
        contentType,
        bodyType,
        body,
        truncated,
        responseHeaders: collectResponseHeaders(response),
      },
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `Request timed out after ${timeoutMs}ms`
          : error.message
        : 'Unknown request error'

    return {
      success: false,
      error: message,
    }
  }
}
