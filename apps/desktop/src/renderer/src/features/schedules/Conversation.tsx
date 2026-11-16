import React, { useEffect, useRef, useState } from 'react'
import { AlarmClock, Clock, Pencil } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Alert,
  Badge,
  BadgeDot,
  Button,
  IconButton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Tooltip,
} from '../../components/ui'
import { loadSessionStatus } from '../../api'
import { OverviewSection } from '../../components/business/SessionArtifacts'
import { activeThread, useApp } from '../../store'
import { loadScheduleConversation, loadScheduleGroups, saveSchedule } from './api'
import { Editor } from './Editor'
import { scheduleCadence, scheduleLabels } from './labels'
import { replacementSession, runDate, runStatus } from './history'
import { Batches } from './Batches'
import {
  REFRESH_INTERVAL,
  SCHEDULE_CHANGED,
  type ScheduleConversation,
  type ScheduledRun,
} from './model'

const STATUS_TONES = {
  running: 'brand',
  completed: 'success',
  failed: 'danger',
  interrupted: 'neutral',
} as const
const SECONDARY =
  'text-[length:var(--vds-font-body-lv1)] font-[var(--vds-fw-regular)] text-[var(--vds-text-secondary)]'
const METADATA =
  'text-[length:var(--vds-font-caption)] font-[var(--vds-fw-regular)] text-[var(--vds-text-tertiary)]'

function useConversation() {
  const { state, act } = useApp()
  const sessionId = activeThread(state).sessionId
  const projectPath = activeThread(state).projectPath
  const project = state.projects.find((item) => item.path === projectPath)
  const projectId = project?.id
  const [revision, setRevision] = useState(0)
  const creationTimes = useRef(new Map<string, number>())
  const [result, setResult] = useState<{
    sessionId: string
    id: string
    initialSessionId: string | null
    initialCreatedAt: number | null
    value: ScheduleConversation
  } | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let disposed = false
    let sequence = 0
    const controller = new AbortController()
    const refresh = async (): Promise<void> => {
      if (!projectId || !sessionId) return
      const current = ++sequence
      try {
        const groups = await loadScheduleGroups(projectId)
        const group = groups.find((item) => item.sessionIds.includes(sessionId))
        const value = group ? await loadScheduleConversation(projectId, group.id) : null
        if (disposed || current !== sequence) return
        const initialSessionId = value?.initial_session_id ?? null
        if (initialSessionId && !creationTimes.current.has(initialSessionId)) {
          const [initial] = await loadSessionStatus([initialSessionId], {}, controller.signal)
          if (initial?.created_at !== undefined)
            creationTimes.current.set(initialSessionId, initial.created_at)
        }
        if (disposed || current !== sequence) return
        setResult(
          group && value
            ? {
                sessionId,
                id: group.id,
                value,
                initialSessionId,
                initialCreatedAt: initialSessionId
                  ? (creationTimes.current.get(initialSessionId) ?? null)
                  : null,
              }
            : null
        )
        setFailed(false)
      } catch {
        if (!disposed && current === sequence) setFailed(true)
      }
    }
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh()
    }, REFRESH_INTERVAL)
    const changed = (): void => {
      void refresh()
    }
    window.addEventListener(SCHEDULE_CHANGED, changed)
    return () => {
      disposed = true
      controller.abort()
      window.clearInterval(timer)
      window.removeEventListener(SCHEDULE_CHANGED, changed)
    }
  }, [projectId, sessionId, revision, state.sessionCatalogRevision])
  return {
    project,
    sessionId,
    act,
    failed,
    result:
      state.archivedSession?.session_id !== sessionId &&
      result &&
      sessionId &&
      result.sessionId === sessionId
        ? result
        : null,
    refresh: () => setRevision((previous) => previous + 1),
  }
}

export function ScheduleConversationIcon({
  children,
  overview = false,
  requestOverviewOpen,
}: {
  children?: React.ReactNode
  overview?: boolean
  requestOverviewOpen?: (sessionId: string) => void
}): React.JSX.Element {
  const { result, sessionId } = useConversation()
  const { t } = useTranslation('schedules')
  const resolved = Boolean(result)
  useEffect(() => {
    if (resolved && sessionId) requestOverviewOpen?.(sessionId)
  }, [resolved, sessionId, requestOverviewOpen])
  return result ? (
    <AlarmClock
      role="img"
      aria-label={t('title')}
      data-testid={overview ? 'schedule-overview-icon' : 'schedule-conversation-icon'}
      className="size-[var(--vds-icon-8)] shrink-0 text-[var(--vds-text-secondary)]"
    />
  ) : (
    <>{children}</>
  )
}

export function ScheduleArchiveNotice({
  children,
}: {
  children?: React.ReactNode
}): React.JSX.Element {
  const { result } = useConversation()
  const { t } = useTranslation('schedules')
  return <>{result ? t('archivedExecutionNotice') : children}</>
}

export function ScheduleConversationTitle({
  children,
}: {
  children?: React.ReactNode
}): React.JSX.Element {
  const { result, project, refresh } = useConversation()
  const { t } = useTranslation('schedules')
  const [editing, setEditing] = useState(false)
  const task = result?.value.task
  if (!task || !project) return <>{children}</>
  return (
    <>
      <Button
        variant="ghost"
        className="!min-w-0 !px-0 !font-[var(--vds-fw-medium)] [-webkit-app-region:no-drag]"
        aria-label={t('editTaskTitle', { name: task.name })}
        onClick={() => setEditing(true)}
      >
        <span className="truncate">{task.name}</span>
      </Button>
      {editing && (
        <Editor
          editing
          initial={task}
          project={project}
          onClose={() => setEditing(false)}
          onSave={async (value) => {
            await saveSchedule(project.id, task.id, value, task.revision, task.enabled)
            refresh()
            window.dispatchEvent(new Event(SCHEDULE_CHANGED))
            window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
          }}
        />
      )}
    </>
  )
}

function RunLabel({
  run,
  latest = false,
  compact = false,
}: {
  run: ScheduledRun
  latest?: boolean
  compact?: boolean
}): React.JSX.Element {
  const { t, i18n } = useTranslation('schedules')
  const date = runDate(run.started_at, i18n.language)
  const status = runStatus(run)
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-[var(--vds-space-2)] whitespace-nowrap">
      <span className="min-w-0 truncate" title={run.title || date}>
        {run.title || date}
      </span>
      {latest && <span className={METADATA}>{t('latest')}</span>}
      <Badge
        size="sm"
        tone={STATUS_TONES[status]}
        className={compact ? 'gap-[var(--vds-space-1)] !bg-transparent !px-0' : undefined}
      >
        {compact && <BadgeDot tone="neutral" aria-hidden="true" />}
        {scheduleLabels(t).statuses[status]}
      </Badge>
    </span>
  )
}

export function ScheduleRunSelector(): React.JSX.Element | null {
  const { result, sessionId, act } = useConversation()
  const { t } = useTranslation('schedules')
  const replacement = result
    ? replacementSession(result.value.runs, sessionId, result.initialSessionId)
    : null
  useEffect(() => {
    if (replacement) act.openSession(replacement, undefined, 'task')
  }, [replacement, act])
  if (!result) return null
  const runs = result.value.runs.filter((run) => !run.archived || run.session_id === sessionId)
  if (!runs.length) return null
  const selected = runs.find((run) => run.session_id === sessionId)
  if (!selected) return null
  return (
    <div
      className="min-w-0 shrink [-webkit-app-region:no-drag]"
      data-testid="schedule-run-selector"
    >
      <Select
        size="sm"
        value={selected.id}
        onValueChange={(id) => {
          const run = runs.find((item) => item.id === id)
          if (run?.session_id) act.openSession(run.session_id, undefined, 'task')
        }}
        disabled={!runs.some((run) => run.session_id)}
      >
        <SelectTrigger
          aria-label={t('selectRun')}
          className="!min-w-0 !max-w-full [&]:!border-transparent [&]:!bg-transparent [&]:!text-[var(--vds-text-secondary)] [&]:enabled:hover:!border-transparent [&]:enabled:hover:!bg-[var(--vds-bg-white-hover)] [&]:data-[state=open]:!bg-[var(--vds-bg-white-hover)]"
        >
          <SelectValue>
            <RunLabel run={selected} compact />
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="!w-max max-w-[var(--vds-popover-available-width)]">
          {runs.map((run, index) => (
            <SelectItem key={run.id} value={run.id} disabled={!run.session_id}>
              <RunLabel run={run} latest={index === 0} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function Description({ text }: { text: string }): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const content = useRef<HTMLParagraphElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  useEffect(() => {
    const element = content.current
    if (!element || expanded) return
    const measure = (): void => setOverflowing(element.scrollHeight > element.clientHeight)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    measure()
    return () => observer.disconnect()
  }, [text, expanded])
  return (
    <div className="grid min-w-0 gap-[var(--vds-space-1)]">
      <p
        ref={content}
        data-testid="schedule-overview-description"
        className={`${SECONDARY} whitespace-pre-wrap break-words ${expanded ? '' : 'line-clamp-3'}`}
      >
        {text}
      </p>
      {overflowing && (
        <Button
          variant="ghost"
          className="justify-self-start"
          aria-expanded={expanded}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? t('hideDescription') : t('showDescription')}
        </Button>
      )}
    </div>
  )
}

export function ScheduleOverview(): React.JSX.Element | null {
  const { result, sessionId, project, failed, refresh } = useConversation()
  const { t, i18n } = useTranslation('schedules')
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const previousTask = useRef<string | null>(null)
  useEffect(() => {
    if (!result?.id || previousTask.current === result.id) return
    previousTask.current = result.id
    setEditing(false)
    setError(false)
  }, [result?.id])
  if (!result || !project) return null
  const { task, runs } = result.value
  const changed = (): void => {
    refresh()
    window.dispatchEvent(new Event(SCHEDULE_CHANGED))
    window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
  }
  return (
    <div
      data-testid="schedule-overview"
      className="mb-[var(--vds-space-3)] border-b border-[var(--vds-divider-default)] pb-[var(--vds-space-3)]"
    >
      <OverviewSection title={t('title')}>
        <div className="grid min-w-0 gap-[var(--vds-space-3)] px-[var(--vds-space-2)] py-[var(--vds-space-2)]">
          {task ? (
            <div className="grid min-w-0 gap-[var(--vds-space-3)]">
              <div className="flex min-w-0 items-start gap-[var(--vds-space-2)]">
                <span className="min-w-0 flex-1 break-words font-[var(--vds-fw-medium)] text-[var(--vds-text-primary)]">
                  {task.name}
                </span>
                <IconButton
                  size="xs"
                  variant="ghostIcon"
                  icon={<Pencil />}
                  label={t('edit')}
                  disabled={busy}
                  onClick={() => setEditing(true)}
                />
                <Switch
                  checked={task.enabled}
                  disabled={busy || (task.frequency === 'once' && !task.next_at)}
                  aria-label={t(task.enabled ? 'pauseTask' : 'enableTask', { name: task.name })}
                  onCheckedChange={async (enabled) => {
                    setBusy(true)
                    setError(false)
                    try {
                      await saveSchedule(project.id, task.id, task, task.revision, enabled)
                      changed()
                    } catch {
                      setError(true)
                    } finally {
                      setBusy(false)
                    }
                  }}
                />
              </div>
              <Description key={task.id} text={task.prompt} />
              <div className={`${SECONDARY} grid gap-[var(--vds-space-2)]`}>
                <Tooltip content={t('timezone', { zone: task.timezone })} portalled side="left">
                  <span tabIndex={0} className="flex items-center gap-[var(--vds-space-2)]">
                    <Clock className="size-[var(--vds-icon-8)] shrink-0" />
                    {scheduleCadence(task, t)}
                  </span>
                </Tooltip>
                <span className={METADATA}>
                  {!task.enabled
                    ? t('paused')
                    : !task.next_at
                      ? t('ended')
                      : t('next', {
                          time: new Intl.DateTimeFormat(i18n.language, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: task.timezone,
                          }).format(task.next_at * 1000),
                        })}
                </span>
              </div>
            </div>
          ) : (
            <p className={SECONDARY}>{t('taskDeleted')}</p>
          )}
          {(failed || error) && (
            <Alert tone="error" description={t(error ? 'actionFailed' : 'loadFailed')}>
              <Button variant="ghost" onClick={refresh}>
                {t('retry')}
              </Button>
            </Alert>
          )}
          <div className="pt-[var(--vds-space-2)]">
            <Batches
              key={result.id}
              projectId={project!.id}
              runs={runs}
              sessionId={sessionId}
              renderLabel={(run) => <RunLabel run={run} />}
            />
          </div>
        </div>
      </OverviewSection>
      {editing && task && (
        <Editor
          initial={task}
          project={project}
          editing
          onClose={() => setEditing(false)}
          onSave={async (value) => {
            await saveSchedule(project.id, task.id, value, task.revision, task.enabled)
            changed()
          }}
        />
      )}
    </div>
  )
}
