import type { PreviewPage, PreviewScenario } from './catalog.ts'
import { formatPdfeSceneReference } from '../src/pdfe.ts'
import { PREVIEW_CATALOG } from './catalog.ts'
import type { PdfeIterationManifest } from '../src/iterations.ts'
import { PDFE_ITERATION_DEFAULT, pdfeFeature, pdfeFeatureMatches, type PdfeFeature, type PdfeIterationFilter } from './iterations.ts'
import { pdfeNavigationGroup } from './hierarchy.ts'
import zh from './locales/zh.json' with { type: 'json' }

export type PdfeTranslate = (key: keyof typeof zh, values?: Record<string, string | number>) => string

export function pdfeFeatureLabels(feature: PdfeFeature | undefined, translate: PdfeTranslate) {
  if (!feature) return []
  return [
    {
      id: 'added',
      text: feature.introducedIn === null
        ? translate('iterationVersionPending')
        : translate('iterationAddedIn', { version: feature.introducedIn }),
      summary: feature.id,
    },
    ...feature.changes.map(change => ({
      id: 'updated-' + change.version,
      text: translate('iterationChangedIn', { version: change.version }),
      summary: change.summary,
    })),
  ]
}

export function pdfeTitle(
  value: { title: string; titleKey?: keyof typeof zh; home?: PreviewScenario['home'] },
  translate: PdfeTranslate
): string {
  return value.titleKey
    ? translate(
        value.titleKey,
        value.home ? { projects: value.home.projects, tasks: value.home.tasks } : undefined
      )
    : value.title
}

export function pdfeStateLabel(state: string, translate: PdfeTranslate): string {
  const key = 'state_' + state
  return key in zh ? translate(key as keyof typeof zh) : state
}

export function pdfeSceneClipboard(page: PreviewPage, scene: PreviewScenario, translate: PdfeTranslate): string {
  const title = pdfeTitle(scene, translate)
  const summary = scene.home
    ? translate('sceneCopyHomeData', { projects: scene.home.projects, tasks: scene.home.tasks })
    : undefined
  return [
    translate('sceneCopyHeading', { page: pdfeTitle(page, translate), scene: title }),
    ...(summary && !title.includes(summary) ? [translate('sceneCopyInitialData', { summary })] : []),
    formatPdfeSceneReference({ pageId: page.id, sceneId: scene.id }),
  ].join('\n')
}

export function pdfeGuidance(page: PreviewPage, scene: PreviewScenario, translate: PdfeTranslate) {
  return {
    entry: page.entryInstructionKeys?.map((key) => translate(key)) ?? page.entryInstructions ?? [],
    expected: scene.expectedKeys?.map((key) => translate(key)) ?? scene.expected,
    limitations: scene.limitationKeys?.map((key) => translate(key)) ?? scene.limitations,
  }
}

export function pdfeScenarioMatches(
  scene: PreviewScenario,
  query: string,
  translate?: PdfeTranslate
): boolean {
  const term = query.trim().toLocaleLowerCase()
  return (
    !term ||
    [
      scene.id,
      scene.title,
      ...scene.states,
      ...(translate
        ? [
            pdfeTitle(scene, translate),
            ...scene.states.map((state) => pdfeStateLabel(state, translate)),
            ...(scene.capabilityKeys ?? []).map((key) => translate(key)),
            ...(scene.group ? [translate(scene.group)] : []),
            ...(scene.section ? [translate(scene.section)] : []),
          ]
        : []),
    ].some((value) => value.toLocaleLowerCase().includes(term))
  )
}

export function pdfeNavigationScenarios(
  page: PreviewPage,
  activePage: string,
  scene: string,
  query: string,
  translate: PdfeTranslate
): readonly PreviewScenario[] {
  const identity = pdfePageIdentityMatches(page, query, translate)
  const matches = page.scenarios.filter(
    (candidate) => identity || pdfeScenarioMatches(candidate, query, translate)
  )
  const currentAlias =
    activePage === page.id
      ? matches.find((candidate) => candidate.id === scene && candidate.aliasOf)
      : undefined
  return matches.filter((candidate) =>
    candidate.aliasOf
      ? candidate === currentAlias ||
        (!identity && !matches.some((other) => other.id === candidate.aliasOf))
      : candidate.id !== currentAlias?.aliasOf
  )
}

export function pdfeIterationPages(manifest: PdfeIterationManifest | null, pages: readonly PreviewPage[], filter: PdfeIterationFilter): readonly PreviewPage[] {
  if (!manifest || (filter.version === PDFE_ITERATION_DEFAULT.version && filter.scope === PDFE_ITERATION_DEFAULT.scope)) return pages
  const filtered = pages.map(page => ({ ...page, scenarios: page.scenarios.filter(scene => pdfeFeatureMatches(pdfeFeature(manifest, page, scene), filter)) }))
  const matched = filtered.filter(page => page.scenarios.length > 0)
  return filtered.filter(page => matched.includes(page) || matched.some(child => typeof child.navigation === 'object' && child.navigation.parentPage === page.id))
}

export function pdfeNavigationPages(
  pages: readonly PreviewPage[],
  query: string,
  translate: PdfeTranslate
): readonly PreviewPage[] {
  const available = pages.filter(
    (page) => page.navigation !== 'hidden' && page.launch?.kind !== 'components'
  )
  const matches = available.filter((page) => pdfePageMatches(page, query, 'all', translate))
  return available.filter(
    (page) =>
      matches.includes(page) ||
      matches.some(
        (child) => typeof child.navigation === 'object' && child.navigation.parentPage === page.id
      )
  )
}

export function pdfePageIdentityMatches(
  page: PreviewPage,
  query: string,
  translate?: PdfeTranslate
): boolean {
  const term = query.trim().toLocaleLowerCase()
  return (
    !term ||
    [
      page.id,
      page.title,
      page.owner,
      page.category,
      ...(translate
        ? [
            pdfeTitle(page, translate),
            translate(pdfeNavigationGroup(page).title),
            ...(page.navigationCollection ? [translate(page.navigationCollection.titleKey)] : []),
          ]
        : []),
    ].some((value) => value.toLocaleLowerCase().includes(term))
  )
}

export const PDFE_ROLES = [
  {
    id: 'product',
    defaultScope: 'mock',
    verification: 'requirements-and-scenario-acceptance',
    title: 'roleProduct',
    focus: 'roleProductFocus',
    knowledge: [
      { title: 'knowledgeRequirements', path: 'docs/index.md' },
      { title: 'knowledgeScenarios', path: 'apps/desktop/preview/catalog.ts' },
    ],
  },
  {
    id: 'design',
    defaultScope: 'presentation',
    verification: 'visual-and-interaction-acceptance',
    title: 'roleDesign',
    focus: 'roleDesignFocus',
    knowledge: [
      { title: 'knowledgeDesign', path: 'apps/desktop/DESIGN.md' },
      { title: 'knowledgeDesignMap', path: 'apps/desktop/docs/architecture/design-map.md' },
      { title: 'knowledgeComponents', path: 'apps/desktop/docs/design/components.md' },
      { title: 'knowledgeInteraction', path: 'apps/desktop/docs/design/interaction.md' },
    ],
  },
  {
    id: 'frontend',
    defaultScope: 'presentation',
    verification: 'renderer-and-consumer-regression',
    title: 'roleFrontend',
    focus: 'roleFrontendFocus',
    knowledge: [
      { title: 'knowledgeRenderer', path: 'apps/desktop/docs/architecture/renderer.md' },
      { title: 'knowledgeOwnership', path: 'apps/desktop/docs/architecture/ownership.md' },
      { title: 'knowledgeContracts', path: 'apps/desktop/docs/work/preview-contracts.md' },
      { title: 'knowledgeValidation', path: 'apps/desktop/docs/quality/testing.md' },
    ],
  },
  {
    id: 'backend',
    defaultScope: 'backend',
    verification: 'serve-contract-and-consumer-integration',
    title: 'roleBackend',
    focus: 'roleBackendFocus',
    knowledge: [
      { title: 'knowledgeServeOwner', path: 'apps/serve/AGENTS.md' },
      { title: 'knowledgeServe', path: 'docs/architecture/serve.md' },
    ],
  },
] as const

export const PDFE_TASK_SCOPES = [
  { id: 'mock', title: 'scopeMock', description: 'scopeMockDescription' },
  { id: 'presentation', title: 'scopePresentation', description: 'scopePresentationDescription' },
  { id: 'backend', title: 'scopeBackend', description: 'scopeBackendDescription' },
] as const

export const PDFE_ROLE_KNOWLEDGE = 'apps/desktop/docs/work/pdfe.md'
const PDFE_TASK_SCHEMA = 'pdfe-task-context/v3'
const PDFE_TASK_INTENTS = ['review', 'prototype', 'product'] as const
const SOURCE_REVISION = /^[a-f0-9]{7,64}$/i
const PDFE_READ_ONLY_VERIFICATION = 'read-only-source-review'
const PDFE_SCOPE_REVIEW = [
  'shared-state',
  'api-contract',
  'host',
  'persistence',
  'security',
  'mock-engine',
  'global-components-and-tokens',
  'dependencies-build-release',
] as const
const PDFE_MOCK_CANDIDATES = [
  'apps/desktop/preview/catalog.ts',
  'apps/desktop/preview/fixtures/',
] as const

export type PdfeRole = (typeof PDFE_ROLES)[number]['id']
export type PdfeTaskScope = (typeof PDFE_TASK_SCOPES)[number]['id']

function taskRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function taskText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Missing or invalid PDFE task ' + field)
  return value.trim()
}

function pdfeTaskFile(value: unknown): string {
  const file = taskText(value, 'file')
  if (/[\\:\u0000-\u001f]/u.test(file) || file.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('Expected a repository-relative PDFE task file')
  }
  return file
}

function taskBaseline(value: unknown) {
  if (value === undefined) return null
  if (!taskRecord(value) || typeof value.revision !== 'string' || !SOURCE_REVISION.test(value.revision) || !Array.isArray(value.dirtyPaths)) {
    throw new Error('Invalid PDFE task source baseline')
  }
  return { revision: value.revision, dirtyPaths: value.dirtyPaths.map(pdfeTaskFile) }
}

function taskChanges(value: unknown, field: 'confirmed' | 'proposed') {
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid PDFE task ' + field + ' changes')
  return value.map(change => {
    if (!taskRecord(change)) throw new Error('Invalid PDFE task ' + field + ' change')
    return { file: pdfeTaskFile(change.file), behavior: taskText(change.behavior, 'behavior') }
  })
}

function taskCandidates(scope: PdfeTaskScope | undefined, page: PreviewPage | undefined): string[] {
  if (scope === 'mock') return [...PDFE_MOCK_CANDIDATES]
  if (scope === 'presentation' && page?.implementation === 'surface') return [`apps/desktop/${page.source}`]
  return []
}

export function pdfeFeatureTarget(serialized: string | null) {
  let value: unknown
  try {
    value = serialized === null ? null : JSON.parse(serialized)
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error
  }
  const target = value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  const page = PREVIEW_CATALOG.find(
    (page) =>
      page.id === target?.pageId &&
      page.launch?.kind !== 'components' &&
      Boolean(page.target || page.host)
  )
  const scene = page?.scenarios.find((scene) => scene.id === target?.sceneId)
  if (page && scene) return { pageId: page.id, sceneId: scene.id }
  const fallback = PREVIEW_CATALOG.find(
    (page) => page.launch?.kind !== 'components' && Boolean(page.target || page.host)
  )!
  return { pageId: fallback.id, sceneId: fallback.scenarios[0].id }
}

export function pdfeTaskContext(input: unknown) {
  if (!taskRecord(input)) throw new Error('Invalid PDFE task input')
  const intent = PDFE_TASK_INTENTS.find(candidate => candidate === input.intent)
  if (!intent) throw new Error('Unknown PDFE task intent')
  const profile = PDFE_ROLES.find(candidate => candidate.id === input.role)
  if (input.role !== undefined && !profile) throw new Error('Unknown PDFE task role')
  const requestedScope = input.scope === undefined ? profile?.defaultScope : input.scope
  const scope = PDFE_TASK_SCOPES.find(candidate => candidate.id === requestedScope)?.id
  if (input.scope !== undefined && !scope) throw new Error('Unknown PDFE task scope')
  const page = PREVIEW_CATALOG.find(candidate => candidate.id === input.pageId)
  const scene = page?.scenarios.find(candidate => candidate.id === input.sceneId)
  if ((input.pageId !== undefined && !page) || (input.sceneId !== undefined && !scene)) throw new Error('Unknown PDFE target')
  const sourceBaseline = taskBaseline(input.sourceBaseline)
  const confirmedChanges = taskChanges(input.confirmedChanges, 'confirmed')
  const proposals = taskChanges(input.proposedChanges, 'proposed')
  if (intent === 'review' && (confirmedChanges.length || proposals.length)) {
    throw new Error('Read-only PDFE tasks cannot include changes')
  }
  if (proposals.length && intent !== 'prototype') {
    throw new Error('PDFE proposed changes require a prototype task')
  }
  if (confirmedChanges.length) {
    if (intent === 'prototype') throw new Error('PDFE prototype tasks cannot confirm changes; use proposedChanges for scope review')
    if (!profile || !scope || !sourceBaseline) throw new Error('Confirmed changes require a PDFE role, scope and source baseline')
  }
  const candidateFiles = taskCandidates(scope, page)
  const proposedChanges = proposals.map(change => ({
    ...change,
    disposition: profile && scene && candidateFiles.some(candidate =>
      candidate.endsWith('/') ? change.file.startsWith(candidate) : change.file === candidate
    ) ? 'semantic-review-required' as const : 'owner-handoff-required' as const,
  }))
  return {
    schema: PDFE_TASK_SCHEMA,
    intent,
    role: profile?.id ?? null,
    scope: scope ?? null,
    task: taskText(input.task, 'goal'),
    pageId: page?.id ?? null,
    sceneId: scene?.id ?? null,
    candidateFiles,
    knowledge: [PDFE_ROLE_KNOWLEDGE, ...(profile?.knowledge.map(entry => entry.path) ?? [])],
    requirementSource: input.source === undefined ? page?.requirementSource ?? null : taskText(input.source, 'source'),
    expected: [...(scene?.expected ?? [])],
    limitations: [...(scene?.limitations ?? [])],
    proposedChanges,
    confirmedChanges,
    verification: intent === 'review' ? PDFE_READ_ONLY_VERIFICATION : profile?.verification ?? PDFE_READ_ONLY_VERIFICATION,
    stopConditions: ['owner-or-authorization-unclear', 'changes-exceed-confirmed-scope', 'required-evidence-unavailable'],
    requiresScopeReview: [...PDFE_SCOPE_REVIEW],
    authorization: 'not-granted-by-context',
    sourceBaseline,
    requiresSemanticReview: true,
  }
}

export function pdfePageMatches(
  page: PreviewPage,
  query: string,
  category: PreviewPage['category'] | 'all' = 'all',
  translate?: PdfeTranslate
): boolean {
  if (category !== 'all' && page.category !== category) return false
  return (
    pdfePageIdentityMatches(page, query, translate) ||
    page.scenarios.some((scene) => pdfeScenarioMatches(scene, query, translate))
  )
}
