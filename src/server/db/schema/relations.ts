/**
 * Drizzle ORM Relations
 *
 * Defines relationships between tables for the relational query API.
 * These don't create database constraints — they enable Drizzle's
 * `with` clause for eager loading related data.
 */
import { relations } from 'drizzle-orm';
import { users } from './users';
import { dashboards } from './dashboards';
import { pages } from './pages';
import { widgets } from './widgets';
import { widgetConfigs } from './widget-configs';
import { templates } from './templates';
import { shareLinks } from './share-links';
import { dashboardVersions } from './dashboard-versions';

// ── User Relations ─────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  dashboards: many(dashboards),
  templates: many(templates),
}));

// ── Dashboard Relations ────────────────────────
export const dashboardsRelations = relations(
  dashboards,
  ({ one, many }) => ({
    owner: one(users, {
      fields: [dashboards.userId],
      references: [users.id],
    }),
    pages: many(pages),
    shareLinks: many(shareLinks),
    versions: many(dashboardVersions),
  }),
);

// ── Page Relations ─────────────────────────────
export const pagesRelations = relations(pages, ({ one, many }) => ({
  dashboard: one(dashboards, {
    fields: [pages.dashboardId],
    references: [dashboards.id],
  }),
  widgets: many(widgets),
}));

// ── Widget Relations ───────────────────────────
export const widgetsRelations = relations(widgets, ({ one, many }) => ({
  page: one(pages, {
    fields: [widgets.pageId],
    references: [pages.id],
  }),
  configs: many(widgetConfigs),
}));

// ── Widget Config Relations ────────────────────
export const widgetConfigsRelations = relations(
  widgetConfigs,
  ({ one }) => ({
    widget: one(widgets, {
      fields: [widgetConfigs.widgetId],
      references: [widgets.id],
    }),
  }),
);

// ── Template Relations ─────────────────────────
export const templatesRelations = relations(templates, ({ one }) => ({
  creator: one(users, {
    fields: [templates.createdBy],
    references: [users.id],
  }),
}));

// ── Share Link Relations ───────────────────────
export const shareLinksRelations = relations(shareLinks, ({ one }) => ({
  dashboard: one(dashboards, {
    fields: [shareLinks.dashboardId],
    references: [dashboards.id],
  }),
}));

// ── Dashboard Version Relations ────────────────
export const dashboardVersionsRelations = relations(
  dashboardVersions,
  ({ one }) => ({
    dashboard: one(dashboards, {
      fields: [dashboardVersions.dashboardId],
      references: [dashboards.id],
    }),
  }),
);
