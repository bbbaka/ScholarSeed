import React, { useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  TriangleAlert,
  FileText,
  Grid2X2,
  Layers,
  Sparkles,
  UserRound,
  ChevronDown,
  Quote,
  MessageCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Link,
  PageBody,
  Tabs,
  TabsList,
  TabsTrigger,
  Tooltip,
} from '../../components/ui'
import {
  paperIdentifier,
  paperText,
  paperLanguageName,
  paperOriginalUrl,
  referencePaper,
  relatedEntries,
  TOPIC_LABELS,
  type CuratedPaper,
  type CitationStatistics,
} from './recommendations'
import type { LiteratureSearchPaper } from '../../contracts/literature'
import { PaperThumbnail } from './Thumbnail'

const META =
  'text-[length:var(--vds-discovery-meta)] leading-[var(--vds-discovery-small-line)] text-[var(--vds-text-tertiary)]'
const SECONDARY = 'text-[var(--vds-text-secondary)]'
const MODULE =
  'flex flex-col gap-[var(--vds-space-4)] !rounded-[var(--vds-radius-6)] !px-[var(--vds-discovery-section-x)] !py-[var(--vds-discovery-section-y)] !shadow-none scroll-mt-[var(--vds-space-4)]'
const HEADING =
  'm-0 flex items-center gap-[var(--vds-space-2)] text-[length:var(--vds-discovery-section-title)] font-[var(--vds-fw-semibold)]'

export function CitationCount({
  statistics,
}: {
  statistics?: CitationStatistics
}): React.JSX.Element | null {
  const { t } = useTranslation('literature')
  if (!statistics) return null
  return (
    <p className={`pointer-events-auto relative m-0 ${META}`}>
      <Tooltip
        portalled
        side="top"
        content={
          t('discovery.prototype.citationDetails', { ...statistics }) +
          (statistics.simulated ? ` (${t('discovery.prototype.simulated')})` : '')
        }
      >
        <span
          tabIndex={0}
          aria-label={t('discovery.prototype.citationStatistics', { count: statistics.count })}
          className="inline-flex items-center gap-[var(--vds-space-1)]"
        >
          <Quote className="size-[var(--vds-icon-8)]" aria-hidden="true" />
          {statistics.count}
        </span>
      </Tooltip>
    </p>
  )
}

export function PaperSignal({
  paper,
  compact = false,
}: {
  paper: CuratedPaper
  compact?: boolean
}): React.JSX.Element {
  const { i18n } = useTranslation('literature')
  const language = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const metric = paper.metrics[0]
  return metric ? (
    <div
      className={
        compact
          ? 'flex items-baseline gap-[var(--vds-discovery-tight-gap)] rounded-[var(--vds-radius-4)] border border-[var(--vds-border-default)] bg-[var(--vds-bg-gray-default)] px-[var(--vds-space-3)] py-[var(--vds-discovery-tight-gap)]'
          : 'flex flex-col gap-[var(--vds-space-2)]'
      }
    >
      <strong
        className={
          compact
            ? 'whitespace-nowrap text-[length:var(--vds-discovery-compact-metric)] font-[var(--vds-fw-semibold)] text-[var(--vds-brand-text-primary)]'
            : 'text-[length:var(--vds-discovery-metric)] leading-[var(--vds-discovery-metric-line)] font-[var(--vds-fw-semibold)]'
        }
      >
        {language === 'en' ? metric.valueEn || metric.value : metric.value}
      </strong>
      <span
        className={
          compact
            ? 'text-[length:var(--vds-discovery-caption)] leading-[var(--vds-discovery-hero-line)] text-[var(--vds-text-secondary)]'
            : 'text-[length:var(--vds-discovery-abstract-size)] text-[var(--vds-text-secondary)]'
        }
      >
        {metric[language]}
      </span>
      {!compact && (
        <>
          <span className="text-[length:var(--vds-discovery-caption)] text-[var(--vds-text-tertiary)]">
            {language === 'en' ? metric.sourceEn : metric.source}
          </span>
          {paper.metrics.length > 1 && (
            <dl className="mt-[var(--vds-space-3)] mb-0 grid grid-cols-2 gap-[var(--vds-space-4)] border-t border-[var(--vds-border-default)] pt-[var(--vds-space-4)]">
              {paper.metrics.slice(1, 3).map((extra) => (
                <div key={extra.value}>
                  <dt className="text-[length:var(--vds-discovery-stat-value)] font-[var(--vds-fw-semibold)]">
                    {language === 'en' ? extra.valueEn || extra.value : extra.value}
                  </dt>
                  <dd className="mx-0 mt-[var(--vds-space-1)] text-[length:var(--vds-discovery-small)] text-[var(--vds-text-secondary)]">
                    {extra[language]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </>
      )}
    </div>
  ) : (
    <ol
      className={
        compact
          ? 'm-0 flex list-none flex-wrap items-center gap-[var(--vds-space-2)] rounded-[var(--vds-radius-4)] border border-[var(--vds-border-default)] bg-[var(--vds-bg-gray-default)] p-[var(--vds-space-3)] text-[length:var(--vds-discovery-caption)]'
          : 'm-0 grid list-none gap-[var(--vds-space-3)] p-0'
      }
    >
      {paper.reading[language].flow.map((step, index) => (
        <li key={step.stage} className="flex items-center gap-[var(--vds-space-2)]">
          {compact ? (
            index > 0 && (
              <ArrowRight className="size-[var(--vds-icon-6)] shrink-0 text-[var(--vds-text-tertiary)]" />
            )
          ) : (
            <span className="flex size-[var(--vds-space-6)] shrink-0 items-center justify-center rounded-[var(--vds-radius-3)] bg-[var(--vds-bg-white-default)] text-[length:var(--vds-discovery-caption)]">
              {index + 1}
            </span>
          )}
          <span>
            <span className={compact ? '' : 'font-[var(--vds-fw-semibold)]'}>{step.title}</span>
            {!compact && (
              <span className={`block text-[length:var(--vds-discovery-small)] ${SECONDARY}`}>
                {step.description}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function Reader({
  paper,
  admission,
  onBack,
  onOriginal,
  onDiscuss,
  admissionReference,
  scroll,
  onScroll,
}: {
  paper: CuratedPaper
  admission: (paper: CuratedPaper) => React.ReactNode
  onBack: () => void
  onOriginal: (url: string) => void
  onDiscuss: () => void
  admissionReference: (paper: LiteratureSearchPaper) => React.ReactNode
  scroll: number
  onScroll: (position: number) => void
}): React.JSX.Element {
  const { t, i18n } = useTranslation('literature')
  const language = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const [abstractMode, setAbstractMode] = useState('system')
  const systemText = paperText(paper, language)
  const abstractText = paperText(paper, language, abstractMode === 'original')
  useLayoutEffect(() => {
    setAbstractMode('system')
  }, [paper.id, language])
  const [referencesOpen, setReferencesOpen] = useState(true)
  const [overviewOpen, setOverviewOpen] = useState(true)
  const [relatedOpen, setRelatedOpen] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const initialScroll = useRef(scroll)
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = initialScroll.current
  }, [])
  const reading = paper.reading[language]
  const related = relatedEntries(paper)
  const identifier = paperIdentifier(paper.metadata)
  const brief = [
    { section: 'question', label: t('discovery.curated.problem'), value: reading.question },
    {
      section: 'approach',
      label: t('discovery.curated.approach'),
      value: reading.approach,
    },
    { section: 'finding', label: t('discovery.curated.takeaway'), value: reading.finding },
  ]
  return (
    <>
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-[var(--vds-space-3)] border-b border-[var(--vds-border-default)] px-[var(--vds-space-8)] py-[var(--vds-discovery-tight-gap)]">
        <Button variant="secondary" icon={<ArrowLeft />} onClick={onBack}>
          {t('discovery.curated.back')}
        </Button>
        <div className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
          <Button variant="secondary" icon={<MessageCircle />} onClick={onDiscuss}>
            {t('discovery.discussPaper')}
          </Button>
          <Button variant="secondary" icon={<FileText />} onClick={() => onOriginal(paper.pdf)}>
            {t('discovery.prototype.pdf')}
          </Button>
          {admission(paper)}
        </div>
      </header>
      <PageBody
        scroll="content"
        data-testid="discovery-reading"
        className="!block"
        ref={scrollRef}
        onScroll={(event) => onScroll(event.currentTarget.scrollTop)}
      >
        <div className="flex w-full max-w-[var(--vds-discovery-reader-width)] flex-wrap items-start gap-[var(--vds-discovery-page-y)] px-[var(--vds-space-5)] pt-[var(--vds-space-6)] pb-[var(--vds-discovery-page-bottom)] @[900px]:px-[var(--vds-discovery-page-x)] @[900px]:pt-[var(--vds-discovery-reader-top)]">
          <article className="flex min-w-0 w-full flex-col gap-[var(--vds-discovery-grid-gap)]">
            <header className="flex flex-col gap-[var(--vds-discovery-tight-gap)] px-[var(--vds-space-half)] pt-[var(--vds-space-1)] pb-[var(--vds-discovery-tight-gap)]">
              <h1 className="m-0 break-words font-[family-name:var(--vds-font-serif)] text-[length:var(--vds-font-display-lv2)] leading-[var(--vds-discovery-reader-title-line)] font-[var(--vds-fw-semibold)] @[900px]:text-[length:var(--vds-discovery-reader-title)]">
                {systemText.title || paper.metadata.title}
              </h1>
              <p
                className={`m-0 text-[length:var(--vds-font-subhead)] font-[var(--vds-fw-semibold)] ${SECONDARY}`}
              >
                {systemText.title !== paper.metadata.title
                  ? paper.metadata.title
                  : reading.headline}
              </p>
              <p
                className={`m-0 flex items-start gap-[var(--vds-space-2)] text-[length:var(--vds-discovery-body)] ${SECONDARY}`}
              >
                <UserRound className="mt-[var(--vds-space-half)] size-[var(--vds-icon-8)] shrink-0 text-[var(--vds-text-tertiary)]" />
                <span>
                  {paper.metadata.authors.join(', ')}
                  {paper.affiliations.length > 0 && ` · ${paper.affiliations.join(' · ')}`}
                </span>
              </p>
              <div className={`flex flex-wrap items-center gap-[var(--vds-space-2)] ${META}`}>
                <span>
                  {paper.metadata.venue} · {paper.published}
                </span>
                {identifier && (
                  <Link
                    href={identifier.url}
                    className="max-w-full !text-[var(--vds-brand-text-primary)] font-[var(--vds-fw-medium)] !no-underline hover:!underline"
                    onClick={(event) => {
                      event.preventDefault()
                      onOriginal(identifier.url)
                    }}
                  >
                    {identifier.label}
                  </Link>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
                {paper.topics.map((topic) => (
                  <Badge key={topic}>{t(TOPIC_LABELS[topic])}</Badge>
                ))}
                {paper.openAccess && (
                  <Badge tone="success">{t('discovery.prototype.openAccess')}</Badge>
                )}
              </div>
            </header>
            <Card className={MODULE}>
              <div className="flex flex-wrap items-center justify-between gap-[var(--vds-space-2)]">
                <h2 className={HEADING}>
                  <FileText className="size-[var(--vds-icon-8)]" />
                  {t('discovery.prototype.abstract')}
                </h2>
                <Tabs value={abstractMode} onValueChange={setAbstractMode}>
                  <TabsList aria-label={t('discovery.prototype.abstractLanguage')}>
                    <TabsTrigger value="system">
                      {t('discovery.prototype.localizedSummary', {
                        language: paperLanguageName(language, language),
                      })}
                    </TabsTrigger>
                    <TabsTrigger value="original">
                      {t('discovery.prototype.originalAbstract', {
                        language: paperLanguageName(paper.originalLanguage, language),
                      })}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <p
                lang={abstractText.language}
                className={`m-0 text-[length:var(--vds-discovery-abstract-size)] leading-[var(--vds-discovery-abstract-line)] ${SECONDARY}`}
              >
                {abstractText.abstract ||
                  t(
                    abstractMode === 'original'
                      ? 'discovery.prototype.abstractUnavailable'
                      : 'discovery.prototype.translationUnavailable'
                  )}
              </p>
            </Card>
            <Card className={MODULE}>
              <Collapsible open={overviewOpen} onOpenChange={setOverviewOpen}>
                <h2 className={HEADING}>
                  <CollapsibleTrigger asChild>
                    <Button
                      unstyled
                      className="flex w-full items-center gap-[var(--vds-space-2)] !border-0 !bg-transparent !p-0 text-left"
                    >
                      <Sparkles className="size-[var(--vds-icon-8)] text-[var(--vds-brand-text-primary)]" />
                      {t('discovery.prototype.overview')}
                      <ChevronDown
                        className={`ml-auto size-[var(--vds-icon-8)] ${overviewOpen ? '' : '-rotate-90'}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </h2>
                <CollapsibleContent className="flex flex-col gap-[var(--vds-space-4)] !border-0 !bg-transparent !p-0">
                  <p className="m-0 rounded-r-[var(--vds-radius-5)] border-l-[length:var(--vds-discovery-quote-border)] border-[var(--vds-brand-text-primary)] bg-[var(--vds-brand-light-bg-default)] px-[var(--vds-discovery-grid-gap)] py-[var(--vds-discovery-soft-inset)] text-[length:var(--vds-font-subhead)] leading-[var(--vds-discovery-body-line)]">
                    {reading.summary}
                  </p>
                  <dl className="m-0 flex flex-col gap-[var(--vds-space-4)]">
                    {brief.map((item, index) => (
                      <div
                        key={item.label}
                        className="min-w-0 rounded-[var(--vds-radius-5)] border border-[var(--vds-divider-default)] p-[var(--vds-space-4)]"
                      >
                        <dt className="mb-[var(--vds-space-2)] text-[length:var(--vds-font-subhead)] font-[var(--vds-fw-semibold)] text-[var(--vds-text-primary)]">
                          <span className="mr-[var(--vds-space-2)] text-[var(--vds-brand-text-primary)]">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          {item.label}
                        </dt>
                        <dd
                          className={`m-0 text-[length:var(--vds-discovery-body)] leading-[var(--vds-discovery-body-line)] ${SECONDARY}`}
                        >
                          {item.value}
                          {paper.evidence?.map(
                            (evidence, index) =>
                              evidence.section === item.section && (
                                <Tooltip
                                  key={index}
                                  portalled
                                  side="top"
                                  content={
                                    <span className="flex flex-col gap-[var(--vds-space-1)]">
                                      <span>
                                        {t('discovery.prototype.evidencePage', {
                                          index: index + 1,
                                          page: evidence.page,
                                        })}
                                      </span>
                                      {evidence.location && <span>{evidence.location}</span>}
                                    </span>
                                  }
                                >
                                  <Button
                                    unstyled
                                    aria-label={t('discovery.prototype.evidencePage', {
                                      index: index + 1,
                                      page: evidence.page,
                                    })}
                                    className="ml-[var(--vds-space-1)] !text-[var(--vds-brand-text-primary)]"
                                    onClick={(event) => {
                                      event.preventDefault()
                                      onOriginal(`${paper.pdf}#page=${evidence.page}`)
                                    }}
                                  >
                                    [{index + 1}]
                                  </Button>
                                </Tooltip>
                              )
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <PaperThumbnail paper={paper.metadata} expanded />
                  {paper.metrics.length > 0 && (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--vds-discovery-stat-min)),1fr))] gap-[var(--vds-space-3)]">
                      {paper.metrics.map((metric) => (
                        <div
                          key={metric.value}
                          className="flex flex-col gap-[var(--vds-space-1)] rounded-[var(--vds-radius-5)] border border-[var(--vds-border-default)] bg-[var(--vds-bg-gray-default)] px-[var(--vds-space-5)] py-[var(--vds-discovery-grid-gap)]"
                        >
                          <strong className="text-[length:var(--vds-discovery-stat-value)] font-[var(--vds-fw-semibold)] text-[var(--vds-brand-text-primary)]">
                            {language === 'en' ? metric.valueEn || metric.value : metric.value}
                          </strong>
                          <span className={`text-[length:var(--vds-discovery-small)] ${SECONDARY}`}>
                            {metric[language]}
                          </span>
                          <span className={META}>
                            {language === 'en' ? metric.sourceEn : metric.source}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div>
                    <h3
                      className={`mt-0 mb-[var(--vds-space-2)] font-[var(--vds-fw-semibold)] ${META}`}
                    >
                      {t('discovery.prototype.flow')}
                    </h3>
                    <ol className="m-0 flex list-none flex-wrap gap-[var(--vds-space-2)] p-0">
                      {reading.flow.map((step, index) => (
                        <li
                          key={step.stage}
                          className={`flex min-w-0 flex-[1_1_var(--vds-discovery-flow-min)] flex-col items-start gap-[var(--vds-space-2)] rounded-[var(--vds-radius-5)] border p-[var(--vds-discovery-soft-inset)] ${index === 1 || index === 2 ? 'border-[var(--vds-brand-light-border)] bg-[var(--vds-brand-light-bg-default)]' : 'border-[var(--vds-border-default)]'}`}
                        >
                          <span className={META}>
                            {index + 1} · {step.stage}
                          </span>
                          <span className="text-[length:var(--vds-discovery-small)] leading-[var(--vds-discovery-small-line)]">
                            <strong className="mb-[var(--vds-space-1)] block font-[var(--vds-fw-semibold)]">
                              {step.title}
                            </strong>
                            <span className={SECONDARY}>{step.description}</span>
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                  {reading.terms && reading.terms.length > 0 && (
                    <div>
                      <h3
                        className={`mt-0 mb-[var(--vds-space-2)] font-[var(--vds-fw-semibold)] ${META}`}
                      >
                        {t('discovery.prototype.terms')}
                      </h3>
                      <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--vds-discovery-term-min)),1fr))] gap-[var(--vds-space-3)]">
                        {reading.terms.map((term) => (
                          <div
                            key={term.name}
                            className="rounded-[var(--vds-radius-5)] border border-[var(--vds-border-default)] p-[var(--vds-space-4)]"
                          >
                            <dt className="mb-[var(--vds-space-1)] text-[length:var(--vds-discovery-body)] font-[var(--vds-fw-semibold)]">
                              {term.name}
                            </dt>
                            <dd
                              className={`m-0 text-[length:var(--vds-discovery-small)] leading-[var(--vds-discovery-small-line)] ${SECONDARY}`}
                            >
                              {term.description}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                  {reading.limitations.length > 0 && (
                    <div className="text-[length:var(--vds-discovery-small)] leading-[var(--vds-discovery-small-line)]">
                      <strong className="font-[var(--vds-fw-semibold)]">
                        {t('discovery.curated.caution')}
                      </strong>
                      <ul className="m-0 list-none space-y-[var(--vds-space-2)] p-0 pt-[var(--vds-space-2)]">
                        {reading.limitations.map((limitation) => (
                          <li
                            key={limitation}
                            className="flex gap-[var(--vds-space-2)] rounded-[var(--vds-radius-5)] bg-[var(--vds-bg-gray-default)] p-[var(--vds-space-3)]"
                          >
                            <TriangleAlert className="size-[var(--vds-icon-8)] shrink-0" />
                            <span className={SECONDARY}>{limitation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </Card>
            <Card className={MODULE}>
              <Collapsible open={referencesOpen} onOpenChange={setReferencesOpen}>
                <h2 className={HEADING}>
                  <CollapsibleTrigger asChild>
                    <Button
                      unstyled
                      className="flex w-full items-center gap-[var(--vds-space-2)] !border-0 !bg-transparent !p-0 text-left"
                    >
                      <Layers className="size-[var(--vds-icon-8)]" />
                      {t('discovery.prototype.references')}
                      <span
                        className={`ml-[var(--vds-space-1)] font-[var(--vds-fw-regular)] ${META}`}
                      >
                        {paper.references.length}
                      </span>
                      <ChevronDown
                        className={`ml-auto size-[var(--vds-icon-8)] ${referencesOpen ? '' : '-rotate-90'}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </h2>
                <CollapsibleContent className="!border-0 !bg-transparent !p-0">
                  {paper.references.length > 0 ? (
                    <ol className="m-0 list-none overflow-hidden rounded-[var(--vds-radius-5)] border border-[var(--vds-border-default)] divide-y divide-[var(--vds-border-default)] p-0">
                      {paper.references.map((reference, index) => {
                        const metadata = referencePaper(paper, index)
                        return (
                          <li
                            key={index}
                            className="group/citation flex flex-wrap items-center gap-[var(--vds-space-3)] px-[var(--vds-space-4)] py-[var(--vds-space-3)] hover:bg-[var(--vds-bg-gray-default)]"
                          >
                            <span className={`self-start ${META}`}>{index + 1}.</span>
                            <div className="min-w-0 flex-1">
                              <Link
                                href={metadata.url ?? ''}
                                className="font-[family-name:var(--vds-font-serif)] text-[length:var(--vds-discovery-abstract-size)] leading-[var(--vds-discovery-small-line)] !no-underline hover:!underline hover:!text-[var(--vds-brand-text-primary)]"
                                onClick={(event) => {
                                  event.preventDefault()
                                  if (metadata.url) onOriginal(metadata.url)
                                }}
                              >
                                {reference.title}
                              </Link>
                              {(reference.authors || reference.year || reference.venue) && (
                                <p className={`mt-[var(--vds-space-1)] mb-0 ${META}`}>
                                  {[reference.authors, reference.year, reference.venue]
                                    .filter(Boolean)
                                    .join(' · ')}
                                </p>
                              )}
                              <CitationCount statistics={reference.citations} />
                            </div>
                            <div className="shrink-0 opacity-0 group-hover/citation:opacity-[var(--vds-opacity-full)] group-focus-within/citation:opacity-[var(--vds-opacity-full)] has-[[data-state=open]]:opacity-[var(--vds-opacity-full)] [@media(hover:none)]:opacity-[var(--vds-opacity-full)]">
                              {admissionReference(metadata)}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className={`m-0 ${META}`}>{t('discovery.prototype.noReferences')}</p>
                  )}
                  {paper.references.length > 0 && !paper.referenceComplete && (
                    <p className={`m-0 ${META}`}>
                      {t('discovery.prototype.partialReferences', {
                        count: paper.references.length,
                      })}
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </Card>
            <Card className={MODULE}>
              <Collapsible open={relatedOpen} onOpenChange={setRelatedOpen}>
                <h2 className={HEADING}>
                  <CollapsibleTrigger asChild>
                    <Button
                      unstyled
                      className="flex w-full items-center gap-[var(--vds-space-2)] !border-0 !bg-transparent !p-0 text-left"
                    >
                      <Grid2X2 className="size-[var(--vds-icon-8)]" />
                      {t('discovery.prototype.related')}
                      <span
                        className={`ml-[var(--vds-space-1)] font-[var(--vds-fw-regular)] ${META}`}
                      >
                        {related.length}
                      </span>
                      <ChevronDown
                        className={`ml-auto size-[var(--vds-icon-8)] ${relatedOpen ? '' : '-rotate-90'}`}
                      />
                    </Button>
                  </CollapsibleTrigger>
                </h2>
                <CollapsibleContent className="!border-0 !bg-transparent !p-0">
                  {related.length === 0 && (
                    <p className={`m-0 ${META}`}>{t('discovery.prototype.noRelated')}</p>
                  )}
                  <div className="overflow-hidden rounded-[var(--vds-radius-5)] border border-[var(--vds-border-default)] divide-y divide-[var(--vds-border-default)]">
                    {related.map((item) => (
                      <div
                        key={item.metadata.paper_id}
                        className="group/citation flex flex-wrap items-center justify-between gap-[var(--vds-space-3)] px-[var(--vds-space-4)] py-[var(--vds-space-3)] hover:bg-[var(--vds-bg-gray-default)]"
                      >
                        <div className="grid min-w-0 flex-1 gap-[var(--vds-space-1)] text-left">
                          <Link
                            href={paperOriginalUrl(item.metadata) ?? ''}
                            className="font-[family-name:var(--vds-font-serif)] text-[length:var(--vds-discovery-abstract-size)] !no-underline hover:!underline hover:!text-[var(--vds-brand-text-primary)]"
                            onClick={(event) => {
                              event.preventDefault()
                              const url = paperOriginalUrl(item.metadata)
                              if (url) onOriginal(url)
                            }}
                          >
                            {item.metadata.title}
                          </Link>
                          <span className={`text-[length:var(--vds-discovery-small)] ${SECONDARY}`}>
                            {item.curated
                              ? item.curated.reading[language].headline
                              : t('discovery.prototype.fromReferences')}
                          </span>
                          <span className={META}>
                            {[item.metadata.venue, item.curated?.published ?? item.metadata.year]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                          <span className={META}>{item.metadata.authors.join(', ')}</span>
                          <CitationCount
                            statistics={
                              paper.relatedCitations?.[item.metadata.paper_id] ??
                              item.curated?.citations
                            }
                          />
                        </div>
                        <div className="shrink-0 opacity-0 group-hover/citation:opacity-[var(--vds-opacity-full)] group-focus-within/citation:opacity-[var(--vds-opacity-full)] has-[[data-state=open]]:opacity-[var(--vds-opacity-full)] [@media(hover:none)]:opacity-[var(--vds-opacity-full)]">
                          {item.curated
                            ? admission(item.curated)
                            : admissionReference(item.metadata)}
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          </article>
        </div>
      </PageBody>
    </>
  )
}
