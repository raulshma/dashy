/**
 * Widget Picker — A searchable, categorized grid of available widgets.
 *
 * Used to select a widget type when adding a new widget to a dashboard.
 */
import { useMemo, useState } from 'react'
import { Delete02Icon, Search01Icon } from '@hugeicons/core-free-icons'
import type { WidgetRegistryEntry } from '@/app/widgets'
import { getAllWidgets, getWidgetsByCategory } from '@/app/widgets'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Icon } from '@/components/ui/icon'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface WidgetPickerProps {
  onSelect: (widgetType: string, defaultSize: { w: number; h: number }) => void
  onClose?: () => void
  className?: string
}

const CATEGORY_LABELS: Record<string, string> = {
  monitoring: 'Monitoring',
  productivity: 'Productivity',
  media: 'Media',
  utilities: 'Utilities',
  custom: 'Custom',
  integrations: 'Integrations',
}

const CATEGORY_ORDER = [
  'monitoring',
  'productivity',
  'media',
  'utilities',
  'integrations',
  'custom',
]

function WidgetCard({
  entry,
  onSelect,
}: {
  entry: WidgetRegistryEntry
  onSelect: () => void
}): React.ReactElement {
  const { definition } = entry

  return (
    <GlassCard
      variant="default"
      className="group cursor-pointer p-4 transition-all hover:border-white/30 hover:bg-white/5"
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10">
          <Icon
            icon={definition.icon as never}
            size="lg"
            className="text-white"
          />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium text-white">
            {definition.displayName}
          </h3>
          <p className="mt-1 line-clamp-2 text-xs text-white/60">
            {definition.description}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px]">
              {definition.defaultSize.w}x{definition.defaultSize.h}
            </Badge>
            {entry.capabilities && entry.capabilities.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {entry.capabilities.length} perms
              </Badge>
            )}
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
      <div className="rounded-full bg-white/5 p-3">
        <Icon icon={Delete02Icon} size="lg" className="text-white/40" />
      </div>
      <p className="text-sm text-white/60">No widgets found</p>
      <p className="text-xs text-white/40">Try a different search term</p>
    </div>
  )
}

export function WidgetPicker({
  onSelect,
  onClose,
  className,
}: WidgetPickerProps): React.ReactElement {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  const allWidgets = useMemo(() => getAllWidgets(), [])

  const categories = useMemo(() => {
    const cats = new Set<string>()
    for (const entry of allWidgets) {
      cats.add(entry.definition.category)
    }
    return CATEGORY_ORDER.filter((c) => cats.has(c))
  }, [allWidgets])

  const filteredWidgets = useMemo(() => {
    let widgets = allWidgets

    if (selectedCategory) {
      widgets = getWidgetsByCategory(selectedCategory)
    }

    if (search.trim()) {
      const query = search.toLowerCase().trim()
      widgets = widgets.filter(
        (entry) =>
          entry.definition.displayName.toLowerCase().includes(query) ||
          entry.definition.description.toLowerCase().includes(query) ||
          entry.definition.type.toLowerCase().includes(query),
      )
    }

    return widgets
  }, [allWidgets, selectedCategory, search])

  const groupedWidgets = useMemo(() => {
    const groups: Record<string, Array<WidgetRegistryEntry>> = {}
    for (const entry of filteredWidgets) {
      const cat = entry.definition.category
      groups[cat] ??= []
      groups[cat].push(entry)
    }
    return groups
  }, [filteredWidgets])

  const handleSelect = (
    widgetType: string,
    defaultSize: { w: number; h: number },
  ) => {
    onSelect(widgetType, defaultSize)
    onClose?.()
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 p-4 pb-2">
        <div className="relative flex-1">
          <Icon
            icon={Search01Icon}
            size="sm"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
          />
          <Input
            type="text"
            placeholder="Search widgets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            variant="glass"
          />
        </div>
      </div>

      <div className="flex gap-1 px-4 pb-2">
        <Button
          variant={selectedCategory === null ? 'glass' : 'ghost'}
          size="sm"
          onClick={() => setSelectedCategory(null)}
          className="text-xs"
        >
          All
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? 'glass' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
            className="text-xs"
          >
            {CATEGORY_LABELS[cat] ?? cat}
          </Button>
        ))}
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-4 p-4 pt-0">
          {filteredWidgets.length === 0 ? (
            <EmptyState />
          ) : (
            Object.entries(groupedWidgets).map(([category, widgets]) => (
              <div key={category}>
                {!selectedCategory && (
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/40">
                    {CATEGORY_LABELS[category] ?? category}
                  </h2>
                )}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {widgets.map((entry) => (
                    <WidgetCard
                      key={entry.definition.type}
                      entry={entry}
                      onSelect={() =>
                        handleSelect(
                          entry.definition.type,
                          entry.definition.defaultSize,
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default WidgetPicker
