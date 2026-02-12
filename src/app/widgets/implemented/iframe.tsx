import { z } from 'zod'
import type { Widget, WidgetRenderProps } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'

export const iframeWidgetConfigSchema = z.object({
  url: z.string().url().default('https://example.com'),
  showHeader: z.boolean().default(true),
  allowScripts: z.boolean().default(false),
  allowSameOrigin: z.boolean().default(false),
  allowForms: z.boolean().default(false),
  allowPopups: z.boolean().default(false),
  allowInsecureHttp: z.boolean().default(false),
})

export type IframeWidgetConfig = z.infer<typeof iframeWidgetConfigSchema>

function resolveIframeUrl(
  rawUrl: string,
  allowInsecureHttp: boolean,
): { url: string | null; error: string | null } {
  const value = rawUrl.trim()
  if (!value) {
    return { url: null, error: 'Set a URL in widget settings to start.' }
  }

  try {
    const parsed = new URL(value)
    const protocol = parsed.protocol.toLowerCase()

    if (protocol !== 'https:' && protocol !== 'http:') {
      return {
        url: null,
        error:
          'Only HTTP(S) URLs are allowed. File, javascript, and data URLs are blocked.',
      }
    }

    if (protocol === 'http:') {
      const isLocalhost =
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1'

      if (!allowInsecureHttp && !isLocalhost) {
        return {
          url: null,
          error:
            'HTTP URL blocked. Use HTTPS or enable "allowInsecureHttp" for trusted local/test targets.',
        }
      }
    }

    return { url: parsed.toString(), error: null }
  } catch {
    return { url: null, error: 'Invalid URL format.' }
  }
}

function getSandboxValue(config: IframeWidgetConfig): string {
  const tokens: Array<string> = []

  if (config.allowScripts) tokens.push('allow-scripts')
  if (config.allowSameOrigin) tokens.push('allow-same-origin')
  if (config.allowForms) tokens.push('allow-forms')
  if (config.allowPopups) {
    tokens.push('allow-popups', 'allow-popups-to-escape-sandbox')
  }

  return tokens.join(' ')
}

export function IframeWidget({
  config,
}: WidgetRenderProps<IframeWidgetConfig>): React.ReactElement {
  const resolved = resolveIframeUrl(config.url, config.allowInsecureHttp)
  const sandbox = getSandboxValue(config)

  return (
    <GlassCard className="h-full overflow-hidden p-0">
      {config.showHeader && (
        <div className="flex items-center justify-between border-b border-white/10 bg-black/20 px-3 py-2">
          <p className="truncate text-xs font-medium text-white/80">
            Embedded page
          </p>
          {resolved.url && (
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <a
                href={resolved.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
              >
                Open
              </a>
            </Button>
          )}
        </div>
      )}

      {!resolved.url ? (
        <div className="flex h-full items-center justify-center p-4 text-center">
          <p className="text-xs text-white/60">{resolved.error}</p>
        </div>
      ) : (
        <iframe
          title="Embedded content"
          src={resolved.url}
          className="h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox={sandbox}
        />
      )}
    </GlassCard>
  )
}

export const iframeWidgetDefinition: Widget<typeof iframeWidgetConfigSchema> = {
  type: 'iframe',
  displayName: 'Iframe Embed',
  description:
    'Embed external pages with configurable sandbox permissions (secure by default)',
  icon: 'browser',
  category: 'custom',
  configSchema: iframeWidgetConfigSchema,
  defaultConfig: {
    url: 'https://example.com',
    showHeader: true,
    allowScripts: false,
    allowSameOrigin: false,
    allowForms: false,
    allowPopups: false,
    allowInsecureHttp: false,
  },
  defaultSize: { w: 4, h: 3 },
  minSize: { w: 2, h: 2 },
  maxSize: { w: 12, h: 8 },
}
