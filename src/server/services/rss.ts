export interface RssItem {
  id: string
  title: string
  link: string
  description?: string
  pubDate?: string
  author?: string
  source?: string
}

export interface RssFeed {
  id: string
  title: string
  description?: string
  link?: string
  items: Array<RssItem>
  fetchedAt: Date
  error?: string
}

export interface FetchResult {
  success: boolean
  feed?: RssFeed
  error?: string
}

const feedCache = new Map<string, { feed: RssFeed; expiresAt: number }>()
const DEFAULT_TTL_MS = 15 * 60 * 1000

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

function parseRssFeed(xmlText: string): RssFeed {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'application/xml')

  const parseError = doc.querySelector('parsererror')
  if (parseError) {
    throw new Error('Invalid RSS/Atom feed format')
  }

  const isAtom = doc.querySelector('feed') !== null
  const items: Array<RssItem> = []

  if (isAtom) {
    const feed = doc.querySelector('feed')
    const feedTitle =
      feed?.querySelector('title')?.textContent || 'Untitled Feed'
    const feedLink =
      feed?.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
      feed?.querySelector('link')?.getAttribute('href') ||
      undefined

    const entries = doc.querySelectorAll('entry')
    entries.forEach((entry) => {
      const id = entry.querySelector('id')?.textContent || generateId()
      const title = entry.querySelector('title')?.textContent || 'Untitled'
      const link =
        entry.querySelector('link[rel="alternate"]')?.getAttribute('href') ||
        entry.querySelector('link')?.getAttribute('href') ||
        ''
      const description =
        entry.querySelector('summary')?.textContent ||
        entry.querySelector('content')?.textContent ||
        undefined
      const pubDate =
        entry.querySelector('published')?.textContent ||
        entry.querySelector('updated')?.textContent ||
        undefined
      const author =
        entry.querySelector('author name')?.textContent || undefined

      items.push({
        id,
        title: title.trim(),
        link,
        description: description?.trim(),
        pubDate,
        author,
        source: feedTitle,
      })
    })

    return {
      id: generateId(),
      title: feedTitle,
      link: feedLink,
      items,
      fetchedAt: new Date(),
    }
  } else {
    const channel = doc.querySelector('channel')
    const feedTitle =
      channel?.querySelector('title')?.textContent || 'Untitled Feed'
    const feedLink = channel?.querySelector('link')?.textContent || undefined
    const feedDescription =
      channel?.querySelector('description')?.textContent || undefined

    const rssItems = doc.querySelectorAll('item')
    rssItems.forEach((item) => {
      const id = item.querySelector('guid')?.textContent || generateId()
      const title = item.querySelector('title')?.textContent || 'Untitled'
      const link = item.querySelector('link')?.textContent || ''
      const description =
        item.querySelector('description')?.textContent || undefined
      const pubDate = item.querySelector('pubDate')?.textContent || undefined
      const author =
        item.querySelector('author')?.textContent ||
        item.querySelector('dc\\:creator, creator')?.textContent ||
        undefined

      items.push({
        id,
        title: title.trim(),
        link,
        description: description?.trim(),
        pubDate,
        author,
        source: feedTitle,
      })
    })

    return {
      id: generateId(),
      title: feedTitle,
      description: feedDescription,
      link: feedLink,
      items,
      fetchedAt: new Date(),
    }
  }
}

export async function fetchRssFeed(
  url: string,
  options?: { timeout?: number; ttlMs?: number },
): Promise<FetchResult> {
  const { timeout = 10000, ttlMs = DEFAULT_TTL_MS } = options || {}
  const cacheKey = url

  const cached = feedCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { success: true, feed: cached.feed }
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Dashy-RSS/1.0',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const xmlText = await response.text()
    const feed = parseRssFeed(xmlText)

    feedCache.set(cacheKey, {
      feed,
      expiresAt: Date.now() + ttlMs,
    })

    return { success: true, feed }
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.name === 'AbortError'
          ? `Request timed out after ${timeout}ms`
          : error.message
        : 'Unknown error'

    return {
      success: false,
      error: errorMessage,
    }
  }
}

export function getCachedFeed(url: string): RssFeed | null {
  const cached = feedCache.get(url)
  return cached?.feed ?? null
}

export function clearFeedCache(url?: string): void {
  if (url) {
    feedCache.delete(url)
  } else {
    feedCache.clear()
  }
}

export function getCacheStats(): { size: number; urls: Array<string> } {
  return {
    size: feedCache.size,
    urls: Array.from(feedCache.keys()),
  }
}

const refreshIntervals = new Map<string, ReturnType<typeof setInterval>>()

export function startFeedRefresh(
  feedId: string,
  url: string,
  intervalMs: number,
  onRefresh?: (result: FetchResult) => void,
): void {
  stopFeedRefresh(feedId)

  const run = async () => {
    const result = await fetchRssFeed(url)
    onRefresh?.(result)
  }

  run()

  const intervalId = setInterval(run, intervalMs)
  refreshIntervals.set(feedId, intervalId)
}

export function stopFeedRefresh(feedId: string): boolean {
  const intervalId = refreshIntervals.get(feedId)
  if (intervalId) {
    clearInterval(intervalId)
    refreshIntervals.delete(feedId)
    return true
  }
  return false
}

export function stopAllFeedRefresh(): void {
  for (const feedId of refreshIntervals.keys()) {
    stopFeedRefresh(feedId)
  }
}
