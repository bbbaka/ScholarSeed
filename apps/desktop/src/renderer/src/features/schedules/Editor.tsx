import React, { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Project } from '../../api'
import { useApp } from '../../store'
import { effectiveSessionModelKey } from '../../catalog'
import { modelDefaultEffort } from '../../reasoning'
import { scheduleLabels } from './labels'
import { Timing } from './Timing'
import { Configuration } from './Configuration'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Form,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '../../components/ui'
import {
  EDITOR_FREQUENCIES,
  NAME_LIMIT,
  PROMPT_LIMIT,
  WEEKDAYS,
  INTERVAL_LIMIT,
  newSchedule,
  scheduleValid,
  type Schedule,
} from './model'

export function Editor({
  initial,
  project,
  editing = false,
  onSave,
  onClose,
}: {
  initial: Schedule
  project: Pick<Project, 'id' | 'path' | 'name'>
  editing?: boolean
  onSave: (value: Schedule) => Promise<void>
  onClose: () => void
}): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const { state } = useApp()
  const labels = scheduleLabels(t)
  const [value, setValue] = useState(() => {
    const modelKey = effectiveSessionModelKey(
      state.catalog.models,
      state.model,
      state.activeSession,
      state.threads,
      state.draftModelId
    )
    const model = state.catalog.models.find((entry) => entry.key === modelKey)
    return {
      ...newSchedule(),
      ...initial,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      execution: structuredClone(
        initial.execution ?? {
          model_key: modelKey,
          reasoning_effort: modelDefaultEffort(model),
          references: [],
          contexts: [],
        }
      ),
    }
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [discard, setDiscard] = useState(false)
  const pending = useRef(false)
  const id = useId()
  const original = useRef(value)
  const dirty = JSON.stringify(value) !== JSON.stringify(original.current)
  const close = (): void => {
    if (!pending.current) {
      if (dirty) setDiscard(true)
      else onClose()
    }
  }
  const update = (patch: Partial<Schedule>): void => {
    setValue((current) => ({
      ...current,
      ...patch,
      execution: patch.execution ?? current.execution,
    }))
    setError(null)
  }
  const submit = async (): Promise<void> => {
    if (pending.current || value.frequency === 'custom' || !scheduleValid(value)) return
    pending.current = true
    setBusy(true)
    setError(null)
    try {
      await onSave(value)
      onClose()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '')
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  return (
    <>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) close()
        }}
      >
        <DialogContent aria-describedby={undefined} data-testid="schedule-editor">
          <DialogHeader>
            <DialogTitle>{t(editing ? 'edit' : 'create')}</DialogTitle>
          </DialogHeader>
          <Form
            className="grid gap-[var(--vds-space-5)]"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            <div className="grid gap-[var(--vds-space-2)]">
              <Label htmlFor={`${id}-name`}>{t('name')}</Label>
              <Input
                autoFocus
                id={`${id}-name`}
                value={value.name}
                onChange={(event) => update({ name: event.target.value })}
                required
                maxLength={NAME_LIMIT}
                disabled={busy}
              />
            </div>
            <div className="grid gap-[var(--vds-space-2)]">
              <Label>{t('plan')}</Label>
              <div className="flex flex-wrap gap-[var(--vds-space-3)]">
                <Select
                  value={value.frequency}
                  onValueChange={(frequency) =>
                    update({ frequency: frequency as Schedule['frequency'] })
                  }
                  disabled={busy}
                >
                  <SelectTrigger aria-label={t('frequency')}>
                    <SelectValue>{labels.frequencies[value.frequency]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_FREQUENCIES.map((frequency) => (
                      <SelectItem key={frequency} value={frequency}>
                        {labels.frequencies[frequency]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {value.frequency === 'once' && (
                  <Input
                    type="date"
                    aria-label={t('date')}
                    value={value.once_date ?? ''}
                    onChange={(event) => update({ once_date: event.target.value })}
                    required
                    disabled={busy}
                    className="!w-auto"
                  />
                )}
                {value.frequency === 'interval' && (
                  <div className="flex min-w-0 items-center gap-[var(--vds-space-2)]">
                    <Input
                      type="number"
                      aria-label={t('interval')}
                      min={1}
                      max={INTERVAL_LIMIT}
                      step={1}
                      value={value.interval_minutes ?? 30}
                      onChange={(event) => update({ interval_minutes: Number(event.target.value) })}
                      required
                      disabled={busy}
                    />
                    <span className="shrink-0 text-[var(--vds-text-secondary)]">
                      {t('minutes')}
                    </span>
                  </div>
                )}
                <Timing value={value} disabled={busy} onChange={update} />
              </div>
              {value.frequency === 'weekly' && (
                <div
                  className="flex flex-wrap gap-[var(--vds-space-1)]"
                  role="group"
                  aria-label={t('weekdays')}
                >
                  {WEEKDAYS.map((day) => (
                    <Button
                      type="button"
                      key={day}
                      variant={value.weekdays.includes(day) ? 'primary' : 'secondary'}
                      className="!rounded-full"
                      aria-pressed={value.weekdays.includes(day)}
                      disabled={busy}
                      onClick={() =>
                        update({
                          weekdays: value.weekdays.includes(day)
                            ? value.weekdays.filter((current) => current !== day)
                            : [...value.weekdays, day].sort(),
                        })
                      }
                    >
                      {labels.days[day]}
                    </Button>
                  ))}
                </div>
              )}
              {value.frequency === 'weekly' && !value.weekdays.length && (
                <p role="alert" className="text-[var(--vds-error-text-primary)]">
                  {t('chooseDay')}
                </p>
              )}
              {value.frequency === 'monthly' && value.month_day > 28 && (
                <p className="text-[var(--vds-text-secondary)]">{t('shortMonth')}</p>
              )}
              {value.frequency === 'custom' && (
                <Alert tone="warning" description={t('chooseStandardFrequency')} />
              )}
            </div>
            <div className="grid gap-[var(--vds-space-2)]">
              <Label htmlFor={`${id}-prompt`}>{t('prompt')}</Label>
              <Configuration
                promptId={`${id}-prompt`}
                prompt={value.prompt}
                maxLength={PROMPT_LIMIT}
                onPromptChange={(prompt) => update({ prompt })}
                project={project}
                value={value.execution}
                disabled={busy}
                onChange={(execution) => update({ execution })}
              />
            </div>
            {error !== null && (
              <Alert
                tone="error"
                description={t(
                  error === 'schedule_time_unavailable' ? 'invalidPlan' : 'saveFailed'
                )}
              />
            )}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={close} disabled={busy}>
                {t('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={busy || value.frequency === 'custom' || !scheduleValid(value)}
              >
                {t(busy ? 'saving' : editing ? 'save' : 'createTask')}
              </Button>
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={discard} onOpenChange={setDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('discardTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('discardDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('keepEditing')}</AlertDialogCancel>
            <AlertDialogAction onClick={onClose}>{t('discard')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
