/**
 * YAML Dashboard Schema (Zod)
 *
 * Canonical validation schema for DB ↔ YAML sync payloads.
 */
import { z } from 'zod'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const yamlLayoutSchema = z
  .object({
    columns: z.number().int().min(1).max(24).default(12),
    rowHeight: z.number().int().min(20).max(400).default(80),
    gap: z.number().int().min(0).max(64).default(16),
  })
  .strict()

export const yamlWidgetSchema = z
  .object({
    type: z.string().min(1).max(100),
    title: z.string().max(100).optional(),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    w: z.number().int().min(1).max(12),
    h: z.number().int().min(1).max(12),
    config: z.record(z.string(), z.custom<{}>(() => true)).default({}),
  })
  .strict()

export const yamlPageSchema = z
  .object({
    name: z.string().min(1).max(100),
    sortOrder: z.number().int().min(0).default(0),
    icon: z.string().max(50).optional(),
    layout: yamlLayoutSchema.optional(),
    widgets: z.array(yamlWidgetSchema).default([]),
  })
  .strict()

export const dashboardYamlSchema = z
  .object({
    version: z.literal(1).default(1),
    dashboard: z
      .object({
        name: z.string().min(1).max(100),
        slug: z.string().regex(slugPattern).max(100).optional(),
        description: z.string().max(500).optional(),
        isPublic: z.boolean().default(false),
        icon: z.string().max(50).optional(),
      })
      .strict(),
    pages: z.array(yamlPageSchema).min(1),
  })
  .strict()

export type YamlLayout = z.infer<typeof yamlLayoutSchema>
export type YamlWidget = z.infer<typeof yamlWidgetSchema>
export type YamlPage = z.infer<typeof yamlPageSchema>
export type DashboardYaml = z.infer<typeof dashboardYamlSchema>
