import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  AlarmClock,
  Link2,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  BookmarkCheck,
  Search,
  RefreshCw,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Page,
  PageBody,
  Tooltip,
  Tabs,
  TabsList,
  TabsTrigger,
  Toggle,
  useToast,
  Input,
  IconButton,
  Tag,
} from '../../components/ui'
import { useApp } from '../../store'
import { PaperThumbnail } from './Thumbnail'
import {
  DiscoveryFeedContext,
  HOT_DISCOVERY_PERIODS,
  visibleFeedMode,
  recommendationBatch,
  createInterest,
  INTEREST_TEXT_LIMIT,
  type DiscoveryInterest,
} from './feed'
import { writeClipboard } from '../../components/primitive/clipboard'
import { Reader } from './Reader'
import { ScheduleCreationContext, WebNavigationContext } from '../../contracts/navigation'
import { catalogue, useCatalogue } from './catalog'
import type { LiteratureSearchPaper } from '../../contracts/literature'
import { JoinLibraryMenu } from './JoinMenu'
import { createLiteratureSearch, loadSearchLibraryStatus } from './api'
import {
  CURATED_PAPERS,
  CURATED_TOPICS,
  TOPIC_LABELS,
  DISCOVERY_EDITION,
  filterPapers,
  type DiscoveryPeriod,
  type CuratedPaper,
} from './recommendations'

const PERIOD_LABELS = {
  today: 'discovery.prototype.periods.today',
  week: 'discovery.prototype.periods.week',
  month: 'discovery.prototype.periods.month',
} as const
const ICON = 'size-[var(--vds-icon-8)] shrink-0'
const SECONDARY = 'text-[var(--vds-text-secondary)]'
const META =
  'text-[length:var(--vds-discovery-meta)] leading-[var(--vds-discovery-small-line)] text-[var(--vds-text-tertiary)]'
const HEADING =
  'm-0 text-[length:var(--vds-font-title)] leading-[var(--vds-lh-title)] font-[var(--vds-fw-semibold)]'

export function Discovery(): React.JSX.Element {
  const { act } = useApp()
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const searchPending = useRef(false)
  const { t, i18n } = useTranslation('literature')
  const feed = useContext(DiscoveryFeedContext)
  const [requestedMode, setMode] = useState('hot')
  const [batch, setBatch] = useState(0)
  const [interestDraft, setInterestDraft] = useState('')
  const [customInterests, setCustomInterests] = useState<DiscoveryInterest[]>([])
  const interestInput = useRef<HTMLInputElement>(null)
  const addInterest = (): void => {
    const interest = createInterest(interestDraft, customInterests)
    if (!interest) return
    if (!customInterests.some((item) => item.id === interest.id)) {
      setCustomInterests((current) => [...current, interest])
    }
    setInterestDraft('')
    interestInput.current?.focus()
  }
  const mode = visibleFeedMode(requestedMode, feed)
  const { toast } = useToast()
  const search = async (): Promise<void> => {
    if (!query.trim() || searchPending.current) return
    searchPending.current = true
    setSearching(true)
    try {
      act.openLiteratureSearch(await createLiteratureSearch(query.trim()))
    } catch {
      toast({ title: t('panel.error.searchFailed'), tone: 'error' })
    } finally {
      searchPending.current = false
      setSearching(false)
    }
  }
  const createSchedule = useContext(ScheduleCreationContext)
  const [hidden, setHidden] = useState<string[]>([])
  const [votes, setVotes] = useState<Record<string, 'like' | 'dislike' | undefined>>({})
  const navigateWeb = useContext(WebNavigationContext)
  const { reload, discovery } = useCatalogue()
  const { topic } = discovery
  const period = discovery.period === 'today' ? 'week' : discovery.period
  const setTopic = (topic: string): void => catalogue.discovery({ topic })
  const setPeriod = (period: DiscoveryPeriod): void => catalogue.discovery({ period })
  const paper = CURATED_PAPERS.find((item) => item.id === discovery.paperId) ?? null
  const setPaper = (paper: CuratedPaper | null): void =>
    catalogue.discovery({ paperId: paper?.id ?? null, scroll: 0 })
  const listRef = useRef<HTMLDivElement>(null)
  const scrollPosition = useRef(0)
  const lastCard = useRef<HTMLButtonElement | null>(null)
  const lastCardId = useRef('')
  const [saved, setSaved] = useState<string[]>([])
  const language = i18n.resolvedLanguage?.startsWith('zh') ? 'zh' : 'en'
  const personalBatch = recommendationBatch(feed, batch, hidden)
  const visible =
    mode === 'personal'
      ? personalBatch.entries.flatMap((entry) => {
          const match = CURATED_PAPERS.find(
            (item) => item.id === entry.paperId && !hidden.includes(item.id)
          )
          return match ? [match] : []
        })
      : filterPapers(
          CURATED_PAPERS.filter((item) => !hidden.includes(item.id)),
          {
            topic,
            period,
            now: new Date(DISCOVERY_EDITION + 'T12:00:00'),
          }
        )
  const openPaper = (item: CuratedPaper, trigger?: HTMLButtonElement): void => {
    scrollPosition.current = listRef.current?.scrollTop ?? scrollPosition.current
    lastCard.current = trigger ?? null
    lastCardId.current = item.id
    setPaper(item)
  }
  useEffect(() => {
    let active = true
    void loadSearchLibraryStatus(CURATED_PAPERS.map((item) => item.metadata))
      .then((ids) => {
        if (active) setSaved(ids)
      })
      .catch(() => {
        if (active) toast({ title: t('discovery.prototype.libraryFailed'), tone: 'error' })
      })
    return () => {
      active = false
    }
  }, [reload, t, toast])
  useLayoutEffect(() => {
    if (!paper && listRef.current) {
      listRef.current.scrollTop = scrollPosition.current
      lastCard.current?.focus({ preventScroll: true })
    }
  }, [paper])
  const admissionMetadata = (
    metadata: LiteratureSearchPaper,
    iconOnly = false
  ): React.JSX.Element =>
    saved.includes(metadata.paper_id) ? (
      iconOnly ? (
        <Tooltip content={t('join.added')} portalled side="top">
          <IconButton
            label={t('join.added')}
            title={undefined}
            icon={<BookmarkCheck />}
            className="!text-[var(--vds-brand-text-primary)] !bg-[var(--vds-brand-light-bg-default)]"
            variant="ghost"
            size="sm"
            aria-disabled="true"
          />
        </Tooltip>
      ) : (
        <Badge tone="success">{t('join.added')}</Badge>
      )
    ) : (
      <JoinLibraryMenu
        papers={[metadata]}
        label={t('discovery.prototype.joinLibrary')}
        icon={iconOnly ? <Bookmark className={ICON} /> : undefined}
        iconOnly={iconOnly}
        showChevron={false}
        className="!bg-[var(--vds-bg-white-default)] hover:!bg-[var(--vds-bg-gray-default)]"
        onJoined={() => setSaved((current) => [...current, metadata.paper_id])}
      />
    )
  const admission = (item: CuratedPaper): React.JSX.Element => admissionMetadata(item.metadata)
  const openOriginal = async (url: string): Promise<void> => {
    try {
      navigateWeb(url)
    } catch {
      toast({ title: t('discovery.curated.openFailed'), tone: 'error' })
    }
  }

  const scheduleEntry = (): React.JSX.Element => (
    <Button
      variant="secondary"
      size="sm"
      icon={<AlarmClock />}
      disabled={!createSchedule}
      onClick={() =>
        createSchedule?.({
          name: t('discovery.prototype.scheduleName'),
          prompt: t('discovery.prototype.schedulePrompt'),
        })
      }
    >
      {t('discovery.prototype.configure')}
    </Button>
  )
  const paperActions = (item: CuratedPaper): React.JSX.Element => (
    <div className="flex items-center gap-[var(--vds-space-1)]">
      <Tooltip content={t('discovery.prototype.similar')} portalled side="top">
        <IconButton
          variant={votes[item.id] === 'like' ? 'secondary' : 'ghost'}
          size="sm"
          label={t('discovery.prototype.similar')}
          aria-pressed={votes[item.id] === 'like'}
          title={undefined}
          icon={<ThumbsUp />}
          onClick={() => {
            setVotes((current) => ({
              ...current,
              [item.id]: current[item.id] === 'like' ? undefined : 'like',
            }))
          }}
        />
      </Tooltip>
      <Tooltip content={t('discovery.prototype.copyLink')} portalled side="top">
        <IconButton
          variant="ghost"
          size="sm"
          label={t('discovery.prototype.copyLink')}
          title={undefined}
          icon={<Link2 />}
          onClick={() => {
            if (item.metadata.url)
              void writeClipboard(item.metadata.url)
                .then(() => toast({ title: t('discovery.prototype.copied') }))
                .catch(() => toast({ title: t('discovery.curated.openFailed'), tone: 'error' }))
          }}
        />
      </Tooltip>
      <Tooltip content={t('discovery.prototype.hide')} portalled side="top">
        <IconButton
          variant="ghost"
          size="sm"
          label={t('discovery.prototype.hide')}
          title={undefined}
          icon={<ThumbsDown />}
          onClick={() => {
            setVotes((current) => ({
              ...current,
              [item.id]: 'dislike',
            }))
            setHidden((current) => (current.includes(item.id) ? current : [...current, item.id]))
            toast({ title: t('discovery.prototype.hidden') })
          }}
        />
      </Tooltip>
    </div>
  )

  return (
    <Page
      padding="none"
      className="h-full @container !gap-0"
      data-testid="literature-discovery-page"
    >
      {paper ? (
        <Reader
          key={paper.id}
          paper={paper}
          admission={admission}
          admissionReference={admissionMetadata}
          scroll={discovery.scroll}
          onScroll={(scroll) => catalogue.discovery({ scroll })}
          onBack={() => setPaper(null)}
          onOriginal={(url) => void openOriginal(url)}
          onDiscuss={() =>
            act.startPanelDraft({
              composerText: t('discovery.discussPrompt', {
                question: paper.reading[language].question,
                title: paper.metadata.title,
                authors: paper.metadata.authors.join(', '),
                url: paper.metadata.doi
                  ? `https://doi.org/${paper.metadata.doi}`
                  : paper.metadata.url || paper.pdf,
              }),
            })
          }
        />
      ) : (
        <PageBody ref={listRef} scroll="content" className="!block">
          <div className="mx-auto flex w-full max-w-[var(--vds-discovery-width)] flex-col gap-[var(--vds-space-5)] px-[var(--vds-discovery-grid-gap)] pt-[var(--vds-discovery-section-y)] pb-[var(--vds-discovery-page-bottom)] @[900px]:px-[var(--vds-discovery-page-x)] @[900px]:pt-[var(--vds-discovery-page-y)]">
            <header className="flex flex-wrap items-center justify-between gap-[var(--vds-space-3)]">
              <div className="grid gap-[var(--vds-space-2)]">
                <h1 className="m-0 text-[length:var(--vds-discovery-title)] font-[var(--vds-fw-semibold)]">
                  {t('discovery.title')}
                </h1>
                <p className={`m-0 text-[length:var(--vds-discovery-body)] ${SECONDARY}`}>
                  {t('discovery.prototype.subtitle')}
                </p>
              </div>
              {scheduleEntry()}
            </header>
            <section
              className="flex items-center gap-[var(--vds-space-2)] rounded-full border border-[var(--vds-divider-default)] bg-[var(--vds-bg-white-default)] p-[var(--vds-space-1)] pl-[var(--vds-space-4)] shadow-[var(--vds-shadow-1-down)] focus-within:shadow-[var(--vds-focus-brand)]"
              aria-label={t('discovery.searchLabel')}
            >
              <div className="min-w-0 flex-1">
                <Input
                  unstyled
                  className="w-full min-w-0 border-0 bg-transparent py-[var(--vds-space-2)] text-[length:var(--vds-font-body-lv2)] text-[var(--vds-text-primary)] outline-none placeholder:text-[var(--vds-text-tertiary)]"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label={t('discovery.searchLabel')}
                  placeholder={t('discovery.searchPlaceholder')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      void search()
                    }
                  }}
                />
              </div>
              <IconButton
                label={t('discovery.searchLabel')}
                icon={<Search aria-hidden />}
                className="!rounded-full"
                disabled={!query.trim() || searching}
                loading={searching}
                onClick={() => void search()}
              />
            </section>
            <div className="flex flex-wrap items-center gap-[var(--vds-space-3)] border-b border-[var(--vds-divider-default)] pb-[var(--vds-space-3)]">
              <Tabs value={mode} onValueChange={setMode}>
                <TabsList aria-label={t('discovery.feed.label')}>
                  <TabsTrigger value="personal">{t('discovery.feed.personal')}</TabsTrigger>
                  <TabsTrigger value="hot">{t('discovery.feed.hot')}</TabsTrigger>
                </TabsList>
              </Tabs>
              {mode === 'personal' && (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!personalBatch.canRefresh}
                  onClick={() => {
                    setBatch((current) => current + 1)
                    toast({ title: t('discovery.feed.refreshed') })
                  }}
                >
                  <RefreshCw className={ICON} />
                  {t('discovery.feed.refresh')}
                </Button>
              )}
              {mode === 'hot' && (
                <div className="flex items-center gap-[var(--vds-space-3)]">
                  <Tabs
                    value={period}
                    onValueChange={(value) => setPeriod(value as DiscoveryPeriod)}
                  >
                    <TabsList
                      aria-label={t('discovery.prototype.period')}
                      className="!rounded-[var(--vds-radius-pill)]"
                    >
                      {HOT_DISCOVERY_PERIODS.map((value) => (
                        <TabsTrigger
                          key={value}
                          value={value}
                          className="!rounded-[var(--vds-radius-pill)] !text-[length:var(--vds-discovery-small)]"
                        >
                          {t(PERIOD_LABELS[value])}
                          <span className="ml-[var(--vds-space-1)] text-[var(--vds-text-tertiary)]">
                            {
                              filterPapers(
                                CURATED_PAPERS.filter((item) => !hidden.includes(item.id)),
                                {
                                  topic,
                                  period: value,
                                  now: new Date(DISCOVERY_EDITION + 'T12:00:00'),
                                }
                              ).length
                            }
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                </div>
              )}
              <span className={`ml-auto ${META}`}>
                {t('discovery.prototype.edition', { date: DISCOVERY_EDITION })}
              </span>
            </div>
            {mode === 'personal' && (
              <section
                className="flex flex-col gap-[var(--vds-space-2)]"
                aria-label={t('discovery.feed.interests')}
              >
                <p className={`m-0 ${META}`}>{t('discovery.feed.coldStart')}</p>
                {customInterests.length > 0 && (
                  <div
                    className="flex flex-wrap gap-[var(--vds-space-2)]"
                    role="group"
                    aria-label={t('discovery.feed.interests')}
                  >
                    {customInterests.map((interest) => (
                      <Tag
                        key={interest.id}
                        selected
                        className="max-w-full"
                        closeLabel={t('discovery.feed.removeInterest', {
                          topic: interest.label[language],
                        })}
                        onClose={() => {
                          setCustomInterests((current) =>
                            current.filter((item) => item.id !== interest.id)
                          )
                          interestInput.current?.focus()
                        }}
                      >
                        {interest.label[language]}
                      </Tag>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-[var(--vds-space-2)]">
                  <div className="min-w-0 flex-1">
                    <Input
                      ref={interestInput}
                      aria-label={t('discovery.feed.customInterest')}
                      placeholder={t('discovery.feed.customPlaceholder')}
                      value={interestDraft}
                      maxLength={INTEREST_TEXT_LIMIT}
                      onChange={(event) => setInterestDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                          event.preventDefault()
                          addInterest()
                        }
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!interestDraft.trim()}
                    onClick={addInterest}
                  >
                    {t('discovery.feed.addInterest')}
                  </Button>
                </div>
              </section>
            )}
            {mode === 'hot' && (
              <div
                className="flex flex-wrap items-center gap-[var(--vds-space-1)]"
                role="group"
                aria-label={t('discovery.prototype.topics')}
              >
                <Toggle
                  size="sm"
                  variant={topic === 'all' ? 'primary' : 'ghost'}
                  pressed={topic === 'all'}
                  className="!h-[var(--vds-discovery-chip-height)] !rounded-[var(--vds-radius-pill)]"
                  onPressedChange={() => {
                    setTopic('all')
                  }}
                >
                  {t('discovery.prototype.allTopics')}
                  <span>
                    {
                      filterPapers(
                        CURATED_PAPERS.filter((item) => !hidden.includes(item.id)),
                        { topic: 'all', period, now: new Date(DISCOVERY_EDITION + 'T12:00:00') }
                      ).length
                    }
                  </span>
                </Toggle>
                {CURATED_TOPICS.map((value) => (
                  <Toggle
                    key={value}
                    size="sm"
                    variant={topic === value ? 'primary' : 'ghost'}
                    pressed={topic === value}
                    className="!h-[var(--vds-discovery-chip-height)] !rounded-[var(--vds-radius-pill)]"
                    onPressedChange={() => {
                      setTopic(value)
                    }}
                  >
                    {t(TOPIC_LABELS[value])}
                    <span className={topic === value ? 'text-inherit' : META}>
                      {
                        filterPapers(
                          CURATED_PAPERS.filter((item) => !hidden.includes(item.id)),
                          { topic: value, period, now: new Date(DISCOVERY_EDITION + 'T12:00:00') }
                        ).length
                      }
                    </span>
                  </Toggle>
                ))}
              </div>
            )}
            {!visible.length && (
              <Card className="!rounded-[var(--vds-radius-6)] !shadow-none">
                <EmptyState
                  title={
                    mode === 'personal'
                      ? t('discovery.feed.empty')
                      : t('discovery.curated.emptySelection', {
                          topic:
                            topic === 'all'
                              ? t('discovery.prototype.allTopics')
                              : t(TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS]),
                          period: t(PERIOD_LABELS[period]),
                        })
                  }
                  description={
                    mode === 'personal'
                      ? t('discovery.feed.emptyHint')
                      : t('discovery.curated.emptyHint')
                  }
                  action={
                    <div className="flex flex-wrap justify-center gap-[var(--vds-space-3)]">
                      {mode === 'personal' && (
                        <Button variant="secondary" onClick={() => setMode('hot')}>
                          {t('discovery.feed.hot')}
                        </Button>
                      )}
                      {mode === 'hot' && period !== 'month' && (
                        <Button variant="secondary" onClick={() => setPeriod('month')}>
                          {t('discovery.curated.viewMonth')}
                        </Button>
                      )}
                      {mode === 'hot' && topic !== 'all' && (
                        <Button variant="secondary" onClick={() => setTopic('all')}>
                          {t('discovery.curated.viewAllTopics')}
                        </Button>
                      )}
                    </div>
                  }
                />
              </Card>
            )}
            <div className="flex flex-col gap-[var(--vds-discovery-grid-gap)]">
              {visible.map((item) => {
                const copy = item.reading[language]
                return (
                  <Card
                    key={item.id}
                    data-testid={`discovery-paper-${item.id}`}
                    className="group relative flex min-w-0 flex-row overflow-hidden !rounded-[var(--vds-radius-6)] !p-0 !shadow-none transition-colors hover:!border-[var(--vds-brand-light-border)]"
                  >
                    <Button
                      unstyled
                      aria-label={t('discovery.curated.openReading', { name: item.label })}
                      ref={(node) => {
                        if (lastCardId.current === item.id) lastCard.current = node
                      }}
                      className="absolute inset-0 rounded-[var(--vds-radius-6)] focus-visible:shadow-[var(--vds-discovery-focus-shadow)]"
                      onClick={(event) => openPaper(item, event.currentTarget)}
                    />
                    <PaperThumbnail paper={item.metadata} />
                    <div className="pointer-events-none flex min-w-0 flex-1 flex-col gap-[var(--vds-space-2)] p-[var(--vds-space-5)]">
                      {mode === 'personal' && (
                        <p className={`m-0 ${META} !text-[var(--vds-brand-text-primary)]`}>
                          {
                            feed.recommendations.find((entry) => entry.paperId === item.id)?.reason[
                              language
                            ]
                          }
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
                        <Badge>{t(TOPIC_LABELS[item.topic])}</Badge>
                        <span className={META}>
                          {item.metadata.venue} ·{' '}
                          {item.published === DISCOVERY_EDITION
                            ? t('discovery.prototype.periods.today')
                            : item.published.slice(5).replace('-', '/')}
                          {item.published === DISCOVERY_EDITION && (
                            <Badge tone="warning">{t('discovery.prototype.new')}</Badge>
                          )}
                        </span>
                      </div>
                      <h2 className="m-0 text-[length:var(--vds-discovery-card-title)] leading-[var(--vds-discovery-card-line)] font-[var(--vds-fw-semibold)]">
                        {copy.headline}
                      </h2>
                      <p
                        className={`m-0 line-clamp-2 text-[length:var(--vds-discovery-small)] leading-[var(--vds-discovery-card-line)] ${SECONDARY}`}
                      >
                        {item.metadata.title}
                      </p>
                      {item.metadata.authors.length > 0 && (
                        <p className={`m-0 line-clamp-1 ${META}`}>
                          {item.metadata.authors.join(', ')}
                        </p>
                      )}
                      <p
                        className={`m-0 line-clamp-2 text-[length:var(--vds-discovery-small)] leading-[var(--vds-discovery-small-line)] ${SECONDARY}`}
                      >
                        {copy.summary}
                      </p>
                      <div className="pointer-events-auto relative mt-auto flex flex-wrap items-center justify-between gap-[var(--vds-space-2)] pt-[var(--vds-space-2)]">
                        <div className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
                          {admissionMetadata(item.metadata, true)}
                          {paperActions(item)}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>
        </PageBody>
      )}
    </Page>
  )
}
