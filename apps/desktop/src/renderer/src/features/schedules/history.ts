import type { ScheduledRun, ScheduledTask } from './model'

export const ALL_FILTER = 'all'
export const RUN_STATUSES = ['completed', 'failed', 'running', 'interrupted'] as const
export const SECONDS_PER_MINUTE = 60
export const HISTORY_PREVIEW_LIMIT = 4

export function newestTasks<T extends Pick<ScheduledTask, 'created_at'>>(tasks: readonly T[]): T[] {
  return [...tasks].sort((left, right) => right.created_at - left.created_at)
}

export function remainingSession(runs: ScheduledRun[], removed: string[]): string | null {
  return (
    runs.find((run) => run.session_id && !run.archived && !removed.includes(run.session_id))
      ?.session_id ?? null
  )
}

export function replacementSession(
  runs: ScheduledRun[],
  sessionId: string | null,
  initialSessionId: string | null
): string | null {
  if (
    !sessionId ||
    sessionId !== initialSessionId ||
    runs.some((run) => run.session_id === sessionId)
  )
    return null
  return remainingSession(runs, [])
}
const MILLISECONDS_PER_SECOND = 1000
export type StatusFilter = typeof ALL_FILTER | (typeof RUN_STATUSES)[number]

const HISTORY_STATUS = {
  completed: 'completed',
  running: 'running',
  failed: 'failed',
  interrupted: 'interrupted',
  missed: 'failed',
} as const satisfies Record<ScheduledRun['status'], (typeof RUN_STATUSES)[number]>

export function runStatus(run: ScheduledRun): (typeof RUN_STATUSES)[number] {
  return HISTORY_STATUS[run.status]
}

export function projectRuns(
  runs: ScheduledRun[],
  sessions: {
    session_id: string
    title: string
    archived?: boolean
    running?: boolean
    queued_messages?: unknown[]
  }[]
): ScheduledRun[] {
  const catalog = new Map(sessions.map((session) => [session.session_id, session]))
  return runs.flatMap((run) => {
    if (!run.session_id) return [run]
    const session = catalog.get(run.session_id)
    if (!session) return []
    return [
      {
        ...run,
        title: session.title !== run.name ? session.title : undefined,
        archived: Boolean(session.archived),
        busy:
          run.status === 'running' || Boolean(session.running || session.queued_messages?.length),
      },
    ]
  })
}

export function archivableRuns(runs: ScheduledRun[]): ScheduledRun[] {
  return runs.filter((run) => run.session_id && !run.archived)
}

export function previewRuns(
  runs: ScheduledRun[],
  sessionId: string | null,
  expanded: boolean
): ScheduledRun[] {
  if (expanded || runs.length <= HISTORY_PREVIEW_LIMIT) return runs
  const selected = sessionId ? runs.findIndex((run) => run.session_id === sessionId) : -1
  return selected >= HISTORY_PREVIEW_LIMIT
    ? [...runs.slice(0, HISTORY_PREVIEW_LIMIT - 1), runs[selected]]
    : runs.slice(0, HISTORY_PREVIEW_LIMIT)
}

export function runDate(timestamp: number, locale: string, timeZone?: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(timestamp * MILLISECONDS_PER_SECOND)
}

const RUN_ACTIONS = {
  running: ['stopRun'],
  completed: [],
  failed: ['retryRun'],
  interrupted: ['retryRun'],
} as const satisfies Record<(typeof RUN_STATUSES)[number], readonly string[]>

export function runActions(run: ScheduledRun, taskExists: boolean) {
  return RUN_ACTIONS[runStatus(run)].filter((action) =>
    action === 'retryRun' ? taskExists : Boolean(run.session_id)
  )
}

export function historyTasks(
  tasks: Pick<ScheduledTask, 'id' | 'name'>[],
  runs: ScheduledRun[]
): { id: string; name: string }[] {
  const names = new Map(tasks.map((task) => [task.id, task.name]))
  for (const run of runs) {
    if (!names.has(run.task_id)) names.set(run.task_id, run.name)
  }
  return Array.from(names, ([id, name]) => ({ id, name }))
}

export function filterRuns(
  runs: ScheduledRun[],
  taskId: string,
  status: StatusFilter
): ScheduledRun[] {
  return runs.filter(
    (run) =>
      !run.archived &&
      (taskId === ALL_FILTER || run.task_id === taskId) &&
      (status === ALL_FILTER || runStatus(run) === status)
  )
}

export function runSeconds(run: ScheduledRun, now: number): number | null {
  const end = run.status === 'running' ? now : run.finished_at
  return end === null ? null : Math.max(0, Math.floor(end - run.started_at))
}
