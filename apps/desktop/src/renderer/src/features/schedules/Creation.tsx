import React, { createContext, useContext, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  useToast,
} from '../../components/ui'
import { runSchedule, waitForScheduleRun } from './api'
import { ScheduleCreationContext, type ScheduleCreationSeed } from '../../contracts/navigation'
import type { AssistantSourceContribution } from '../../contracts/features'
import { useApp } from '../../store'
import { newSchedule, SCHEDULE_ROUTE, type Schedule, type ScheduledTask } from './model'

const METHODS = { conversation: 'conversation', form: 'form' } as const
const SourcesContext = createContext<readonly AssistantSourceContribution[]>([])
export const useScheduleSources = (): readonly AssistantSourceContribution[] =>
  useContext(SourcesContext)
type CreationMethod = (typeof METHODS)[keyof typeof METHODS]
interface PendingCreation {
  projectId: string
  schedule: Schedule
  task?: ScheduledTask
}
const PendingContext = createContext<{
  pending: PendingCreation | null
  clear: () => void
  edit: (projectId: string, task: ScheduledTask) => void
}>({ pending: null, clear: () => undefined, edit: () => undefined })

export const useScheduleCreation = (): React.ContextType<typeof PendingContext> =>
  useContext(PendingContext)

export function useScheduleExecution(): (projectId: string, task: ScheduledTask) => Promise<void> {
  const { act } = useApp()
  const { t } = useTranslation('schedules')
  const { toast } = useToast()
  return async (projectId, task) => {
    const run = await runSchedule(projectId, task)
    window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
    toast({ title: t('runRequested'), tone: 'success' })
    try {
      const sessionId = await waitForScheduleRun(projectId, run.run_id)
      act.selectProject(projectId)
      act.openWorkbenchView('resource', { preserveProject: true })
      act.openSession(sessionId, undefined, 'task')
      window.dispatchEvent(new Event('scholarseed:refresh-session-list'))
    } catch {
      toast({ title: t('runNavigationFailed'), tone: 'error' })
    }
  }
}

export function ScheduleCreationProvider({
  children,
  sources = [],
}: {
  children: React.ReactNode
  sources?: readonly AssistantSourceContribution[]
}): React.JSX.Element {
  const { state, act } = useApp()
  const { t } = useTranslation('schedules')
  const [seed, setSeed] = useState<ScheduleCreationSeed | null>(null)
  const [method, setMethod] = useState<CreationMethod>(METHODS.conversation)
  const [projectId, setProjectId] = useState('')
  const [pending, setPending] = useState<PendingCreation | null>(null)
  const project = state.projects.find((item) => item.id === projectId)
  const proceed = (): void => {
    if (!seed || !project) return
    act.selectProject(project.id)
    if (method === METHODS.conversation) {
      act.startDraft({
        projectId: project.id,
        projectLocked: true,
        composerText: t('creation.chatPrompt', { prompt: seed.prompt }),
      })
    } else {
      setPending({ projectId: project.id, schedule: { ...newSchedule(), ...seed } })
      act.openWorkbenchView(SCHEDULE_ROUTE, { preserveProject: true })
    }
    setSeed(null)
  }
  return (
    <ScheduleCreationContext.Provider
      value={(next) => {
        setSeed(next)
        setMethod(METHODS.conversation)
        setProjectId(state.homeSelectedProjectId ?? '')
      }}
    >
      <PendingContext.Provider
        value={{
          pending,
          clear: () => setPending(null),
          edit: (targetProject, task) => {
            setPending({ projectId: targetProject, schedule: task, task })
            act.selectProject(targetProject)
            act.openWorkbenchView(SCHEDULE_ROUTE, { preserveProject: true })
          },
        }}
      >
        <SourcesContext.Provider value={sources}>{children}</SourcesContext.Provider>
      </PendingContext.Provider>
      <Dialog
        open={seed !== null}
        onOpenChange={(open) => {
          if (!open) setSeed(null)
        }}
      >
        <DialogContent data-testid="schedule-creation-dialog">
          <DialogHeader>
            <DialogTitle>{t('creation.title')}</DialogTitle>
            <DialogDescription>{t('creation.methodHint')}</DialogDescription>
          </DialogHeader>
          <RadioGroup
            value={method}
            onValueChange={(value) => setMethod(value as CreationMethod)}
            aria-label={t('creation.methodHint')}
            className="gap-[var(--vds-space-4)]"
          >
            <RadioGroupItem value={METHODS.conversation} label={t('creation.conversation')}>
              <span className="grid gap-[var(--vds-space-1)]">
                <strong>{t('creation.conversation')}</strong>
                <span className="text-[var(--vds-text-secondary)]">
                  {t('creation.conversationHint')}
                </span>
              </span>
            </RadioGroupItem>
            <RadioGroupItem value={METHODS.form} label={t('creation.form')}>
              <span className="grid gap-[var(--vds-space-1)]">
                <strong>{t('creation.form')}</strong>
                <span className="text-[var(--vds-text-secondary)]">{t('creation.formHint')}</span>
              </span>
            </RadioGroupItem>
          </RadioGroup>
          <div className="grid gap-[var(--vds-space-2)]">
            <span className="text-[var(--vds-text-secondary)]">{t('creation.project')}</span>
            {state.projects.length ? (
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger aria-label={t('creation.project')}>
                  <SelectValue placeholder={t('creation.project')} />
                </SelectTrigger>
                <SelectContent>
                  {state.projects.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Button
                variant="secondary"
                onClick={() => {
                  setSeed(null)
                  act.openProjectCenter()
                }}
              >
                {t('creation.createProject')}
              </Button>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSeed(null)}>
              {t('cancel')}
            </Button>
            <Button disabled={!project} onClick={proceed}>
              {t('creation.continue')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ScheduleCreationContext.Provider>
  )
}
