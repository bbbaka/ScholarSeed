import React, { useCallback, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronRight, Copy, Play } from 'lucide-react'
import {
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  CopyButton,
} from '../src/renderer/src/components/ui'
import type { PreviewPage, PreviewScenario } from './catalog.ts'
import type { PdfeIterationManifest } from '../src/iterations.ts'
import { formatPdfeSceneReference, type PdfeTarget } from '../src/pdfe.ts'
import { pdfeFeature } from './iterations.ts'
import { PDFE_PAGE_GROUPS, PDFE_MIN_GROUP_SCENARIOS, pdfeNavigationGroup } from './hierarchy.ts'
import { pdfeTitle, pdfeFeatureLabels, pdfeNavigationScenarios, type PdfeTranslate } from './collaboration.ts'

const CONTENT_CLASS = '!rounded-none !border-0 !bg-transparent !p-0'
const ICON_CLASS = 'size-[var(--vds-icon-8)] shrink-0'
const CHILDREN_CLASS =
  'ml-[var(--vds-space-3)] grid min-w-0 grid-cols-1 gap-[var(--vds-space-2)] border-l border-[var(--vds-border-default)] pl-[var(--vds-space-3)]'

function toggleExpanded(
  current: ReadonlySet<string>,
  identity: string,
  open: boolean
): Set<string> {
  const next = new Set(current)
  if (open) next.add(identity)
  else next.delete(identity)
  return next
}

interface SceneProps {
  manifest: PdfeIterationManifest | null
  page: PreviewPage
  scenarios: readonly PreviewScenario[]
  activePage: string
  scene: string
  pending: boolean
  translate: PdfeTranslate
  stateLabel: (state: string) => string
  onLaunch: (page: PreviewPage, scene: string) => void
  onCopy?: (target: PdfeTarget) => Promise<void>
  activeButtonRef: React.RefCallback<HTMLButtonElement>
}

function ScenarioButtons({
  manifest,
  page,
  scenarios,
  activePage,
  scene,
  pending,
  translate,
  stateLabel,
  onLaunch,
  onCopy,
  activeButtonRef,
}: SceneProps): React.JSX.Element {
  return (
    <>
      {scenarios.map((scenario) => {
        const feature = pdfeFeature(manifest, page, scenario)
        const current = page.id === activePage && scenario.id === scene
        const hintId = 'preview-hint-' + page.id + '-' + scenario.id
        const titleId = hintId + '-title'
        const title = pdfeTitle(scenario, translate)
        const reference = { pageId: page.id, sceneId: scenario.id }
        return (
          <div key={scenario.id} className="grid min-w-0">
            <Button
              ref={current ? activeButtonRef : undefined}
              aria-label={title}
              aria-describedby={hintId}
              data-testid={'preview-scene-' + page.id + '-' + scenario.id}
              aria-current={current ? 'page' : undefined}
              variant={current ? 'secondary' : 'ghost'}
              size="content"
              disabled={pending || !(page.target || page.host)}
              className="col-start-1 row-start-1 w-full items-start self-stretch !whitespace-normal py-[var(--vds-space-2)] pr-[var(--vds-space-10)] text-left"
              title={translate(current ? 'replayScene' : 'openScene')}
              onClick={() => onLaunch(page, scenario.id)}
            >
              <span className="grid min-w-0 flex-1 grid-cols-1 gap-[var(--vds-space-1)]">
                <span className="flex flex-wrap items-center gap-[var(--vds-space-2)]">
                  <span id={titleId}>{title}</span>
                  {pdfeFeatureLabels(feature, translate).map(label => (
                    <Badge
                      key={label.id}
                      size="sm"
                      variant="outline"
                      data-testid={'preview-version-' + page.id + '-' + scenario.id + (label.id === 'added' ? '' : '-' + label.id)}
                      title={label.summary}
                    >
                      {label.text}
                    </Badge>
                  ))}
                  {current && (
                    <Badge size="sm" variant="outline">
                      {translate('current')}
                    </Badge>
                  )}
                </span>
                <span
                  id={hintId}
                  data-testid={hintId}
                  className="text-[length:var(--vds-font-body-lv3)] leading-[var(--vds-lh-body-lv3)] text-[var(--vds-text-secondary)]"
                >
                  {translate('canTry')}:{' '}
                  {(
                    scenario.capabilityKeys?.map((key) => translate(key)) ?? [
                      ...new Set(scenario.states.map(stateLabel)),
                    ]
                  ).join(' · ')}
                </span>
              </span>
            </Button>
            <div className="pointer-events-none z-[var(--vds-z-local-control)] col-start-1 row-start-1 my-[var(--vds-space-1)] mr-[var(--vds-space-1)] grid justify-self-end self-start">
              <span
                aria-hidden="true"
                data-testid={'preview-play-scene-' + page.id + '-' + scenario.id}
                className="grid size-[var(--vds-control-height-sm)] place-items-center"
              >
                <Play className={ICON_CLASS} />
              </span>
              {onCopy && (page.target || page.host) && (
                <div className="pointer-events-auto">
                  <CopyButton
                    iconOnly
                    icon={<Copy />}
                    copiedIcon={<Check />}
                    variant="ghost"
                    tooltip
                    idleLabel={translate('sceneCopy')}
                    copiedLabel={translate('sceneCopied')}
                    errorLabel={translate('sceneCopyFailed')}
                    aria-describedby={titleId}
                    data-testid={'preview-copy-scene-' + page.id + '-' + scenario.id}
                    disabled={pending}
                    value={formatPdfeSceneReference(reference)}
                    writeText={() => onCopy(reference)}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

type ExpansionProps = {
  isOpen: (section: string) => boolean
  onToggle: (section: string, open: boolean) => void
}

function ScenarioGroups(props: SceneProps & ExpansionProps): React.JSX.Element {
  return (
    <>
      {[...new Set(props.scenarios.map((scenario) => scenario.group ?? scenario.id))].map(
        (identity) => {
          const entries = props.scenarios.filter(
            (scenario) => (scenario.group ?? scenario.id) === identity
          )
          const group = entries[0].group
          if (
            !group ||
            new Set(entries.map((entry) => entry.aliasOf ?? entry.id)).size <
              PDFE_MIN_GROUP_SCENARIOS
          )
            return <ScenarioButtons key={identity} {...props} scenarios={entries} />
          const open = props.isOpen(group)
          return (
            <Collapsible
              key={group}
              className="grid-cols-1 gap-0"
              open={open}
              onOpenChange={(value) => props.onToggle(group, value)}
            >
              <h4>
                <CollapsibleTrigger asChild>
                  <Button
                    aria-label={props.translate(group)}
                    data-testid={'preview-family-' + props.page.id + '-' + group}
                    variant="ghost"
                    size="content"
                    className="w-full justify-start !whitespace-normal"
                  >
                    {open ? (
                      <ChevronDown aria-hidden="true" className={ICON_CLASS} />
                    ) : (
                      <ChevronRight aria-hidden="true" className={ICON_CLASS} />
                    )}
                    <span className="flex-1 text-left">{props.translate(group)}</span>
                    <Badge aria-hidden="true" variant="outline" size="sm">
                      {entries.length}
                    </Badge>
                  </Button>
                </CollapsibleTrigger>
              </h4>
              <CollapsibleContent className={CONTENT_CLASS}>
                <div className={CHILDREN_CLASS}>
                  <ScenarioButtons {...props} scenarios={entries} />
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        }
      )}
    </>
  )
}

function ScenarioSections(
  props: SceneProps & ExpansionProps & { nested: readonly PreviewPage[] }
): React.JSX.Element {
  const { page, scenarios, translate, isOpen, onToggle } = props
  return (
    <>
      {[
        ...new Set([
          ...scenarios.map((scenario) => scenario.section),
          ...props.nested.flatMap((child) =>
            typeof child.navigation === 'object' ? [child.navigation.section] : []
          ),
        ]),
      ].map((section) => {
        const entries = scenarios.filter((scenario) => scenario.section === section)
        const nested = props.nested.filter(
          (child) => typeof child.navigation === 'object' && child.navigation.section === section
        )
        if (!section) return <ScenarioButtons key="default" {...props} scenarios={entries} />
        const open = isOpen(section)
        return (
          <Collapsible
            key={section}
            className="grid-cols-1 gap-0"
            open={open}
            onOpenChange={(value) => onToggle(section, value)}
          >
            <h3>
              <CollapsibleTrigger asChild>
                <Button
                  aria-label={translate(section)}
                  data-testid={'preview-section-' + page.id + '-' + section}
                  variant="ghost"
                  size="content"
                  className="w-full justify-start !whitespace-normal font-[var(--vds-fw-medium)]"
                >
                  {open ? (
                    <ChevronDown aria-hidden="true" className={ICON_CLASS} />
                  ) : (
                    <ChevronRight aria-hidden="true" className={ICON_CLASS} />
                  )}
                  <span className="flex-1 text-left">{translate(section)}</span>
                  <Badge aria-hidden="true" variant="outline" size="sm">
                    {entries.length +
                      nested.reduce((count, child) => count + child.scenarios.length, 0)}
                  </Badge>
                </Button>
              </CollapsibleTrigger>
            </h3>
            <CollapsibleContent className={CONTENT_CLASS}>
              <div className={CHILDREN_CLASS}>
                <ScenarioGroups {...props} scenarios={entries} />
                {nested.map((child) => (
                  <ScenarioButtons
                    key={child.id}
                    {...props}
                    page={child}
                    scenarios={child.scenarios}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </>
  )
}

export function PdfeNavigation({
  manifest,
  pages,
  selected,
  activePage,
  scene,
  autoExpandKey,
  revealActive = true,
  query = '',
  pending,
  translate,
  stateLabel,
  onSelect,
  onLaunch,
  onCopy,
}: {
  manifest: PdfeIterationManifest | null
  pages: readonly PreviewPage[]
  selected: PreviewPage
  activePage: string
  scene: string
  autoExpandKey: string | null
  revealActive?: boolean
  query?: string
  pending: boolean
  translate: PdfeTranslate
  stateLabel: (state: string) => string
  onSelect: (page: PreviewPage) => void
  onLaunch: (page: PreviewPage, scene: string) => void
  onCopy?: (target: PdfeTarget) => Promise<void>
}): React.JSX.Element {
  const revealedTarget = useRef<string | null>(null)
  const activeButtonRef = useCallback((button: HTMLButtonElement | null) => {
    const target = JSON.stringify([activePage, scene])
    if (!revealActive || !button || revealedTarget.current === target) return
    let cancelled = false
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const animations: Animation[] = []
      for (let ancestor = button.parentElement; ancestor; ancestor = ancestor.parentElement) {
        animations.push(...ancestor.getAnimations().filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().endTime !== Infinity))
        if (ancestor.tagName === 'NAV') break
      }
      void Promise.allSettled(animations.map(animation => animation.finished)).then(() => {
        if (cancelled || !button.isConnected || button.closest('[hidden], [inert]') || revealedTarget.current === target) return
        button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
        revealedTarget.current = target
      })
    }))
    return () => { cancelled = true }
  }, [activePage, scene, revealActive])
  const [expandedGroups, setExpandedGroups] = useState<ReadonlySet<string>>(
    () => new Set([pdfeNavigationGroup(selected).id])
  )
  const [expandedPages, setExpandedPages] = useState(() => new Set([selected.id]))
  const [expandedCollections, setExpandedCollections] = useState<ReadonlySet<string>>(
    () => new Set(selected.navigationCollection ? [selected.navigationCollection.id] : [])
  )
  const [expandedSections, setExpandedSections] = useState<Record<string, ReadonlySet<string>>>({})
  const [filtered, setFiltered] = useState(() => ({
    key: autoExpandKey,
    collapsed: new Set<string>(),
  }))
  if (filtered.key !== autoExpandKey) setFiltered({ key: autoExpandKey, collapsed: new Set() })
  const isOpen = (identity: string, normallyOpen: boolean): boolean =>
    autoExpandKey === null ? normallyOpen : !filtered.collapsed.has(identity)
  const changeOpen = (identity: string, open: boolean, changeUnfiltered: () => void): void => {
    if (autoExpandKey === null) changeUnfiltered()
    else setFiltered((current) => ({
      key: autoExpandKey,
      collapsed: toggleExpanded(current.collapsed, identity, !open),
    }))
  }
  return (
    <nav
      aria-label={translate('navigation')}
      aria-busy={pending}
      className="grid min-w-0 grid-cols-1 content-start gap-[var(--vds-space-2)]"
    >
      {PDFE_PAGE_GROUPS.map((group) => {
        const entries = pages.filter(
          (page) => !page.navigation && pdfeNavigationGroup(page).id === group.id
        )
        if (!entries.length) return null
        const collections = [
          ...new Set(
            entries.flatMap((page) =>
              page.navigationCollection ? [page.navigationCollection.id] : []
            )
          ),
        ]
        const childCount =
          entries.filter((page) => !page.navigationCollection).length + collections.length
        const groupKey = 'group:' + group.id
        const groupOpen = isOpen(groupKey, expandedGroups.has(group.id))
        return (
          <Collapsible
            key={group.id}
            className="grid-cols-1 gap-0"
            open={groupOpen}
            onOpenChange={(open) => changeOpen(groupKey, open, () =>
              setExpandedGroups((current) => toggleExpanded(current, group.id, open))
            )}
          >
            <CollapsibleTrigger asChild>
              <Button
                data-testid={'preview-group-' + group.id}
                variant="ghost"
                size="content"
                className="w-full justify-start !whitespace-normal"
              >
                {groupOpen ? (
                  <ChevronDown aria-hidden="true" className={ICON_CLASS} />
                ) : (
                  <ChevronRight aria-hidden="true" className={ICON_CLASS} />
                )}
                <span className="flex-1 text-left">{translate(group.title)}</span>
                <Badge aria-hidden="true" variant="outline" size="sm">
                  {childCount}
                </Badge>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className={CONTENT_CLASS}>
              <div className={CHILDREN_CLASS}>
                {entries
                  .filter((page) => !page.navigationCollection)
                  .map((page) => {
                    const pageKey = 'page:' + page.id
                    const pageOpen = isOpen(pageKey, expandedPages.has(page.id))
                    const available = Boolean(page.target || page.host)
                    const scenarios = pdfeNavigationScenarios(
                      page,
                      activePage,
                      scene,
                      query,
                      translate
                    )
                    const nested = pages.filter(
                      (child) =>
                        typeof child.navigation === 'object' &&
                        child.navigation.parentPage === page.id
                    )
                    const sectioned = page.scenarios.some((candidate) => candidate.section) || nested.some(child => typeof child.navigation === 'object' && child.navigation.section)
                    const context = {
                      manifest,
                      page,
                      scenarios,
                      activePage,
                      activeButtonRef,
                      scene,
                      pending,
                      translate,
                      stateLabel,
                      onLaunch,
                      onCopy,
                    }
                    const activeScenario =
                      page.id === activePage
                        ? page.scenarios.find((candidate) => candidate.id === scene)
                        : undefined
                    const activeChild = nested.find((child) => child.id === activePage)
                    const activeSection =
                      activeScenario?.section ??
                      (typeof activeChild?.navigation === 'object'
                        ? activeChild.navigation.section
                        : undefined) ??
                      page.scenarios.find((candidate) => candidate.section)?.section
                    const sections =
                      expandedSections[page.id] ??
                      new Set(
                        [activeSection, activeScenario?.group].filter(
                          (value): value is NonNullable<typeof value> => Boolean(value)
                        )
                      )
                    const content = (
                      <section
                        key={page.id}
                        data-testid={'preview-capabilities-' + page.id}
                        className="mb-[var(--vds-space-3)] grid min-w-0 grid-cols-1 gap-[var(--vds-space-2)]"
                      >
                        {!available && (
                          <p className="text-[length:var(--vds-font-body-lv3)] text-[var(--vds-text-secondary)]">
                            {translate('mockUnavailable')}
                          </p>
                        )}
                        {sectioned ? (
                          <ScenarioSections
                            {...context}
                            nested={nested}
                            isOpen={(section) => isOpen(pageKey + ':' + section, sections.has(section))}
                            onToggle={(section, open) => {
                              changeOpen(pageKey + ':' + section, open, () =>
                                setExpandedSections((current) => ({
                                  ...current,
                                  [page.id]: toggleExpanded(
                                    current[page.id] ?? sections,
                                    section,
                                    open
                                  ),
                                }))
                              )
                              if (open) onSelect(page)
                            }}
                          />
                        ) : (
                          <ScenarioButtons {...context} />
                        )}
                      </section>
                    )
                    if (sectioned) return content
                    return (
                      <Collapsible
                        key={page.id}
                        className="grid-cols-1 gap-0"
                        open={pageOpen}
                        onOpenChange={(open) => {
                          changeOpen(pageKey, open, () =>
                            setExpandedPages((current) => toggleExpanded(current, page.id, open))
                          )
                          if (open) onSelect(page)
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <Button
                            data-testid={'preview-page-' + page.id}
                            variant="ghost"
                            size="content"
                            className="w-full justify-start !whitespace-normal text-left"
                          >
                            {pageOpen ? (
                              <ChevronDown aria-hidden="true" className={ICON_CLASS} />
                            ) : (
                              <ChevronRight aria-hidden="true" className={ICON_CLASS} />
                            )}
                            <span className="flex-1">
                              {page.category === 'page' && page.entry !== 'projects'
                                ? translate('pageOverview')
                                : pdfeTitle(page, translate)}
                            </span>
                            <span aria-hidden="true" className="text-[var(--vds-text-tertiary)]">
                              {page.scenarios.length}
                            </span>
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className={CONTENT_CLASS}>
                          <div className={CHILDREN_CLASS}>{content}</div>
                        </CollapsibleContent>
                      </Collapsible>
                    )
                  })}
                {collections.map((identity) => {
                  const members = entries.filter(
                    (page) => page.navigationCollection?.id === identity
                  )
                  const collection = members[0].navigationCollection!
                  const collectionKey = 'collection:' + group.id + ':' + identity
                  const open = isOpen(collectionKey, expandedCollections.has(identity))
                  return (
                    <Collapsible
                      key={identity}
                      className="grid-cols-1 gap-0"
                      open={open}
                      onOpenChange={(value) => changeOpen(collectionKey, value, () =>
                        setExpandedCollections((current) => toggleExpanded(current, identity, value))
                      )}
                    >
                      <h3>
                        <CollapsibleTrigger asChild>
                          <Button
                            data-testid={'preview-collection-' + group.id + '-' + identity}
                            variant="ghost"
                            size="content"
                            className="w-full justify-start !whitespace-normal text-left"
                          >
                            {open ? (
                              <ChevronDown aria-hidden="true" className={ICON_CLASS} />
                            ) : (
                              <ChevronRight aria-hidden="true" className={ICON_CLASS} />
                            )}
                            <span className="flex-1">{translate(collection.titleKey)}</span>
                            <Badge aria-hidden="true" variant="outline" size="sm">
                              {members.reduce(
                                (count, member) => count + member.scenarios.length,
                                0
                              )}
                            </Badge>
                          </Button>
                        </CollapsibleTrigger>
                      </h3>
                      <CollapsibleContent className={CONTENT_CLASS}>
                        <div className={CHILDREN_CLASS}>
                          {members.map((page) => (
                            <ScenarioButtons
                              manifest={manifest}
                              key={page.id}
                              page={page}
                              scenarios={pdfeNavigationScenarios(
                                page,
                                activePage,
                                scene,
                                query,
                                translate
                              )}
                              activePage={activePage}
                              activeButtonRef={activeButtonRef}
                              scene={scene}
                              pending={pending}
                              translate={translate}
                              stateLabel={stateLabel}
                              onLaunch={onLaunch}
                              onCopy={onCopy}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </nav>
  )
}
