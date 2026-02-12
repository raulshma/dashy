import { registerWidget } from '../registry'
import { HealthCheckWidget, healthCheckWidgetDefinition } from './health-check'
import { AppLauncherWidget, appLauncherWidgetDefinition } from './app-launcher'
import { RssWidget, rssWidgetDefinition } from './rss'
import { WeatherWidget, weatherWidgetDefinition } from './weather'
import { MarkdownWidget, markdownWidgetDefinition } from './markdown'

export function registerBuiltinWidgets(): void {
  registerWidget({
    definition: healthCheckWidgetDefinition,
    component: HealthCheckWidget,
  })
  registerWidget({
    definition: appLauncherWidgetDefinition,
    component: AppLauncherWidget,
  })
  registerWidget({
    definition: rssWidgetDefinition,
    component: RssWidget,
  })
  registerWidget({
    definition: weatherWidgetDefinition,
    component: WeatherWidget,
  })
  registerWidget({
    definition: markdownWidgetDefinition,
    component: MarkdownWidget,
  })
}

export { HealthCheckWidget, healthCheckWidgetDefinition } from './health-check'
export { AppLauncherWidget, appLauncherWidgetDefinition } from './app-launcher'
export { RssWidget, rssWidgetDefinition } from './rss'
export { WeatherWidget, weatherWidgetDefinition } from './weather'
export { MarkdownWidget, markdownWidgetDefinition } from './markdown'
