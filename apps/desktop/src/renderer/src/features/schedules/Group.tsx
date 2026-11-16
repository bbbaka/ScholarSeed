import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { deleteSession, setSessionArchived } from '../../api'
import { useApp } from '../../store'
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
} from '../../components/ui'
import type { SessionGroupActions } from '../../contracts/features'
import { loadScheduleConversation, stopScheduleSession } from './api'
import { SCHEDULE_CHANGED, SCHEDULE_ROUTE } from './model'

type Operation = 'archive' | 'delete'

export function GroupActions({
  projectId,
  taskId,
  name,
  children,
}: {
  projectId: string
  taskId: string
  name: string
  children: (actions: SessionGroupActions) => React.ReactNode
}): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const { act, set, state } = useApp()
  const [operation, setOperation] = useState<Operation | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const apply = async (): Promise<void> => {
    if (!operation || busy) return
    setBusy(true)
    setFailed(false)
    const completed: string[] = []
    try {
      const conversation = await loadScheduleConversation(projectId, taskId)
      const sessions = [
        ...new Set([
          ...conversation.runs
            .filter((run) => operation === 'delete' || !run.archived)
            .flatMap((run) => (run.session_id ? [run.session_id] : [])),
          ...(conversation.initial_session_id ? [conversation.initial_session_id] : []),
        ]),
      ]
      for (const sessionId of sessions) {
        await stopScheduleSession(projectId, taskId, sessionId)
        const result =
          operation === 'delete'
            ? await deleteSession(sessionId)
            : await setSessionArchived(sessionId, true)
        if (!result.ok) throw new Error('schedule_group_operation_failed')
        completed.push(sessionId)
      }
      setOperation(null)
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
      for (const sessionId of completed) act.removeSession(sessionId, 'assistant')
      if (completed.includes(state.activeSession ?? ''))
        act.openWorkbenchView(SCHEDULE_ROUTE, { preserveProject: true })
      set((current) => ({ sessionCatalogRevision: current.sessionCatalogRevision + 1 }))
      window.dispatchEvent(new Event(SCHEDULE_CHANGED))
      window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
    }
  }
  return (
    <>
      {children({
        archive: () => {
          setFailed(false)
          setOperation('archive')
        },
        remove: () => {
          setFailed(false)
          setOperation('delete')
        },
      })}
      <AlertDialog
        open={operation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setOperation(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t(operation === 'delete' ? 'deleteConversation' : 'archiveConversation')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                operation === 'delete'
                  ? 'deleteConversationDescription'
                  : 'archiveConversationDescription',
                { name }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {failed && <Alert tone="error" description={t('groupOperationFailed')} />}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{t('cancel')}</AlertDialogCancel>
            <Button loading={busy} disabled={busy} onClick={() => void apply()}>
              {t(failed ? 'retry' : 'confirmOperation')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
