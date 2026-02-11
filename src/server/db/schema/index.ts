/**
 * Schema Barrel Export
 *
 * Re-exports all schema tables and relations from a single entry point.
 * Import with: `import * as schema from '@server/db/schema'`
 */

// ── Tables ─────────────────────────────────────
export { users } from './users';
export type { InsertUser, SelectUser } from './users';

export { dashboards } from './dashboards';
export type { InsertDashboard, SelectDashboard } from './dashboards';

export { pages } from './pages';
export type { InsertPage, SelectPage } from './pages';

export { widgets } from './widgets';
export type { InsertWidget, SelectWidget } from './widgets';

export { widgetConfigs } from './widget-configs';
export type { InsertWidgetConfig, SelectWidgetConfig } from './widget-configs';

export { templates } from './templates';
export type {
  InsertTemplate,
  SelectTemplate,
  TemplateSchema,
} from './templates';

export { shareLinks } from './share-links';
export type { InsertShareLink, SelectShareLink } from './share-links';

export { dashboardVersions } from './dashboard-versions';
export type {
  InsertDashboardVersion,
  SelectDashboardVersion,
  DashboardSnapshot,
} from './dashboard-versions';

// ── Relations ──────────────────────────────────
export {
  usersRelations,
  dashboardsRelations,
  pagesRelations,
  widgetsRelations,
  widgetConfigsRelations,
  templatesRelations,
  shareLinksRelations,
  dashboardVersionsRelations,
} from './relations';
