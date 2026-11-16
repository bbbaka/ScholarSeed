import type { AssistantContextCandidate, ComposerReference } from '../../contracts/assistant'

export const SCHEDULE_ROUTE = 'schedules'
export const SCHEDULE_CHANGED = 'scholarseed:schedules-changed'
export const SCHEDULE_CARD = 'scheduled-task'
export const REFRESH_INTERVAL = 10000
export const NAME_LIMIT = 200
export const PROMPT_LIMIT = 20000
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const
export const FREQUENCIES = [
  'once',
  'interval',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'custom',
] as const
export const MONTH_DAYS = Array.from({ length: 31 }, (_, index) => index + 1)
export const HOUR_MINUTES = Array.from({ length: 60 }, (_, index) => index)
export const DAY_HOURS = Array.from({ length: 24 }, (_, index) => index)
export const EDITOR_FREQUENCIES = FREQUENCIES.filter((frequency) => frequency !== 'custom')
export const INTERVAL_LIMIT = 525600
export const CRON_LIMIT = 128
const CRON_BOUNDS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 7],
] as const
export type Frequency = (typeof FREQUENCIES)[number]
export interface ScheduleExecution {
  model_key: string
  reasoning_effort: string
  references: ComposerReference[]
  contexts: AssistantContextCandidate[]
}
export interface Schedule {
  name: string
  prompt: string
  frequency: Frequency
  time: string
  timezone: string
  weekdays: number[]
  month_day: number
  once_date?: string
  interval_minutes?: number
  cron?: string
  execution?: ScheduleExecution
}
export interface ScheduledTask extends Schedule {
  id: string
  enabled: boolean
  revision: number
  next_at: number
  created_at: number
}
export interface ScheduledRun {
  title?: string
  archived?: boolean
  busy?: boolean
  id: string
  task_id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'interrupted' | 'missed'
  started_at: number
  finished_at: number | null
  session_id: string | null
  error: string | null
}
export interface ScheduleSnapshot {
  tasks: ScheduledTask[]
  runs: ScheduledRun[]
}
export interface ScheduleConversation {
  initial_session_id?: string | null
  task: ScheduledTask | null
  runs: ScheduledRun[]
  session_id: string | null
}
export function newSchedule(): Schedule {
  const today = new Date()
  return {
    name: '',
    prompt: '',
    frequency: 'weekly',
    time: '09:00',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    weekdays: [0],
    month_day: 1,
    once_date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    interval_minutes: 30,
    cron: '',
  }
}
export function schedulePayload(value: Schedule): Schedule {
  return {
    name: value.name.trim(),
    prompt: value.prompt.trim(),
    frequency: value.frequency,
    time: value.time,
    timezone: value.timezone,
    weekdays: value.weekdays,
    month_day: value.month_day,
    once_date: value.once_date ?? '',
    interval_minutes: value.interval_minutes ?? 30,
    cron: value.cron ?? '',
    ...(value.execution
      ? {
          execution: structuredClone({
            model_key: value.execution.model_key,
            reasoning_effort: value.execution.reasoning_effort,
            references: value.execution.references,
            contexts: value.execution.contexts,
          }),
        }
      : {}),
  }
}
export function scheduleValid(value: Schedule): boolean {
  if (
    typeof value.name !== 'string' ||
    typeof value.prompt !== 'string' ||
    !FREQUENCIES.includes(value.frequency) ||
    !Array.isArray(value.weekdays) ||
    value.weekdays.some((day) => !Number.isInteger(day) || day < 0 || day >= WEEKDAYS.length) ||
    (value.execution !== undefined && !executionValid(value.execution))
  )
    return false
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value.timezone }).format()
  } catch {
    return false
  }
  return Boolean(
    value.name.trim() &&
    value.name.length <= NAME_LIMIT &&
    value.prompt.trim() &&
    value.prompt.length <= PROMPT_LIMIT &&
    typeof value.timezone === 'string' &&
    value.timezone.trim() &&
    /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.time) &&
    (value.frequency !== 'weekly' || value.weekdays.length) &&
    Number.isInteger(value.month_day) &&
    value.month_day >= 1 &&
    value.month_day <= MONTH_DAYS.length &&
    (value.frequency !== 'once' || validDate(value.once_date)) &&
    (value.frequency !== 'interval' ||
      (Number.isInteger(value.interval_minutes) &&
        value.interval_minutes! >= 1 &&
        value.interval_minutes! <= INTERVAL_LIMIT)) &&
    (value.frequency !== 'custom' || validCron(value.cron))
  )
}

export function validDate(value: string | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function validCron(value: string | undefined): boolean {
  if (!value || value.length > CRON_LIMIT) return false
  const parts = value.trim().split(/\s+/)
  return (
    parts.length === CRON_BOUNDS.length &&
    parts.every((part, index) => {
      const [minimum, maximum] = CRON_BOUNDS[index]
      return part.split(',').every((entry) => {
        if (!/^(?:\*|[0-9]+(?:-[0-9]+)?)(?:\/[0-9]+)?$/.test(entry)) return false
        const [base, stride] = entry.split('/')
        const step = stride === undefined ? 1 : Number(stride)
        const [first, last] =
          base === '*'
            ? [minimum, maximum]
            : base.includes('-')
              ? base.split('-').map(Number)
              : [Number(base), Number(base)]
        return (
          (stride === undefined || base === '*' || base.includes('-')) &&
          first >= minimum &&
          first <= last &&
          last <= maximum &&
          step >= 1 &&
          step <= maximum + 1
        )
      })
    })
  )
}
function executionValid(value: ScheduleExecution): boolean {
  return Boolean(
    value &&
    typeof value.model_key === 'string' &&
    value.model_key.trim() &&
    typeof value.reasoning_effort === 'string' &&
    Array.isArray(value.references) &&
    Array.isArray(value.contexts) &&
    value.references.every(
      (entry) =>
        entry &&
        ['skill', 'file', 'directory'].includes(entry.type) &&
        typeof entry.id === 'string' &&
        typeof entry.title === 'string' &&
        typeof entry.path === 'string'
    ) &&
    value.contexts.every(
      (entry) =>
        entry &&
        typeof entry.kind === 'string' &&
        typeof entry.source_id === 'string' &&
        typeof entry.label === 'string'
    )
  )
}
