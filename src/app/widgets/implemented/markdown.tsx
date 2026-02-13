import { z } from 'zod'
import Markdown, { defaultUrlTransform } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'

export const markdownWidgetConfigSchema = z.object({
  content: z.string().max(50000).default('## New note\n\nStart writing...'),
  openLinksInNewTab: z.boolean().default(true),
})

export type MarkdownWidgetConfig = z.infer<typeof markdownWidgetConfigSchema>

export function MarkdownWidget({
  config,
}: WidgetRenderProps<MarkdownWidgetConfig>) {
  const content = config.content.trim()

  if (!content) {
    return (
      <GlassCard className="h-full p-4 flex items-center justify-center text-muted-foreground">
        <p className="text-sm">Add markdown content in widget settings</p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="h-full p-4 overflow-auto">
      <article className="prose prose-sm prose-invert max-w-none prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-code:before:content-none prose-code:after:content-none">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeSanitize]}
          skipHtml
          urlTransform={defaultUrlTransform}
          components={{
            a: ({ href, children, ...props }) => {
              const isExternal =
                typeof href === 'string' && /^(https?:)?\/\//i.test(href)

              return (
                <a
                  href={href}
                  {...props}
                  target={
                    config.openLinksInNewTab && isExternal
                      ? '_blank'
                      : undefined
                  }
                  rel={
                    config.openLinksInNewTab && isExternal
                      ? 'noopener noreferrer nofollow'
                      : undefined
                  }
                >
                  {children}
                </a>
              )
            },
          }}
        >
          {content}
        </Markdown>
      </article>
    </GlassCard>
  )
}

export const markdownWidgetDefinition: Widget<
  typeof markdownWidgetConfigSchema
> = {
  type: 'markdown',
  displayName: 'Markdown',
  description: 'Render rich markdown notes with secure sanitization',
  icon: 'text',
  category: 'productivity',
  configSchema: markdownWidgetConfigSchema,
  defaultConfig: {
    content:
      '## Notes\n\n- Add quick reminders\n- Use **bold**, _italic_, and links\n- Supports tables and checklists',
    openLinksInNewTab: true,
  },
  defaultSize: { w: 3, h: 2 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 8, h: 8 },
}
