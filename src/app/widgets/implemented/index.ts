import { lazy } from 'react'
import { registerWidget } from '../registry'
import { healthCheckWidgetDefinition } from './health-check'
import { appLauncherWidgetDefinition } from './app-launcher'
import { rssWidgetDefinition } from './rss'
import { weatherWidgetDefinition } from './weather'
import { markdownWidgetDefinition } from './markdown'
import { iframeWidgetDefinition } from './iframe'
import { jsonRendererWidgetDefinition } from './json-renderer'
import { apiFetchWidgetDefinition } from './api-fetch'
import { notesWidgetDefinition } from './notes'

export function registerBuiltinWidgets(): void {
  registerWidget({
    definition: healthCheckWidgetDefinition,
    component: lazy(() =>
      import('./health-check').then((module) => ({
        default: module.HealthCheckWidget,
      })),
    ),
  })
  registerWidget({
    definition: appLauncherWidgetDefinition,
    component: lazy(() =>
      import('./app-launcher').then((module) => ({
        default: module.AppLauncherWidget,
      })),
    ),
  })
  registerWidget({
    definition: rssWidgetDefinition,
    component: lazy(() =>
      import('./rss').then((module) => ({
        default: module.RssWidget,
      })),
    ),
  })
  registerWidget({
    definition: weatherWidgetDefinition,
    component: lazy(() =>
      import('./weather').then((module) => ({
        default: module.WeatherWidget,
      })),
    ),
  })
  registerWidget({
    definition: markdownWidgetDefinition,
    component: lazy(() =>
      import('./markdown').then((module) => ({
        default: module.MarkdownWidget,
      })),
    ),
  })
  registerWidget({
    definition: iframeWidgetDefinition,
    component: lazy(() =>
      import('./iframe').then((module) => ({
        default: module.IframeWidget,
      })),
    ),
  })
  registerWidget({
    definition: jsonRendererWidgetDefinition,
    component: lazy(() =>
      import('./json-renderer').then((module) => ({
        default: module.JsonRendererWidget,
      })),
    ),
  })
  registerWidget({
    definition: apiFetchWidgetDefinition,
    component: lazy(() =>
      import('./api-fetch').then((module) => ({
        default: module.ApiFetchWidget,
      })),
    ),
  })
  registerWidget({
    definition: notesWidgetDefinition,
    component: lazy(() =>
      import('./notes').then((module) => ({
        default: module.NotesWidget,
      })),
    ),
  })
}
