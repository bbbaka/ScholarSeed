import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlarmClock,
  ArrowRight,
  Clock,
  History,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
} from 'lucide-react'
import {
  Alert,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  BadgeDot,
  Button,
  Card,
  EmptyState,
  Input,
  IconButton,
  Page,
  PageHeader,
  PageBody,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from '../../components/ui'
import { selectedProject, useApp } from '../../store'
import { interruptSession, type Project } from '../../api'
import {
  deleteSchedule,
  loadSchedules,
  openScheduleConversation,
  runSchedule,
  saveSchedule,
} from './api'
import { Editor } from './Editor'
import { useScheduleCreation, useScheduleExecution } from './Creation'
import { Suggestions } from './Suggestions'
import {
  ALL_FILTER,
  RUN_STATUSES,
  SECONDS_PER_MINUTE,
  filterRuns,
  historyTasks,
  newestTasks,
  runActions,
  runStatus,
  runSeconds,
  type StatusFilter,
} from './history'
import { scheduleCadence, scheduleLabels } from './labels'
import {
  REFRESH_INTERVAL,
  newSchedule,
  type Schedule,
  type ScheduledTask,
  type ScheduledRun,
  type ScheduleSnapshot,
} from './model'

const GRID = 'grid grid-cols-1 gap-[var(--vds-space-4)] @[640px]:grid-cols-2 @[1000px]:grid-cols-3'
const MUTED = 'text-[var(--vds-text-secondary)]'
const CARD_TITLE =
  'text-[length:var(--vds-font-subhead)] leading-[var(--vds-lh-subhead)] font-[var(--vds-fw-semibold)] text-[var(--vds-text-primary)]'
const CARD_DESCRIPTION =
  'text-[length:var(--vds-font-body-lv2)] leading-[var(--vds-lh-body-lv2)] font-[var(--vds-fw-regular)] text-[var(--vds-text-secondary)]'
const CARD_METADATA =
  'text-[length:var(--vds-font-body-lv1)] leading-[var(--vds-lh-body-lv1)] font-[var(--vds-fw-regular)] text-[var(--vds-text-tertiary)]'
const METADATA_ICON = 'size-[var(--vds-icon-8)] shrink-0'
const STATUS_COLOR = {
  running: 'text-[var(--vds-brand-text-primary)]',
  completed: 'text-[var(--vds-success-text-primary)]',
  failed: 'text-[var(--vds-error-text-primary)]',
  interrupted: 'text-[var(--vds-text-secondary)]',
} satisfies Record<ReturnType<typeof runStatus>, string>

export function SchedulesPage(): React.JSX.Element {
  const { state } = useApp()
  const project = selectedProject(state)
  const { t } = useTranslation('schedules')
  return project ? (
    <ProjectSchedules key={project.id} project={project} />
  ) : (
    <EmptyState title={t('selectProject')} />
  )
}

function ProjectSchedules({ project }: { project: Project }): React.JSX.Element {
  const projectId = project.id
  const projectName = project.name
  const { t, i18n } = useTranslation('schedules')
  const labels = scheduleLabels(t)
  const { act } = useApp()
  const [snapshot, setSnapshot] = useState<ScheduleSnapshot | null>(null)
  const [failed, setFailed] = useState(false)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState('tasks')
  const [query, setQuery] = useState('')
  const [taskFilter, setTaskFilter] = useState(ALL_FILTER)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(ALL_FILTER)
  const [editor, setEditor] = useState<{
    id: string
    schedule: Schedule
    task?: ScheduledTask
  } | null>(null)
  const [deleting, setDeleting] = useState<ScheduledTask | null>(null)
  const creation = useScheduleCreation()
  const runAndOpen = useScheduleExecution()
  useEffect(() => {
    if (creation.pending?.projectId !== projectId) return
    setEditor({
      id: creation.pending.task?.id ?? crypto.randomUUID(),
      schedule: creation.pending.schedule,
      task: creation.pending.task,
    })
    creation.clear()
  }, [creation, projectId])
  const pending = useRef(false)
  const generation = useRef(0)
  const mounted = useRef(true)
  const refresh = async (): Promise<void> => {
    const current = ++generation.current
    try {
      const result = await loadSchedules(projectId)
      if (mounted.current && current === generation.current) {
        setSnapshot(result)
        setFailed(false)
      }
    } catch {
      if (mounted.current && current === generation.current) setFailed(true)
    }
  }
  useEffect(() => {
    mounted.current = true
    void refresh()
    const timer = window.setInterval(() => {
      if (!document.hidden && !pending.current) void refresh()
    }, REFRESH_INTERVAL)
    return () => {
      mounted.current = false
      generation.current++
      window.clearInterval(timer)
    }
  }, [projectId])
  const date = (timestamp: number, zone?: string): string =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      ...(zone ? { timeZone: zone } : {}),
    }).format(timestamp * 1000)
  const cadence = (task: Schedule): string => scheduleCadence(task, t)
  const mutate = async (id: string, operation: () => Promise<unknown>): Promise<boolean> => {
    if (pending.current) return false
    pending.current = true
    setBusy(id)
    setError(false)
    generation.current++
    try {
      await operation()
      await refresh()
      return true
    } catch {
      if (mounted.current) setError(true)
      return false
    } finally {
      pending.current = false
      if (mounted.current) setBusy(null)
    }
  }
  const create = (schedule = newSchedule()): void => {
    setEditor({ id: crypto.randomUUID(), schedule })
  }
  const edit = (task: ScheduledTask): void => {
    setEditor({ id: task.id, schedule: task, task })
  }
  const openTask = (task: ScheduledTask): void => {
    void mutate(task.id, async () => {
      const conversation = await openScheduleConversation(projectId, task.id)
      act.openWorkbenchView('resource', { preserveProject: true })
      act.openSession(conversation.session_id, undefined, 'task')
    })
  }
  const filtered = newestTasks(
    snapshot?.tasks.filter((task) =>
      `${task.name} ${task.prompt}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())
    ) ?? []
  )
  const taskOptions = historyTasks(snapshot?.tasks ?? [], snapshot?.runs ?? [])
  const runs = filterRuns(snapshot?.runs ?? [], taskFilter, statusFilter)
  const filteringRuns = taskFilter !== ALL_FILTER || statusFilter !== ALL_FILTER
  const runDate = (timestamp: number): string =>
    new Intl.DateTimeFormat(i18n.language, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(timestamp * 1000)
  const duration = (run: ScheduledRun): string => {
    const seconds = runSeconds(run, Date.now() / 1000)
    if (seconds === null) return '—'
    return seconds < SECONDS_PER_MINUTE
      ? t('durationSeconds', { seconds })
      : t('durationMinutes', {
          minutes: Math.floor(seconds / SECONDS_PER_MINUTE),
          seconds: seconds % SECONDS_PER_MINUTE,
        })
  }
  const openRun = (sessionId: string): void => {
    act.openWorkbenchView('resource', { preserveProject: true })
    act.openSession(sessionId, undefined, 'task')
  }
  const showHistory = (task: ScheduledTask): void => {
    setTaskFilter(task.id)
    setStatusFilter(ALL_FILTER)
    setTab('runs')
  }
  const running = (task: ScheduledTask): boolean =>
    Boolean(snapshot?.runs.some((run) => run.task_id === task.id && run.status === 'running'))
  const execute = async (task: ScheduledTask): Promise<void> => {
    if (await mutate(task.id, () => runSchedule(projectId, task))) {
      showHistory(task)
    }
  }
  return (
    <div
      className={`@container h-full min-h-0 ${tab === 'runs' ? 'overflow-hidden' : 'overflow-auto'}`}
      data-testid="schedules-page"
    >
      <Page className={tab === 'runs' ? 'h-full' : undefined}>
        <PageHeader
          title={t('title')}
          description={t('description')}
          actions={
            <>
              <Button
                variant="secondary"
                icon={<MessageCircle />}
                onClick={() =>
                  act.startDraft({ projectId, projectLocked: true, composerText: t('chatPrompt') })
                }
              >
                {t('throughChat')}
              </Button>
              <Button icon={<Plus />} onClick={() => create()}>
                {t('create')}
              </Button>
            </>
          }
        />
        <PageBody className={tab === 'runs' ? '!flex flex-1 flex-col overflow-hidden' : undefined}>
          <Suggestions
            project={project}
            excludedSessions={
              new Set(
                snapshot?.runs.flatMap((run) => (run.session_id ? [run.session_id] : [])) ?? []
              )
            }
            onChoose={create}
          />
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-[var(--vds-space-3)]">
            <Tabs value={tab} onValueChange={(value) => setTab(String(value))}>
              <TabsList aria-label={t('sections')}>
                <TabsTrigger value="tasks">{t('myTasks')}</TabsTrigger>
                <TabsTrigger value="runs">{t('history')}</TabsTrigger>
              </TabsList>
            </Tabs>
            {tab === 'tasks' ? (
              <Input
                aria-label={t('search')}
                placeholder={t('search')}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="!w-auto"
              />
            ) : (
              <div className="flex min-w-0 max-w-full flex-wrap gap-[var(--vds-space-3)]">
                <Select value={taskFilter} onValueChange={setTaskFilter}>
                  <SelectTrigger
                    aria-label={t('filterTask')}
                    className="w-[var(--vds-schedule-task-filter-width)] max-w-full"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>{t('allTasks')}</SelectItem>
                    {taskOptions.map((task) => (
                      <SelectItem
                        key={task.id}
                        value={task.id}
                        className="min-w-0 whitespace-nowrap"
                      >
                        <span className="block truncate" title={task.name}>
                          {task.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as StatusFilter)}
                >
                  <SelectTrigger aria-label={t('filterStatus')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER}>{t('allStatuses')}</SelectItem>
                    {RUN_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {labels.statuses[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {failed && (
            <Alert tone="error" description={t('loadFailed')}>
              <Button variant="secondary" onClick={() => void refresh()}>
                {t('retry')}
              </Button>
            </Alert>
          )}
          {error && <Alert tone="error" description={t('actionFailed')} />}
          {!snapshot && !failed ? (
            <Spinner />
          ) : tab === 'tasks' ? (
            <>
              {filtered.length ? (
                <div className={GRID}>
                  {filtered.map((task) => (
                    <Card
                      key={task.id}
                      data-testid="schedule-card"
                      className="group/schedule cursor-pointer"
                      onClick={(event) => {
                        if (
                          !(event.target instanceof Element) ||
                          event.target.closest('button, input, [role="switch"]')
                        )
                          return
                        openTask(task)
                      }}
                    >
                      <div className="flex items-start justify-between gap-[var(--vds-space-3)]">
                        <Button
                          aria-label={task.name}
                          variant="ghost"
                          className="!h-auto min-w-0 !justify-start !whitespace-normal !p-0 !text-start"
                          disabled={busy !== null}
                          onClick={() => openTask(task)}
                        >
                          <strong className={`break-words ${CARD_TITLE}`}>{task.name}</strong>
                        </Button>
                        <Switch
                          aria-label={t(task.enabled ? 'pauseTask' : 'enableTask', {
                            name: task.name,
                          })}
                          checked={task.enabled}
                          disabled={
                            busy !== null || (task.frequency === 'once' && task.next_at === 0)
                          }
                          onCheckedChange={(enabled) =>
                            void mutate(task.id, () =>
                              saveSchedule(projectId, task.id, task, task.revision, enabled)
                            )
                          }
                        />
                      </div>
                      <p
                        className={`my-[var(--vds-space-4)] line-clamp-2 break-words ${CARD_DESCRIPTION}`}
                      >
                        {task.prompt}
                      </p>
                      <p className={`flex items-center gap-[var(--vds-space-2)] ${CARD_METADATA}`}>
                        <Clock aria-hidden="true" className={METADATA_ICON} />
                        {cadence(task)}
                      </p>
                      <div className="mt-[var(--vds-space-2)] flex items-center justify-between gap-[var(--vds-space-2)]">
                        <p
                          className={`flex min-w-0 items-center gap-[var(--vds-space-2)] ${CARD_METADATA}`}
                        >
                          <ArrowRight aria-hidden="true" className={METADATA_ICON} />
                          <span
                            className="truncate"
                            title={
                              task.enabled
                                ? t('next', { time: date(task.next_at, task.timezone) })
                                : undefined
                            }
                          >
                            {task.enabled
                              ? t('next', { time: date(task.next_at, task.timezone) })
                              : t(
                                  task.frequency === 'once' && task.next_at === 0
                                    ? 'ended'
                                    : 'paused'
                                )}
                          </span>
                        </p>
                        <div className="flex shrink-0 items-center opacity-0 group-hover/schedule:opacity-[var(--vds-opacity-full)] group-focus-within/schedule:opacity-[var(--vds-opacity-full)] [@media(hover:none)]:opacity-[var(--vds-opacity-full)]">
                          <IconButton
                            variant="ghost"
                            label={t('viewHistory')}
                            icon={<History />}
                            onClick={() => showHistory(task)}
                          />
                          <IconButton
                            variant="ghost"
                            label={t('runNow')}
                            icon={<Play />}
                            disabled={busy !== null || running(task)}
                            loading={busy === task.id}
                            onClick={() => void mutate(task.id, () => runAndOpen(projectId, task))}
                          />
                          <IconButton
                            variant="ghost"
                            label={t('edit')}
                            icon={<Pencil />}
                            disabled={busy !== null}
                            onClick={() => edit(task)}
                          />
                          <IconButton
                            variant="ghost"
                            label={t('delete')}
                            icon={<Trash2 />}
                            disabled={busy !== null || running(task)}
                            onClick={() => setDeleting(task)}
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<AlarmClock />}
                  title={t(query ? 'noMatches' : 'empty')}
                  description={t(query ? 'changeSearch' : 'emptyDescription')}
                />
              )}
            </>
          ) : (
            <Card padding="none" className="min-h-0 flex-1 overflow-hidden">
              <div
                className="h-full overflow-auto overscroll-contain px-[var(--vds-space-3)]"
                role="region"
                aria-label={t('history')}
                tabIndex={0}
              >
                <Table aria-label={t('history')} className="w-full">
                  <TableHeader className="sticky top-0 z-[var(--vds-z-sticky-header)] bg-[var(--vds-surface-raised)] [--vds-table-cell-padding-y:var(--vds-space-2)]">
                    <TableRow>
                      <TableHead>{t('name')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('statusColumn')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('runTime')}</TableHead>
                      <TableHead className="whitespace-nowrap">{t('duration')}</TableHead>
                      <TableHead className="whitespace-nowrap !text-center">
                        {t('actions')}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.map((run) => {
                      const task = snapshot?.tasks.find((task) => task.id === run.task_id)
                      const actions = runActions(run, Boolean(task))
                      const status = runStatus(run)
                      return (
                        <TableRow
                          key={run.id}
                          data-testid="schedule-run-row"
                          tabIndex={run.session_id ? 0 : undefined}
                          className={
                            run.session_id
                              ? 'cursor-pointer hover:bg-[var(--vds-bg-white-hover)] focus-visible:bg-[var(--vds-bg-white-hover)]'
                              : undefined
                          }
                          onClick={() => {
                            if (run.session_id) openRun(run.session_id)
                          }}
                          onKeyDown={(event) => {
                            if (
                              event.target === event.currentTarget &&
                              run.session_id &&
                              (event.key === 'Enter' || event.key === ' ')
                            ) {
                              event.preventDefault()
                              openRun(run.session_id)
                            }
                          }}
                        >
                          <TableCell>
                            <div className="min-w-0 [overflow-wrap:anywhere]">
                              <strong>{run.name}</strong>
                              {run.status !== 'interrupted' && run.error ? (
                                <p className="mt-[var(--vds-space-1)] text-[var(--vds-error-text-primary)]">
                                  {t(run.status === 'missed' ? 'missedDescription' : 'runFailed')}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-[var(--vds-space-2)] whitespace-nowrap ${STATUS_COLOR[status]}`}
                            >
                              <BadgeDot tone="neutral" aria-hidden="true" />
                              {labels.statuses[status]}
                            </span>
                          </TableCell>
                          <TableCell className={`whitespace-nowrap tabular-nums ${MUTED}`}>
                            {runDate(run.started_at)}
                          </TableCell>
                          <TableCell className={`whitespace-nowrap tabular-nums ${MUTED}`}>
                            {duration(run)}
                          </TableCell>
                          <TableCell className="!text-center">
                            <div className="flex items-center justify-center gap-[var(--vds-space-2)] whitespace-nowrap">
                              {actions.map((action) => (
                                <Button
                                  key={action}
                                  variant="ghost"
                                  size="sm"
                                  disabled={
                                    busy !== null ||
                                    (action === 'retryRun' && Boolean(task && running(task)))
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    if (action === 'retryRun') {
                                      if (task) void execute(task)
                                    } else if (action === 'stopRun') {
                                      void mutate(run.id, async () => {
                                        const result = await interruptSession(run.session_id!)
                                        if (!result.ok) throw new Error(result.error)
                                      })
                                    }
                                  }}
                                >
                                  {t(action)}
                                </Button>
                              ))}
                              {!actions.length && '—'}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!runs.length && (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <EmptyState
                            title={t(filteringRuns ? 'noMatchingRuns' : 'noRuns')}
                            description={filteringRuns ? t('changeFilters') : undefined}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </PageBody>
      </Page>
      {editor && (
        <Editor
          initial={editor.schedule}
          project={project}
          editing={Boolean(editor.task)}
          onClose={() => setEditor(null)}
          onSave={async (value) => {
            await saveSchedule(
              projectId,
              editor.id,
              value,
              editor.task?.revision,
              editor.task?.enabled ?? true
            )
            await refresh()
          }}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !pending.current) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('deleteDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          {error && <Alert tone="error" description={t('actionFailed')} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy !== null}
              onClick={async (event) => {
                event.preventDefault()
                if (
                  deleting &&
                  (await mutate(deleting.id, () => deleteSchedule(projectId, deleting)))
                )
                  setDeleting(null)
              }}
            >
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
