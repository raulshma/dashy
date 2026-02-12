import { useMemo } from 'react'
import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
)

export const jsonRendererWidgetConfigSchema = z.object({
  data: z.record(z.string(), jsonValueSchema).default({
    status: 'ok',
    service: 'dashy',
    metrics: {
      uptime: 99.95,
      latencyMs: 42,
      healthy: true,
    },
  }),
  collapsedDepth: z.number().int().min(0).max(8).default(1),
  showLineNumbers: z.boolean().default(true),
})

export type JsonRendererWidgetConfig = z.infer<
  typeof jsonRendererWidgetConfigSchema
>

function JsonPrimitive({ value }: { value: unknown }): React.ReactElement {
  if (value === null) {
    return <span className="text-fuchsia-300">null</span>
  }

  if (typeof value === 'string') {
    return <span className="text-emerald-300">"{value}"</span>
  }

  if (typeof value === 'number') {
    return <span className="text-amber-300">{value}</span>
  }

  if (typeof value === 'boolean') {
    return <span className="text-sky-300">{String(value)}</span>
  }

  return <span className="text-white/70">{String(value)}</span>
}

function JsonNode({
  value,
  depth,
  collapsedDepth,
  line,
  showLineNumbers,
}: {
  value: unknown
  depth: number
  collapsedDepth: number
  line: string
  showLineNumbers: boolean
}): React.ReactElement {
  const indentClass = depth > 0 ? 'pl-4 border-l border-white/10' : ''

  if (value === null || typeof value !== 'object') {
    return (
      <div className={`font-mono text-xs leading-5 ${indentClass}`}>
        {showLineNumbers && (
          <span className="mr-2 inline-block min-w-8 select-none text-right text-white/30">
            {line}
          </span>
        )}
        <JsonPrimitive value={value} />
      </div>
    )
  }

  if (Array.isArray(value)) {
    const defaultOpen = depth < collapsedDepth

    return (
      <details open={defaultOpen} className={indentClass}>
        <summary className="cursor-pointer list-none font-mono text-xs leading-5 text-white/80 marker:content-none">
          {showLineNumbers && (
            <span className="mr-2 inline-block min-w-8 select-none text-right text-white/30">
              {line}
            </span>
          )}
          <span className="text-white/80">Array</span>{' '}
          <span className="text-white/40">({value.length})</span>
        </summary>
        <div className="mt-1 space-y-0.5">
          {value.map((item, index) => (
            <div key={`${line}-${index}`} className="flex gap-1">
              <span className="font-mono text-xs text-white/50">[{index}]</span>
              <JsonNode
                value={item}
                depth={depth + 1}
                collapsedDepth={collapsedDepth}
                line={`${line}.${index + 1}`}
                showLineNumbers={showLineNumbers}
              />
            </div>
          ))}
        </div>
      </details>
    )
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  const defaultOpen = depth < collapsedDepth

  return (
    <details open={defaultOpen} className={indentClass}>
      <summary className="cursor-pointer list-none font-mono text-xs leading-5 text-white/80 marker:content-none">
        {showLineNumbers && (
          <span className="mr-2 inline-block min-w-8 select-none text-right text-white/30">
            {line}
          </span>
        )}
        <span className="text-white/80">Object</span>{' '}
        <span className="text-white/40">({entries.length})</span>
      </summary>
      <div className="mt-1 space-y-0.5">
        {entries.map(([key, child], index) => (
          <div key={`${line}-${key}`} className="flex gap-1">
            <span className="font-mono text-xs text-violet-300">"{key}":</span>
            <JsonNode
              value={child}
              depth={depth + 1}
              collapsedDepth={collapsedDepth}
              line={`${line}.${index + 1}`}
              showLineNumbers={showLineNumbers}
            />
          </div>
        ))}
      </div>
    </details>
  )
}

export function JsonRendererWidget({
  config,
}: WidgetRenderProps<JsonRendererWidgetConfig>): React.ReactElement {
  const normalized = useMemo(() => config.data ?? {}, [config.data])

  return (
    <GlassCard className="h-full overflow-auto p-3">
      <JsonNode
        value={normalized}
        depth={0}
        collapsedDepth={config.collapsedDepth}
        line="1"
        showLineNumbers={config.showLineNumbers}
      />
    </GlassCard>
  )
}

export const jsonRendererWidgetDefinition: Widget<typeof jsonRendererWidgetConfigSchema> =
  {
    type: 'json-renderer',
    displayName: 'JSON Renderer',
    description: 'Pretty-print and inspect JSON with collapsible objects/arrays',
    icon: 'code',
    category: 'custom',
    configSchema: jsonRendererWidgetConfigSchema,
    defaultConfig: {
      data: {
        status: 'ok',
        service: 'dashy',
        metrics: {
          uptime: 99.95,
          latencyMs: 42,
          healthy: true,
        },
      },
      collapsedDepth: 1,
      showLineNumbers: true,
    },
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    maxSize: { w: 8, h: 8 },
  }
