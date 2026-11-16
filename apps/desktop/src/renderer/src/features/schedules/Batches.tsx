import React, { useState } from 'react'
import { Archive, ListChecks, MoreHorizontal, Pencil, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { deleteSession, setSessionArchived } from '../../api'
import { useApp } from '../../store'
import { OverviewSection } from '../../components/business/SessionArtifacts'
import {
  Alert,
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  IconButton,
} from '../../components/ui'
import {
  ALL_FILTER,
  archivableRuns,
  filterRuns,
  HISTORY_PREVIEW_LIMIT,
  previewRuns,
  runDate,
  remainingSession,
} from './history'
import { SCHEDULE_CHANGED, SCHEDULE_ROUTE, type ScheduledRun } from './model'
import { ExecutionDeleteDescription } from './Archive'
import { stopScheduleSession } from './api'

export function Batches({
  projectId,
  runs,
  sessionId,
  renderLabel,
}: {
  projectId: string
  runs: ScheduledRun[]
  sessionId: string | null
  renderLabel: (run: ScheduledRun) => React.ReactNode
}): React.JSX.Element {
  const { act, set } = useApp()
  const { t, i18n } = useTranslation('schedules')
  const [expanded, setExpanded] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [deleting, setDeleting] = useState<ScheduledRun | null>(null)
  const visible = filterRuns(runs, ALL_FILTER, ALL_FILTER)
  const eligible = archivableRuns(visible)
  const chosen = eligible.filter((run) => selected.includes(run.id))
  const label = (run: ScheduledRun): string => run.title || runDate(run.started_at, i18n.language)
  const navigateAfterRemoval = (removed: string[]): void => {
    const next = remainingSession(runs, removed)
    if (next) act.openSession(next, undefined, 'task')
    else act.openWorkbenchView(SCHEDULE_ROUTE, { preserveProject: true })
  }
  const changed = (): void => {
    set((current) => ({ sessionCatalogRevision: current.sessionCatalogRevision + 1 }))
    window.dispatchEvent(new Event(SCHEDULE_CHANGED))
    window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
  }
  const archive = async (): Promise<void> => {
    if (busy || !chosen.length) return
    setBusy(true)
    setFailed(false)
    const completed: ScheduledRun[] = []
    const ordered = [
      ...chosen.filter((run) => run.session_id !== sessionId),
      ...chosen.filter((run) => run.session_id === sessionId),
    ]
    for (const [index, run] of ordered.entries()) {
      if (run.session_id === sessionId && completed.length < index) break
      try {
        await stopScheduleSession(projectId, run.task_id, run.session_id!)
        if ((await setSessionArchived(run.session_id!, true)).ok) completed.push(run)
      } catch {
        setFailed(true)
      }
    }
    const remaining = chosen.filter((run) => !completed.includes(run))
    setSelected(remaining.map((run) => run.id))
    setFailed(Boolean(remaining.length))
    setBusy(false)
    setConfirming(Boolean(remaining.length))
    setSelecting(Boolean(remaining.length))
    changed()
    for (const run of completed) act.removeSession(run.session_id!, 'assistant')
    if (completed.some((run) => run.session_id === sessionId))
      navigateAfterRemoval(completed.map((run) => run.session_id!))
  }
  const remove = async (): Promise<void> => {
    if (!deleting?.session_id || busy) return
    setBusy(true)
    setFailed(false)
    try {
      await stopScheduleSession(projectId, deleting.task_id, deleting.session_id)
      if (!(await deleteSession(deleting.session_id)).ok) throw new Error('schedule_delete_failed')
      act.removeSession(deleting.session_id, 'assistant')
      if (deleting.session_id === sessionId) navigateAfterRemoval([deleting.session_id])
      setDeleting(null)
      changed()
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="grid min-w-0 gap-[var(--vds-space-1)]" data-testid="schedule-overview-history">
      <OverviewSection title={t('history')}>
        {!visible.length && <p className="text-[var(--vds-text-tertiary)]">{t('noRuns')}</p>}
        {(selecting ? visible : previewRuns(visible, sessionId, expanded)).map((run) => (
          <div
            key={run.id}
            className="group flex min-w-0 items-center gap-[var(--vds-space-1)] rounded-[var(--vds-radius-4)] aria-[current=true]:bg-[var(--vds-bg-white-hover-transparent)]"
            aria-current={run.session_id === sessionId ? 'true' : undefined}
          >
            {selecting && (
              <Checkbox
                aria-label={t('selectBatch', { name: label(run) })}
                checked={chosen.includes(run)}
                disabled={busy || !eligible.includes(run)}
                onCheckedChange={(checked) =>
                  setSelected((ids) =>
                    checked ? [...ids, run.id] : ids.filter((id) => id !== run.id)
                  )
                }
              />
            )}
            <Button
              variant="ghost"
              disabled={!run.session_id || busy}
              className="!h-auto !min-w-0 flex-1 !justify-start !px-[var(--vds-space-2)] !py-[var(--vds-space-2)] !font-[var(--vds-fw-regular)]"
              onClick={() => {
                if (selecting) {
                  if (eligible.includes(run))
                    setSelected((ids) =>
                      ids.includes(run.id) ? ids.filter((id) => id !== run.id) : [...ids, run.id]
                    )
                } else if (run.session_id) act.openSession(run.session_id, undefined, 'task')
              }}
            >
              {renderLabel(run)}
            </Button>
            {!selecting && run.session_id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    icon={<MoreHorizontal />}
                    size="xs"
                    variant="ghostIcon"
                    label={t('batchActions', { name: label(run) })}
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={run.busy}
                    onSelect={() =>
                      set({
                        sessionRename: {
                          sessionId: run.session_id!,
                          originalTitle: label(run),
                          mode: 'dialog',
                        },
                      })
                    }
                  >
                    <Pencil />
                    {t('renameBatch')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      setSelecting(true)
                      setSelected(eligible.includes(run) ? [run.id] : [])
                    }}
                  >
                    <ListChecks />
                    {t('batchSelect')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!eligible.includes(run)}
                    onSelect={() => {
                      setSelected([run.id])
                      setConfirming(true)
                    }}
                  >
                    <Archive />
                    {t('archiveBatch')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    destructive
                    onSelect={() => {
                      setFailed(false)
                      setDeleting(run)
                    }}
                  >
                    <Trash2 />
                    {t('deleteBatch')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
        {selecting ? (
          <div className="flex items-center gap-[var(--vds-space-2)] border-t border-[var(--vds-divider-default)] pt-[var(--vds-space-2)]">
            <Checkbox
              aria-label={t('selectAllBatches')}
              checked={
                chosen.length === eligible.length && eligible.length > 0
                  ? true
                  : chosen.length
                    ? 'mixed'
                    : false
              }
              disabled={busy || !eligible.length}
              onCheckedChange={(checked) =>
                setSelected(checked ? eligible.map((run) => run.id) : [])
              }
            />
            <span className="flex-1 text-[var(--vds-text-tertiary)]">
              {t('selectedBatches', { count: chosen.length })}
            </span>
            <IconButton
              icon={<X />}
              size="xs"
              variant="ghostIcon"
              label={t('cancel')}
              disabled={busy}
              onClick={() => {
                setSelecting(false)
                setSelected([])
              }}
            />
            <IconButton
              icon={<Archive />}
              size="xs"
              variant="ghostIcon"
              label={t('archiveSelected', { count: chosen.length })}
              disabled={busy || !chosen.length}
              onClick={() => setConfirming(true)}
            />
          </div>
        ) : (
          visible.length > HISTORY_PREVIEW_LIMIT && (
            <Button
              variant="ghost"
              size="xs"
              className="justify-self-start !px-0 !font-[var(--vds-fw-regular)] !text-[var(--vds-text-secondary)]"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? t('showLessHistory') : t('showMoreHistory', { count: visible.length })}
            </Button>
          )
        )}
        {failed && !confirming && <Alert tone="error" description={t('actionFailed')} />}
      </OverviewSection>
      <AlertDialog
        open={confirming}
        onOpenChange={(open) => {
          if (!busy) setConfirming(open)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('archiveSelected', { count: chosen.length })}</AlertDialogTitle>
            <AlertDialogDescription>{t('archiveBatchesDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          {failed && <Alert tone="error" description={t('archivePartialFailure')} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel')}</AlertDialogCancel>
            <Button loading={busy} disabled={!chosen.length} onClick={() => void archive()}>
              {t('archiveBatch')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteBatch')}</AlertDialogTitle>
            <AlertDialogDescription>
              <ExecutionDeleteDescription name={deleting ? label(deleting) : ''} />
            </AlertDialogDescription>
          </AlertDialogHeader>
          {failed && <Alert tone="error" description={t('groupOperationFailed')} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel')}</AlertDialogCancel>
            <Button loading={busy} disabled={busy} onClick={() => void remove()}>
              {t('confirmOperation')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
