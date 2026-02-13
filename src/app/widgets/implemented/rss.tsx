import { useEffect, useRef, useState } from 'react'
import { z } from 'zod'
import {
  Globe02Icon,
  Loading03Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons'
import { fetchRssFeedFn } from '@server/api/rss'
import { formatDistanceToNow } from 'date-fns'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import type { RssFeed, RssItem } from '@server/services/rss'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'

export const rssWidgetConfigSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  itemCount: z.number().int().min(1).max(20).default(5),
  refreshInterval: z.number().int().min(60000).max(3600000).default(300000),
  showDescription: z.boolean().default(false),
  showDate: z.boolean().default(true),
})

export type RssWidgetConfig = z.infer<typeof rssWidgetConfigSchema>

function FeedItem({
  item,
  showDescription,
  showDate,
}: {
  item: RssItem
  showDescription: boolean
  showDate: boolean
}) {
  const [expanded, setExpanded] = useState(false)

  const handleClick = () => {
    window.open(item.link, '_blank', 'noopener,noreferrer')
  }

  const description = item.description?.replace(/<[^>]*>/g, '').trim() || ''

  return (
    <div
      className="py-2 border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5 -mx-2 px-2 rounded transition-colors"
      onClick={handleClick}
    >
      <h4 className="text-sm font-medium leading-tight line-clamp-2">
        {item.title}
      </h4>
      {showDescription && description && (
        <p
          className={`text-xs text-muted-foreground mt-1 ${expanded ? '' : 'line-clamp-2'}`}
          onClick={(e) => {
            e.stopPropagation()
            setExpanded(!expanded)
          }}
        >
          {description}
        </p>
      )}
      {showDate && item.pubDate && (
        <p className="text-xs text-muted-foreground/60 mt-1">
          {formatDistanceToNow(new Date(item.pubDate), { addSuffix: true })}
        </p>
      )}
    </div>
  )
}

export function RssWidget({ config }: WidgetRenderProps<RssWidgetConfig>) {
  const [feed, setFeed] = useState<RssFeed | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<number | null>(null)

  const fetchFeed = async () => {
    try {
      const result = await fetchRssFeedFn({
        data: {
          url: config.url,
          timeout: 15000,
        },
      })

      if (result.success && result.data) {
        setFeed(result.data.feed)
        setError(null)
      } else {
        setError(result.error?.message || 'Failed to fetch feed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!config.url) return

    fetchFeed()

    if (config.refreshInterval > 0) {
      intervalRef.current = window.setInterval(
        fetchFeed,
        config.refreshInterval,
      )
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [config.url, config.refreshInterval])

  const items = feed?.items.slice(0, config.itemCount) || []

  if (!config.url) {
    return (
      <GlassCard className="h-full p-4 flex flex-col items-center justify-center gap-2 text-muted-foreground">
        <Icon icon={Globe02Icon} size="xl" />
        <p className="text-sm text-center">Configure RSS feed URL</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="h-full p-3 flex flex-col gap-2 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            icon={Globe02Icon}
            size="sm"
            className="text-orange-400 shrink-0"
          />
          <h3 className="text-sm font-medium truncate">
            {config.title || feed?.title || 'RSS Feed'}
          </h3>
        </div>
        <button
          onClick={() => {
            setLoading(true)
            fetchFeed()
          }}
          className="p-1 rounded hover:bg-white/10 transition-colors shrink-0"
          title="Refresh"
        >
          <Icon
            icon={loading ? Loading03Icon : RefreshIcon}
            size="sm"
            className={loading ? 'animate-spin' : ''}
          />
        </button>
      </div>

      {loading && !feed && (
        <div className="flex-1 flex items-center justify-center">
          <Icon
            icon={Loading03Icon}
            size="lg"
            className="animate-spin text-muted-foreground"
          />
        </div>
      )}

      {error && !feed && (
        <div className="flex-1 flex flex-col items-center justify-center text-red-400">
          <p className="text-sm text-center">{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              setError(null)
              fetchFeed()
            }}
            className="text-xs text-muted-foreground hover:text-foreground mt-2"
          >
            Retry
          </button>
        </div>
      )}

      {feed && (
        <div className="flex-1 overflow-y-auto -mr-1 pr-1">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No items in feed
            </p>
          ) : (
            items.map((item) => (
              <FeedItem
                key={item.id}
                item={item}
                showDescription={config.showDescription}
                showDate={config.showDate}
              />
            ))
          )}
        </div>
      )}
    </GlassCard>
  )
}

export const rssWidgetDefinition: Widget<typeof rssWidgetConfigSchema> = {
  type: 'rss',
  displayName: 'RSS Feed',
  description: 'Display items from an RSS or Atom feed',
  icon: 'rss',
  category: 'media',
  configSchema: rssWidgetConfigSchema,
  defaultConfig: {
    url: '',
    itemCount: 5,
    refreshInterval: 300000,
    showDescription: false,
    showDate: true,
  },
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 6, h: 4 },
}
