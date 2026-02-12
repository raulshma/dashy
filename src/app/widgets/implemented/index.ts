import { registerWidget } from '../registry'
import { HealthCheckWidget, healthCheckWidgetDefinition } from './health-check'
import { AppLauncherWidget, appLauncherWidgetDefinition } from './app-launcher'
import { RssWidget, rssWidgetDefinition } from './rss'
import { WeatherWidget, weatherWidgetDefinition } from './weather'
import { MarkdownWidget, markdownWidgetDefinition } from './markdown'
import { IframeWidget, iframeWidgetDefinition } from './iframe'
import {
  JsonRendererWidget,
  jsonRendererWidgetDefinition,
} from './json-renderer'
import { ApiFetchWidget, apiFetchWidgetDefinition } from './api-fetch'

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
  registerWidget({
    definition: iframeWidgetDefinition,
    component: IframeWidget,
  })
  registerWidget({
    definition: jsonRendererWidgetDefinition,
    component: JsonRendererWidget,
  })
  registerWidget({
    definition: apiFetchWidgetDefinition,
    component: ApiFetchWidget,
  })
}

export { HealthCheckWidget, healthCheckWidgetDefinition } from './health-check'
export { AppLauncherWidget, appLauncherWidgetDefinition } from './app-launcher'
export { RssWidget, rssWidgetDefinition } from './rss'
export { WeatherWidget, weatherWidgetDefinition } from './weather'
export { MarkdownWidget, markdownWidgetDefinition } from './markdown'
export { IframeWidget, iframeWidgetDefinition } from './iframe'
export {
  JsonRendererWidget,
  jsonRendererWidgetDefinition,
} from './json-renderer'
export { ApiFetchWidget, apiFetchWidgetDefinition } from './api-fetch'
