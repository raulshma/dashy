/**
 * Widget Config Form — Dynamically generates form fields from widget's Zod configSchema.
 *
 * Uses the widget's schema to create appropriate form inputs.
 */
import { useCallback } from 'react'
import type { z } from 'zod'
import type { WidgetConfigSchema, WidgetDefinition } from '@shared/contracts'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface WidgetConfigFormProps<TConfig extends WidgetConfigSchema> {
  definition: WidgetDefinition<TConfig>
  config: TConfig
  onChange: (config: Partial<TConfig>) => void
  className?: string
}

interface FieldConfig {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object'
  enumValues?: Array<string>
  defaultValue?: unknown
}

function extractFieldConfig(key: string, schema: z.ZodTypeAny): FieldConfig {
  const def = (
    schema as unknown as { _zod?: { def?: Record<string, unknown> } }
  )._zod?.def
  const typeName = def?.typeName as string | undefined

  let type: FieldConfig['type'] = 'string'
  let enumValues: Array<string> | undefined
  const defaultValue = def?.defaultValue

  const innerTypeName =
    typeName === 'ZodOptional' ||
    typeName === 'ZodNullable' ||
    typeName === 'ZodDefault'
      ? ((
          def?.innerType as {
            _zod?: { def?: Record<string, unknown> }
          }
        )._zod?.def?.typeName as string | undefined)
      : typeName

  switch (innerTypeName) {
    case 'ZodNumber':
      type = 'number'
      break
    case 'ZodBoolean':
      type = 'boolean'
      break
    case 'ZodEnum':
      type = 'enum'
      enumValues = def?.values as Array<string> | undefined
      break
    case 'ZodArray':
      type = 'array'
      break
    case 'ZodObject':
      type = 'object'
      break
    default:
      type = 'string'
  }

  const label = key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim()

  return { key, label, type, enumValues, defaultValue }
}

function StringField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  )
}

function NumberField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: number
  onChange: (value: number) => void
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input
        id={field.key}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  )
}

function BooleanField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: boolean
  onChange: (value: boolean) => void
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Switch id={field.key} checked={value} onCheckedChange={onChange} />
    </div>
  )
}

function EnumField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: string
  onChange: (value: string) => void
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Select value={value} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger>
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent>
          {field.enumValues?.map((v) => (
            <SelectItem key={v} value={v}>
              {v}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function ArrayField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: Array<unknown>
  onChange: (value: Array<unknown>) => void
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Textarea
        id={field.key}
        value={Array.isArray(value) ? value.join('\n') : ''}
        onChange={(e) => onChange(e.target.value.split('\n').filter(Boolean))}
        placeholder="One item per line"
        rows={3}
      />
    </div>
  )
}

function ObjectField({
  field,
  value,
  onChange,
}: {
  field: FieldConfig
  value: Record<string, unknown>
  onChange: (value: Record<string, unknown>) => void
}): React.ReactElement {
  const stringValue = JSON.stringify(value, null, 2)
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>{field.label}</Label>
      <Textarea
        id={field.key}
        value={stringValue}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value))
          } catch {
            // Invalid JSON, ignore
          }
        }}
        placeholder="{}"
        rows={4}
        className="font-mono text-xs"
      />
    </div>
  )
}

export function WidgetConfigForm<TConfig extends WidgetConfigSchema>({
  definition,
  config,
  onChange,
  className,
}: WidgetConfigFormProps<TConfig>): React.ReactElement {
  const schema = definition.configSchema

  const fields: Array<FieldConfig> = []
  const shape = (
    schema as unknown as {
      _zod?: { def?: { shape?: Record<string, z.ZodTypeAny> } }
    }
  )._zod?.def?.shape

  if (shape && typeof shape === 'object') {
    for (const [key, fieldSchema] of Object.entries(shape)) {
      fields.push(extractFieldConfig(key, fieldSchema))
    }
  }

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      onChange({ [key]: value } as Partial<TConfig>)
    },
    [onChange],
  )

  const renderField = (field: FieldConfig): React.ReactElement => {
    const value = config[field.key as keyof TConfig] ?? field.defaultValue

    switch (field.type) {
      case 'number':
        return (
          <NumberField
            key={field.key}
            field={field}
            value={value as number}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
      case 'boolean':
        return (
          <BooleanField
            key={field.key}
            field={field}
            value={value as boolean}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
      case 'enum':
        return (
          <EnumField
            key={field.key}
            field={field}
            value={value as string}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
      case 'array':
        return (
          <ArrayField
            key={field.key}
            field={field}
            value={value as Array<unknown>}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
      case 'object':
        return (
          <ObjectField
            key={field.key}
            field={field}
            value={value as Record<string, unknown>}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
      default:
        return (
          <StringField
            key={field.key}
            field={field}
            value={value as string}
            onChange={(v) => handleChange(field.key, v)}
          />
        )
    }
  }

  if (fields.length === 0) {
    return (
      <GlassCard variant="solid" className={className}>
        <div className="p-4 text-center text-sm text-white/60">
          This widget has no configurable options.
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard variant="solid" className={className}>
      <div className="space-y-4 p-4">
        <h3 className="text-sm font-medium text-white">
          {definition.displayName} Settings
        </h3>
        <div className="space-y-4">{fields.map(renderField)}</div>
      </div>
    </GlassCard>
  )
}

export default WidgetConfigForm
