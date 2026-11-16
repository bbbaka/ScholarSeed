import React from 'react'
import { AlarmClock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { FeatureModule } from '../../contracts/features'
import { Button } from '../../components/ui'
import { useApp } from '../../store'
import { SchedulesPage } from './Page'
import { Proposal } from './Proposal'
import { SCHEDULE_CARD, SCHEDULE_ROUTE } from './model'
import { loadScheduleGroups, loadSchedules, openScheduleConversation } from './api'
import { ExecutionDeleteDescription } from './Archive'
import { GroupActions } from './Group'
import {
  ScheduleConversationIcon,
  ScheduleArchiveNotice,
  ScheduleConversationTitle,
  ScheduleOverview,
  ScheduleRunSelector,
} from './Conversation'

function Entry(): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const { state, act } = useApp()
  return (
    <Button
      variant="ghost"
      data-testid="project-schedules"
      aria-pressed={state.mainView === SCHEDULE_ROUTE}
      className="w-full !h-[var(--vds-project-navigation-action-height)] !justify-start !gap-[var(--vds-navigation-button-gap)] !px-[var(--vds-space-2)] !font-[var(--vds-fw-regular)] aria-pressed:!bg-[var(--vds-brand-light-bg-default)] aria-pressed:!text-[var(--vds-brand-text-primary)]"
      onClick={() => act.openWorkbenchView(SCHEDULE_ROUTE, { preserveProject: true })}
    >
      <AlarmClock className="text-[var(--vds-text-7)]" />
      {t('title')}
    </Button>
  )
}

export function schedulesFeature(): FeatureModule {
  return {
    id: SCHEDULE_ROUTE,
    sessionGroups: [
      {
        id: SCHEDULE_ROUTE,
        load: async (projectId) => {
          const [groups, snapshot] = await Promise.all([
            loadScheduleGroups(projectId),
            loadSchedules(projectId),
          ])
          return groups.map((group) => ({
            ...group,
            renderActions: (children) => (
              <GroupActions projectId={projectId} taskId={group.id} name={group.title}>
                {children}
              </GroupActions>
            ),
            open: snapshot.tasks.some((task) => task.id === group.id)
              ? async () => (await openScheduleConversation(projectId, group.id)).session_id
              : undefined,
            renderDeleteDescription: (session) => (
              <ExecutionDeleteDescription name={session.title} />
            ),
            icon: (
              <AlarmClock
                aria-hidden
                className="size-[var(--vds-icon-7)] shrink-0 text-[var(--vds-text-tertiary)]"
              />
            ),
          }))
        },
      },
    ],
    panels: [
      {
        key: 'schedule-readonly-notice',
        slot: 'conversation-readonly-notice',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: (props) => <ScheduleArchiveNotice>{props?.children}</ScheduleArchiveNotice>,
      },
      {
        key: 'schedule-conversation-title',
        slot: 'conversation-title',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: (props) => <ScheduleConversationTitle>{props?.children}</ScheduleConversationTitle>,
      },
      {
        key: 'schedule-conversation-icon',
        slot: 'conversation-title-prefix',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: () => <ScheduleConversationIcon />,
      },
      {
        key: 'schedule-run-selector',
        slot: 'conversation-header',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: () => <ScheduleRunSelector />,
      },
      {
        key: 'schedule-overview-icon',
        slot: 'conversation-overview-icon',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: (props) => (
          <ScheduleConversationIcon overview requestOverviewOpen={props?.requestOverviewOpen}>
            {props?.children}
          </ScheduleConversationIcon>
        ),
      },
      {
        key: 'schedule-overview',
        slot: 'conversation-overview',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: () => <ScheduleOverview />,
      },
      {
        key: 'schedule-entry',
        slot: 'project-action',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: () => <Entry />,
      },
      {
        key: SCHEDULE_ROUTE,
        slot: 'project-page',
        title: (i18n) => i18n.getFixedT(null, 'schedules')('title'),
        render: () => <SchedulesPage />,
      },
    ],
    displayCards: [
      {
        type: SCHEDULE_CARD,
        placement: 'answer',
        render: ({ cardId, content }) => (
          <Proposal key={cardId} cardId={cardId} content={content} />
        ),
      },
    ],
  }
}
