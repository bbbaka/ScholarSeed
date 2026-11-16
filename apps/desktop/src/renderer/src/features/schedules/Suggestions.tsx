import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Clock, RefreshCw } from 'lucide-react'
import { Alert, Button, Card, IconButton, PageSection, Spinner, Tooltip } from '../../components/ui'
import type { Project } from '../../api'
import { useApp } from '../../store'
import { listProjectFiles } from '../project/api'
import { listLiteratures } from '../literature/api'
import { scheduleCadence, scheduleLabels } from './labels'
import type { Schedule } from './model'
import {
  RECOMMENDATION_PAPER_LIMIT,
  RECOMMENDATION_PAGE_SIZE,
  RECOMMENDATION_WIDE_WIDTH,
  FIXED_RECOMMENDATIONS,
  recommendationDraft,
  recommendationPage,
  recommendationSources,
  type RecommendationEvidence,
} from './recommendations'

const ICON = 'size-[var(--vds-icon-8)] shrink-0'

export function Suggestions({
  project,
  excludedSessions,
  onChoose,
}: {
  project: Project
  excludedSessions: ReadonlySet<string>
  onChoose: (draft: Schedule) => void
}): React.JSX.Element {
  const { t } = useTranslation('schedules')
  const { state } = useApp()
  const [evidence, setEvidence] = useState<Omit<RecommendationEvidence, 'sessions'> | null>(null)
  const [failed, setFailed] = useState(false)
  const [retry, setRetry] = useState(0)
  const [page, setPage] = useState(0)
  const refresh = (): void => {
    setEvidence(null)
    setFailed(false)
    setPage(0)
    setRetry((current) => current + 1)
  }
  const heading = useRef<HTMLSpanElement>(null)
  const [pageSize, setPageSize] = useState(RECOMMENDATION_PAGE_SIZE)
  useEffect(() => {
    const element = heading.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setPageSize(
        entry.contentRect.width >= RECOMMENDATION_WIDE_WIDTH ? RECOMMENDATION_PAGE_SIZE : 1
      )
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setEvidence(null)
    setFailed(false)
    void Promise.all([
      listProjectFiles(project.id, controller.signal),
      listLiteratures(
        {
          project_id: project.id,
          sort: 'updated_at',
          order: 'desc',
          page: 1,
          page_size: RECOMMENDATION_PAPER_LIMIT,
        },
        controller.signal
      ),
    ])
      .then(([files, papers]) => {
        if (controller.signal.aborted) return
        if (!files) {
          setFailed(true)
          return
        }
        setEvidence({ files, papers: papers.items })
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true)
      })
    return () => controller.abort()
  }, [project.id, state.resourceRevision, retry])
  const sources = useMemo(
    () =>
      evidence
        ? recommendationSources(
            project,
            { ...evidence, sessions: state.sessions },
            excludedSessions
          )
        : [],
    [project.path, project.description, evidence, state.sessions, excludedSessions]
  )
  const fingerprint = sources.map((source) => `${source.id}:${source.title}`).join('\n')
  useEffect(() => setPage(0), [fingerprint, pageSize])
  const examples = scheduleLabels(t).examples
  const copy = {
    paper: {
      name: t('recommendations.paper.name'),
      description: t('recommendations.paper.description'),
      basis: t('recommendations.paper.basis'),
    },
    file: {
      name: t('recommendations.file.name'),
      description: t('recommendations.file.description'),
      basis: t('recommendations.file.basis'),
    },
    session: {
      name: t('recommendations.session.name'),
      description: t('recommendations.session.description'),
      basis: t('recommendations.session.basis'),
    },
    project: {
      name: t('recommendations.project.name'),
      description: t('recommendations.project.description'),
      basis: t('recommendations.project.basis'),
    },
  }
  const cards: { id: string; name: string; description: string; basis: string; draft: Schedule }[] =
    [
      ...sources.map((source) => {
        const details = copy[source.kind]
        const reference = source.reference
        const prompts = {
          paper: () => t('recommendations.paper.prompt', { reference }),
          file: () => t('recommendations.file.prompt', { reference }),
          session: () => t('recommendations.session.prompt', { reference }),
          project: () => t('recommendations.project.prompt', { reference }),
        }
        return {
          id: source.id,
          name: t('recommendations.named', { action: details.name, topic: source.title }),
          description: details.description,
          basis: `${details.basis} · ${source.title}`,
          draft: recommendationDraft(source.kind, {
            name: t('recommendations.named', { action: details.name, topic: source.title }),
            prompt: prompts[source.kind](),
          }),
        }
      }),
      ...FIXED_RECOMMENDATIONS.map(({ example, kind }) => ({
        id: example,
        ...examples[example],
        basis: '',
        draft: recommendationDraft(kind, examples[example]),
      })),
    ]
  const visible = recommendationPage(cards, page, pageSize)
  return (
    <PageSection
      className="shrink-0"
      title={
        <span ref={heading} className="flex items-center justify-between gap-[var(--vds-space-3)]">
          <span className="flex items-center gap-[var(--vds-space-2)]">
            <span>{t('examplesTitle')}</span>
            <Tooltip content={t('recommendations.refresh')} side="top">
              <IconButton
                size="sm"
                variant="ghost"
                label={t('recommendations.refresh')}
                title={undefined}
                icon={<RefreshCw />}
                loading={!evidence && !failed}
                disabled={!evidence && !failed}
                onClick={refresh}
              />
            </Tooltip>
          </span>
          {evidence && visible.total > 1 && (
            <span className="flex items-center gap-[var(--vds-space-2)]">
              <span
                aria-live="polite"
                className="text-[length:var(--vds-font-caption)] font-[var(--vds-fw-regular)] text-[var(--vds-text-tertiary)]"
              >
                {t('recommendations.page', { current: visible.index + 1, total: visible.total })}
              </span>
              <IconButton
                size="sm"
                variant="secondary"
                className="rounded-full"
                label={t('recommendations.previous')}
                icon={<ChevronLeft />}
                disabled={visible.index === 0}
                onClick={() => setPage(visible.index - 1)}
              />
              <IconButton
                size="sm"
                variant="secondary"
                className="rounded-full"
                label={t('recommendations.next')}
                icon={<ChevronRight />}
                disabled={visible.index === visible.total - 1}
                onClick={() => setPage(visible.index + 1)}
              />
            </span>
          )}
        </span>
      }
    >
      {failed ? (
        <Alert
          tone="error"
          action={
            <Button variant="ghost" size="sm" onClick={refresh}>
              {t('retry')}
            </Button>
          }
        >
          {t('recommendations.failed')}
        </Alert>
      ) : !evidence ? (
        <div
          role="status"
          className="flex items-center gap-[var(--vds-space-2)] text-[var(--vds-text-secondary)]"
        >
          <Spinner />
          {t('recommendations.loading')}
        </div>
      ) : (
        <div
          className={
            pageSize === 1
              ? 'grid grid-cols-1 gap-[var(--vds-space-4)]'
              : 'grid grid-cols-3 gap-[var(--vds-space-4)]'
          }
        >
          {visible.items.map((card) => (
            <Card
              key={card.id}
              className="min-w-0"
              data-testid="schedule-recommendation"
              data-recommendation-id={card.id}
            >
              <Button
                variant="ghost"
                className="!h-auto h-full w-full !justify-start !whitespace-normal !p-0 !text-start"
                onClick={() => onChoose(card.draft)}
              >
                <span className="flex h-full min-w-0 flex-col gap-[var(--vds-space-3)]">
                  <strong className="line-clamp-2 text-[length:var(--vds-font-subhead)] leading-[var(--vds-lh-subhead)] font-[var(--vds-fw-medium)] text-[var(--vds-text-primary)]">
                    {card.name}
                  </strong>
                  <span className="line-clamp-2 text-[length:var(--vds-font-body-lv2)] leading-[var(--vds-lh-body-lv2)] font-[var(--vds-fw-regular)] text-[var(--vds-text-secondary)]">
                    {card.description}
                  </span>
                  <span className="mt-auto grid min-w-0 gap-[var(--vds-space-2)] text-[length:var(--vds-font-caption)] leading-[var(--vds-lh-caption)] font-[var(--vds-fw-regular)] text-[var(--vds-text-tertiary)]">
                    {card.basis && (
                      <span className="truncate" title={card.basis}>
                        {card.basis}
                      </span>
                    )}
                    <span className="flex items-center gap-[var(--vds-space-2)]">
                      <Clock aria-hidden="true" className={ICON} />
                      {scheduleCadence(card.draft, t)}
                    </span>
                  </span>
                </span>
              </Button>
            </Card>
          ))}
        </div>
      )}
    </PageSection>
  )
}
