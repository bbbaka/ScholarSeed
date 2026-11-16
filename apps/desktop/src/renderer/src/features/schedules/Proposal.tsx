import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock } from 'lucide-react'
import {
  Alert,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
  useToast,
} from '../../components/ui'
import { activeThread, useApp } from '../../store'
import { loadSchedules, saveSchedule } from './api'
import { useScheduleCreation, useScheduleExecution } from './Creation'
import { Editor } from './Editor'
import { scheduleCadence } from './labels'
import { scheduleValid, type Schedule, type ScheduledTask } from './model'

export function Proposal({
  cardId,
  content,
}: {
  cardId: string
  content: Record<string, unknown>
}): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const { state } = useApp()
  const creation = useScheduleCreation()
  const execute = useScheduleExecution()
  const { toast } = useToast()
  const thread = activeThread(state)
  const project = state.projects.find((candidate) => candidate.path === thread.projectPath)
  const [created, setCreated] = useState(false)
  const [saved, setSaved] = useState<ScheduledTask | null>(null)
  const [checking, setChecking] = useState(true)
  const [failed, setFailed] = useState(false)
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const identity = `card:${thread.sessionId}:${cardId}`
  const schedule = saved ?? (content as unknown as Schedule)
  const valid =
    typeof schedule.name === 'string' &&
    typeof schedule.prompt === 'string' &&
    Array.isArray(schedule.weekdays) &&
    scheduleValid(schedule)
  useEffect(() => {
    let active = true
    if (!project) {
      setChecking(false)
      return
    }
    setChecking(true)
    void loadSchedules(project.id)
      .then((result) => {
        if (active) {
          const existing = result.tasks.find((task) => task.id === identity)
          setCreated(Boolean(existing))
          setSaved(existing ?? null)
          setFailed(false)
        }
      })
      .catch(() => {
        if (active) setFailed(true)
      })
      .finally(() => {
        if (active) setChecking(false)
      })
    return () => {
      active = false
    }
  }, [project?.id, identity])
  const save = async (value: Schedule): Promise<void> => {
    if (!project || thread.readOnly || pending.current) return
    pending.current = true
    setBusy(true)
    setFailed(false)
    try {
      const result = await saveSchedule(project.id, identity, value)
      setSaved(result)
      setCreated(true)
    } catch (error) {
      setFailed(true)
      throw error
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  const operate = async (run: boolean): Promise<void> => {
    if (!project || thread.readOnly || pending.current) return
    pending.current = true
    setBusy(true)
    setFailed(false)
    try {
      const latest = (await loadSchedules(project.id)).tasks.find((task) => task.id === identity)
      if (!latest) {
        toast({ title: t('taskUnavailable'), tone: 'error' })
        return
      }
      setSaved(latest)
      if (run) {
        await execute(project.id, latest)
      } else creation.edit(project.id, latest)
    } catch {
      toast({ title: t('actionFailed'), tone: 'error' })
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  if (!project || !valid) return <Alert tone="warning" description={t('invalidCard')} />
  if (created)
    return (
      <Card data-testid="schedule-proposal" aria-label={t('created')} padding="none">
        <div className="flex min-w-0 flex-wrap items-center gap-[var(--vds-space-3)] p-[var(--vds-space-3)]">
          <Button
            variant="ghost"
            data-testid="schedule-proposal-edit"
            aria-label={t('editTaskTitle', { name: schedule.name })}
            className="h-auto! min-w-0 flex-auto justify-start! gap-[var(--vds-space-3)]! whitespace-normal! text-left"
            disabled={checking || busy || thread.readOnly}
            onClick={() => void operate(false)}
          >
            <span className="shrink-0 rounded-[var(--vds-radius-4)] bg-[var(--vds-surface-hover)] p-[var(--vds-space-3)]">
              <Clock aria-hidden="true" className="size-[var(--vds-icon-6)]" />
            </span>
            <span className="grid min-w-0 gap-[var(--vds-space-1)]">
              <span className="truncate font-[var(--vds-fw-semibold)]">{schedule.name}</span>
              <span className="text-[var(--vds-text-secondary)] font-[var(--vds-fw-regular)]">
                {scheduleCadence(schedule, t)}
              </span>
            </span>
          </Button>
          <Button
            variant="ghost"
            disabled={checking || busy || thread.readOnly}
            onClick={() => void operate(false)}
          >
            {t('openTask')}
          </Button>
          <Button
            variant="secondary"
            disabled={checking || busy || thread.readOnly}
            loading={busy}
            onClick={() => void operate(true)}
          >
            {t('runImmediately')}
          </Button>
        </div>
      </Card>
    )
  return (
    <>
      <Card data-testid="schedule-proposal">
        <CardHeader>
          <CardTitle>
            <Clock aria-hidden="true" className="inline-block" />{' '}
            {t(created ? 'created' : 'proposal')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <strong>{schedule.name}</strong>
          <p className="my-[var(--vds-space-3)] whitespace-pre-wrap">{schedule.prompt}</p>
          <p>
            {scheduleCadence(schedule, t)} · {schedule.timezone}
          </p>
          <p>{t('project', { name: project.name })}</p>
          {failed && <Alert tone="error" description={t('saveFailed')} />}
        </CardContent>
        {!created && !thread.readOnly && (
          <CardFooter>
            <Button
              variant="secondary"
              disabled={checking || busy}
              onClick={() => setEditing(true)}
            >
              {t('modify')}
            </Button>
            <Button
              disabled={checking || busy}
              onClick={() => void save(schedule).catch(() => undefined)}
            >
              {t(busy ? 'saving' : 'confirm')}
            </Button>
          </CardFooter>
        )}
      </Card>
      {editing && (
        <Editor
          initial={schedule}
          project={project}
          onClose={() => setEditing(false)}
          onSave={save}
        />
      )}
    </>
  )
}
