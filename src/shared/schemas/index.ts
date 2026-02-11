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
