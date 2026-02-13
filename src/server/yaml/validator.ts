/**
 * Dashboard YAML Validation Engine
 *
 * Performs two-stage validation:
 * 1) YAML parse/composition validation (syntax, duplicate keys, etc.)
 * 2) Schema validation using shared Zod schema
 */
import { parseDocument } from 'yaml'
import { dashboardYamlSchema } from '@shared/schemas'
import type { DashboardYaml } from '@shared/schemas'

export type YamlValidationIssueLevel = 'error' | 'warning'
export type YamlValidationIssueSource = 'yaml-parse' | 'yaml-schema'

export interface YamlValidationIssue {
  level: YamlValidationIssueLevel
  source: YamlValidationIssueSource
  code: string
  message: string
  path?: string
  line?: number
  column?: number
}

export interface YamlValidationResult {
  valid: boolean
  data?: DashboardYaml
  issues: Array<YamlValidationIssue>
}

type YamlErrorLike = {
  code?: string
  message?: string
  linePos?: Array<{ line: number; col: number }>
}

function normalizePath(path: Array<string | number>): string {
  if (path.length === 0) {
    return 'root'
  }

  return path
    .map((segment) =>
      typeof segment === 'number' ? `[${segment}]` : String(segment),
    )
    .join('.')
    .replace(/\.\[/g, '[')
}

function toParseIssue(
  error: YamlErrorLike,
  level: YamlValidationIssueLevel,
): YamlValidationIssue {
  const linePos = error.linePos?.[0]

  return {
    level,
    source: 'yaml-parse',
    code: error.code ?? 'YAML_PARSE_ERROR',
    message: error.message ?? 'Invalid YAML input',
    line: linePos?.line,
    column: linePos?.col,
  }
}

/**
 * Validate dashboard YAML and return structured issues.
 */
export function validateDashboardYaml(
  yamlContent: string,
): YamlValidationResult {
  const issues: Array<YamlValidationIssue> = []

  const document = parseDocument(yamlContent, {
    prettyErrors: true,
    strict: true,
    uniqueKeys: true,
    stringKeys: true,
  })

  for (const error of document.errors) {
    issues.push(toParseIssue(error as YamlErrorLike, 'error'))
  }

  for (const warning of document.warnings) {
    issues.push(toParseIssue(warning as YamlErrorLike, 'warning'))
  }

  if (document.errors.length > 0) {
    return { valid: false, issues }
  }

  const rawData = document.toJS({
    maxAliasCount: 50,
  }) as unknown

  const parsed = dashboardYamlSchema.safeParse(rawData)

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const normalizedIssuePath = issue.path.filter(
        (segment): segment is string | number => typeof segment !== 'symbol',
      )

      issues.push({
        level: 'error',
        source: 'yaml-schema',
        code: issue.code,
        message: issue.message,
        path: normalizePath(normalizedIssuePath),
      })
    }

    return { valid: false, issues }
  }

  return {
    valid: true,
    data: parsed.data,
    issues,
  }
}
