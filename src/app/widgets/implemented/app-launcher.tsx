import { useState, useMemo, useRef, useEffect } from 'react'
import { z } from 'zod'
import type { WidgetDefinition, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Icon } from '@/components/ui/icon'
import {
  Link02Icon,
  Add01Icon,
  Search01Icon,
  Folder01Icon,
} from '@hugeicons/core-free-icons'

export const bookmarkSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  url: z.string().url(),
  icon: z.string().optional(),
  groupId: z.string().optional(),
})

export const groupSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  color: z.string().optional(),
  collapsed: z.boolean().optional(),
})

export const appLauncherConfigSchema = z.object({
  bookmarks: z.array(bookmarkSchema).default([]),
  groups: z.array(groupSchema).default([]),
  showSearch: z.boolean().default(true),
  columns: z.number().int().min(2).max(8).default(4),
})

export type Bookmark = z.infer<typeof bookmarkSchema>
export type Group = z.infer<typeof groupSchema>
export type AppLauncherWidgetConfig = z.infer<typeof appLauncherConfigSchema>

function getFaviconUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`
  } catch {
    return ''
  }
}

function BookmarkItem({
  bookmark,
  onClick,
}: {
  bookmark: Bookmark
  onClick: () => void
}) {
  const iconSrc = bookmark.icon || getFaviconUrl(bookmark.url)

  return (
    <button
      onClick={onClick}
      className="group flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50"
      title={bookmark.name}
    >
      <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center overflow-hidden group-hover:bg-white/20 transition-colors">
        {iconSrc ? (
          <img
            src={iconSrc}
            alt={bookmark.name}
            className="w-6 h-6 object-contain"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <Icon icon={Link02Icon} size="md" className="text-muted-foreground" />
        )}
      </div>
      <span className="text-xs text-muted-foreground group-hover:text-foreground truncate max-w-full text-center">
        {bookmark.name}
      </span>
    </button>
  )
}

function GroupHeader({
  group,
  collapsed,
  onToggle,
  count,
}: {
  group: Group
  collapsed: boolean
  onToggle: () => void
  count: number
}) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors text-left"
    >
      <div style={{ color: group.color || 'currentColor' }}>
        <Icon
          icon={Folder01Icon}
          size="sm"
          className={collapsed ? '' : 'rotate-90'}
        />
      </div>
      <span className="text-sm font-medium">{group.name}</span>
      <span className="text-xs text-muted-foreground ml-auto">{count}</span>
    </button>
  )
}

export function AppLauncherWidget({
  config,
  isEditing,
}: WidgetRenderProps<AppLauncherWidgetConfig>) {
  const [search, setSearch] = useState('')
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(config.groups.filter((g) => g.collapsed).map((g) => g.id)),
  )
  const searchInputRef = useRef<HTMLInputElement>(null)

  const filteredBookmarks = useMemo(() => {
    if (!search.trim()) return config.bookmarks
    const query = search.toLowerCase()
    return config.bookmarks.filter((b) => b.name.toLowerCase().includes(query))
  }, [config.bookmarks, search])

  const groupedBookmarks = useMemo(() => {
    const groups = new Map<string | undefined, Bookmark[]>()
    for (const bookmark of filteredBookmarks) {
      const groupId = bookmark.groupId
      if (!groups.has(groupId)) {
        groups.set(groupId, [])
      }
      groups.get(groupId)!.push(bookmark)
    }
    return groups
  }, [filteredBookmarks])

  const ungroupedBookmarks = groupedBookmarks.get(undefined) || []
  const groupsWithBookmarks = config.groups.filter((g) =>
    groupedBookmarks.has(g.id),
  )

  const handleOpenBookmark = (bookmark: Bookmark) => {
    window.open(bookmark.url, '_blank', 'noopener,noreferrer')
  }

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) {
        next.delete(groupId)
      } else {
        next.add(groupId)
      }
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k' && config.showSearch) {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config.showSearch])

  const gridStyle = {
    gridTemplateColumns: `repeat(${config.columns}, minmax(0, 1fr))`,
  }

  return (
    <GlassCard className="h-full p-3 flex flex-col gap-2 overflow-hidden">
      {config.showSearch && (
        <div className="relative">
          <Icon
            icon={Search01Icon}
            size="sm"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search... (Ctrl+K)"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-white/5 rounded-lg border border-white/10 focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto -mr-1 pr-1 space-y-3">
        {ungroupedBookmarks.length > 0 && (
          <div className="grid gap-1" style={gridStyle}>
            {ungroupedBookmarks.map((bookmark) => (
              <BookmarkItem
                key={bookmark.id}
                bookmark={bookmark}
                onClick={() => handleOpenBookmark(bookmark)}
              />
            ))}
          </div>
        )}

        {groupsWithBookmarks.map((group) => {
          const bookmarks = groupedBookmarks.get(group.id) || []
          const isCollapsed = collapsedGroups.has(group.id)

          return (
            <div key={group.id} className="space-y-1">
              <GroupHeader
                group={group}
                collapsed={isCollapsed}
                onToggle={() => toggleGroup(group.id)}
                count={bookmarks.length}
              />
              {!isCollapsed && (
                <div className="grid gap-1 pl-4" style={gridStyle}>
                  {bookmarks.map((bookmark) => (
                    <BookmarkItem
                      key={bookmark.id}
                      bookmark={bookmark}
                      onClick={() => handleOpenBookmark(bookmark)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {config.bookmarks.length === 0 && !isEditing && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Icon icon={Add01Icon} size="xl" className="mb-2 opacity-50" />
            <p className="text-sm">Add bookmarks to get started</p>
          </div>
        )}
      </div>
    </GlassCard>
  )
}

export const appLauncherWidgetDefinition: WidgetDefinition<AppLauncherWidgetConfig> =
  {
    type: 'app-launcher',
    displayName: 'App Launcher',
    description: 'Quick access grid of bookmarks and links',
    icon: 'link',
    category: 'productivity',
    configSchema: appLauncherConfigSchema,
    defaultConfig: {
      bookmarks: [],
      groups: [],
      showSearch: true,
      columns: 4,
    },
    defaultSize: { w: 3, h: 2 },
    minSize: { w: 2, h: 1 },
    maxSize: { w: 6, h: 4 },
  }
