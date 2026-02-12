/**
 * Shared schemas — barrel export.
 *
 * Import via: `import { createDashboardSchema, loginSchema } from '@shared/schemas'`
 */
export {
  createDashboardSchema,
  updateDashboardSchema,
  createPageSchema,
  paginationSchema,
  addWidgetSchema,
  updateWidgetPositionSchema,
  batchUpdatePositionsSchema,
  createShareLinkSchema,
  registerSchema,
  loginSchema,
} from './dashboard'

export {
  yamlLayoutSchema,
  yamlWidgetSchema,
  yamlPageSchema,
  dashboardYamlSchema,
} from './dashboard.yaml.schema'

export type {
  YamlLayout,
  YamlWidget,
  YamlPage,
  DashboardYaml,
} from './dashboard.yaml.schema'
