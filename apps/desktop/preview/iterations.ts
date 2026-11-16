import type { PdfeIterationFeature, PdfeIterationManifest, PdfeIterationSnapshot } from '../src/iterations.ts'

export interface PdfeFeature extends PdfeIterationFeature {
  readonly id: string
}

export const PDFE_ITERATION_SCOPES = ['any', 'added', 'updated'] as const
export interface PdfeIterationFilter {
  readonly version: string
  readonly scope: (typeof PDFE_ITERATION_SCOPES)[number]
}
export const PDFE_ITERATION_DEFAULT: PdfeIterationFilter = { version: 'all', scope: 'any' }
export const PDFE_ITERATION_STORAGE = 'pdfe-iteration:'

interface VersionedScenario {
  readonly id: string
  readonly feature?: string
  readonly aliasOf?: string
}

interface VersionedPage {
  readonly id: string
  readonly scenarios: readonly VersionedScenario[]
}

export function pdfeFeature(manifest: PdfeIterationManifest | null, page: VersionedPage, scenario: VersionedScenario): PdfeFeature | undefined {
  if (!manifest) return undefined
  const canonical = scenario.aliasOf ? page.scenarios.find(candidate => candidate.id === scenario.aliasOf) : scenario
  if (!canonical) return undefined
  const id = canonical.feature ?? page.id + '/' + canonical.id
  const configured = Object.hasOwn(manifest.features, id) ? manifest.features[id] : undefined
  if (configured) return { id, ...configured }
  if (Object.hasOwn(manifest.baseline.scenes, page.id) && manifest.baseline.scenes[page.id].includes(canonical.id))
    return { id, introducedIn: manifest.baseline.version, changes: [] }
  return undefined
}

export function pdfeFeatureMatches(feature: PdfeFeature | undefined, filter: PdfeIterationFilter): boolean {
  if (filter.version === 'all' && filter.scope === 'any') return true
  if (!feature) return false
  if (filter.version === 'unconfirmed') return filter.scope === 'any' && feature.introducedIn === null
  const added = feature.introducedIn === filter.version
  const updated = feature.changes.some(change => change.version === filter.version)
  return filter.scope === 'added' ? added : filter.scope === 'updated' ? updated : added || updated
}

export function pdfeIterationReferences(manifest: PdfeIterationManifest, pages: readonly VersionedPage[]): Map<string, number> {
  const references = new Map(manifest.iterations.map(entry => [entry.version, new Set<string>()]))
  const count = (id: string, feature: PdfeIterationFeature): void => {
    if (feature.introducedIn !== null) references.get(feature.introducedIn)?.add(id)
    for (const change of feature.changes) references.get(change.version)?.add(id)
  }
  for (const [id, feature] of Object.entries(manifest.features)) count(id, feature)
  for (const page of pages) for (const scene of page.scenarios) {
    if (scene.aliasOf) continue
    const feature = pdfeFeature(manifest, page, scene)
    if (feature) count(feature.id, feature)
  }
  return new Map([...references].map(([version, entries]) => [version, entries.size]))
}

function normalizeFilter(value: unknown, manifest: PdfeIterationManifest): PdfeIterationFilter {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return PDFE_ITERATION_DEFAULT
  const filter = value as Partial<PdfeIterationFilter>
  if (typeof filter.version !== 'string' ||
    !['all', 'unconfirmed', ...manifest.iterations.map(entry => entry.version)].includes(filter.version) ||
    !filter.scope || !PDFE_ITERATION_SCOPES.includes(filter.scope)) return PDFE_ITERATION_DEFAULT
  return { version: filter.version, scope: ['all', 'unconfirmed'].includes(filter.version) ? 'any' : filter.scope }
}

export function readIterationFilter(value: string | null, manifest: PdfeIterationManifest): PdfeIterationFilter {
  try { return normalizeFilter(JSON.parse(value ?? 'null'), manifest) }
  catch { return PDFE_ITERATION_DEFAULT }
}

export interface PdfeIterationReadState {
  readonly snapshot: PdfeIterationSnapshot | null
  readonly filter: PdfeIterationFilter
  readonly request: number
  readonly loading: boolean
  readonly failed: boolean
}

export const PDFE_ITERATION_INITIAL: PdfeIterationReadState = {
  snapshot: null, filter: PDFE_ITERATION_DEFAULT, request: 0, loading: true, failed: false,
}

type IterationAction =
  | { type: 'start'; request: number }
  | { type: 'loaded'; request: number; snapshot: PdfeIterationSnapshot; storedFilter: string | null }
  | { type: 'failed'; request: number }
  | { type: 'filter'; filter: PdfeIterationFilter }

export function reducePdfeIterations(state: PdfeIterationReadState, action: IterationAction): PdfeIterationReadState {
  if (action.type === 'filter') return state.snapshot
    ? { ...state, filter: normalizeFilter(action.filter, state.snapshot.manifest) }
    : state
  if (action.type === 'start') return action.request > state.request
    ? { ...state, request: action.request, loading: true }
    : state
  if (action.request !== state.request) return state
  if (action.type === 'failed') return { ...state, loading: false, failed: true }
  return {
    snapshot: action.snapshot,
    filter: state.snapshot ? normalizeFilter(state.filter, action.snapshot.manifest) : readIterationFilter(action.storedFilter, action.snapshot.manifest),
    request: action.request,
    loading: false,
    failed: false,
  }
}
