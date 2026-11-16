import assert from 'node:assert/strict'
import test from 'node:test'
import { PREVIEW_CATALOG, type PreviewScenario } from './catalog.ts'
import { pdfeIterationPages } from './collaboration.ts'
import registry from '../../../PDFE-iterations.json' with { type: 'json' }
import { readPdfeIterations } from '../src/iterations.ts'
import {
  PDFE_ITERATION_INITIAL,
  PDFE_ITERATION_DEFAULT,
  pdfeFeature,
  pdfeFeatureMatches,
  pdfeIterationReferences,
  readIterationFilter,
  reducePdfeIterations,
  type PdfeFeature,
} from './iterations.ts'

const manifest = readPdfeIterations(JSON.stringify(registry))

test('v0.4 added scope includes schedule, paper discovery and search prototypes', () => {
  const pages = pdfeIterationPages(manifest, PREVIEW_CATALOG, { version: '0.4', scope: 'added' })
  const features = new Set(['scheduled-tasks', 'paper-discovery', 'search-shortcuts'])
  const scenes = pages.flatMap(page => page.scenarios.filter(scene => features.has(scene.feature ?? '')))
  assert.deepEqual(scenes.map(scene => scene.id).sort(), [
    'paper-discovery-curated', 'paper-discovery-personalized', 'paper-search-reasoning', 'project-search-shortcuts', 'schedules-archive-partial-failure', 'schedules-archived-runs',
    'schedules-clarification', 'schedules-conversations', 'schedules-created', 'schedules-empty', 'schedules-load-failure', 'schedules-materials',
    'schedules-new-project', 'schedules-sample',
  ])
})

test('conversation editing is introduced in v0.4', () => {
  const page = PREVIEW_CATALOG.find(candidate => candidate.id === 'page-conversation')!
  const scene = page.scenarios.find(candidate => candidate.id === 'conversation-editing')!
  const feature = pdfeFeature(manifest, page, scene)
  assert.equal(feature?.introducedIn, '0.4')
  for (const scope of ['any', 'added'] as const) {
    const pages = pdfeIterationPages(manifest, PREVIEW_CATALOG, { version: '0.4', scope })
    assert.ok(pages.some(candidate => candidate.scenarios.some(scenario => scenario.id === scene.id)))
  }
  assert.equal(pdfeFeatureMatches(feature, { version: '0.3', scope: 'any' }), false)
})

test('published baseline entries resolve to canonical product scenarios', () => {
  const home = PREVIEW_CATALOG.find(page => page.id === 'page-home')!
  for (const [pageId, ids] of Object.entries(registry.baseline.scenes)) {
    const page = PREVIEW_CATALOG.find(candidate => candidate.id === pageId)
    assert.ok(page && page.launch?.kind !== 'components', pageId)
    assert.equal(new Set(ids).size, ids.length, pageId)
    for (const id of ids) {
      const scene: PreviewScenario | undefined = page.scenarios.find(candidate => candidate.id === id)
      assert.ok(scene && !scene.aliasOf, pageId + '/' + id)
      assert.equal(pdfeFeature(manifest, page, scene)?.introducedIn, registry.baseline.version, pageId + '/' + id)
    }
  }
  for (const id of ['home-states', 'home-browse', 'home-empty', 'home-no-tasks', 'home-create']) {
    assert.equal(pdfeFeature(manifest, home, home.scenarios.find(scene => scene.id === id)!)?.id, 'project-browse')
  }
  const materials = PREVIEW_CATALOG.find(page => page.launch?.kind === 'components')!
  assert.equal(pdfeFeature(manifest, materials, materials.scenarios[0]), undefined)
})

test('schedule creation and clarification scenes belong to the conversation workspace', () => {
  const conversation = PREVIEW_CATALOG.find(page => page.id === 'page-conversation')!
  assert.equal(conversation.scenarios.find(scene => scene.id === 'schedules-created')?.simulation?.schedules, 'created')
  assert.equal(conversation.scenarios.find(scene => scene.id === 'schedules-clarification')?.simulation?.schedules, 'clarification')
  assert.equal(PREVIEW_CATALOG.some(page => page.scenarios.some(scene => scene.id === 'schedules-proposal')), false)
  assert.equal(PREVIEW_CATALOG.filter(page => page.scenarios.some(scene => scene.id === 'schedules-created')).length, 1)
})

test('unregistered scenarios do not inherit a released version from their page', () => {
  const before = JSON.stringify(PREVIEW_CATALOG)
  assert.equal(pdfeIterationPages(manifest, PREVIEW_CATALOG, PDFE_ITERATION_DEFAULT), PREVIEW_CATALOG)
  assert.equal(pdfeIterationPages(null, PREVIEW_CATALOG, { version: '0.3', scope: 'added' }), PREVIEW_CATALOG)
  const home = PREVIEW_CATALOG.find(page => page.id === 'page-home')!
  const newScene = { ...home.scenarios[0], id: 'future-scene', feature: undefined }
  const pages = [{ ...home, scenarios: [...home.scenarios, newScene] }]
  assert.equal(pdfeFeature(manifest, home, newScene), undefined)
  assert.equal(pdfeIterationPages(manifest, pages, { version: '0.3', scope: 'added' })[0].scenarios.some(scene => scene.id === newScene.id), false)
  for (const scope of ['any', 'added', 'updated'] as const) {
    assert.deepEqual(pdfeIterationPages(manifest, pages.map(page => ({ ...page, scenarios: [newScene] })), { version: '0.4', scope }), [])
  }
  assert.equal(JSON.stringify(PREVIEW_CATALOG), before)
})

test('introduced and changed iterations are distinct', () => {
  const feature: PdfeFeature = {
    id: 'project-browse',
    introducedIn: '0.3',
    changes: [
      { version: '0.4', summary: 'Synthetic update' },
    ],
  }
  assert.equal(pdfeFeatureMatches(feature, { version: '0.3', scope: 'added' }), true)
  assert.equal(pdfeFeatureMatches(feature, { version: '0.4', scope: 'updated' }), true)
  assert.equal(pdfeFeatureMatches(feature, { version: '0.4', scope: 'added' }), false)
  assert.equal(pdfeFeatureMatches(feature, { version: '0.4', scope: 'any' }), true)
})

test('iteration ordering is numeric and never derives a release from the current package', () => {
  assert.equal(manifest.current, '0.4')
  assert.deepEqual(manifest.iterations, [
    { version: '0.4', status: 'prototype' },
    { version: '0.3', status: 'released' },
  ])
})

test('filter restoration rejects malformed and stale selections and normalizes unconfirmed scope', () => {
  for (const value of [null, '{', 'null', '[]', '{"version":"9.9","scope":"any"}', '{"version":"all","scope":"bad"}']) {
    assert.deepEqual(readIterationFilter(value, manifest), PDFE_ITERATION_DEFAULT)
  }
  assert.deepEqual(readIterationFilter('{"version":"unconfirmed","scope":"updated"}', manifest), { version: 'unconfirmed', scope: 'any' })
  assert.deepEqual(readIterationFilter('{"version":"0.4","scope":"updated"}', manifest), { version: '0.4', scope: 'updated' })
  assert.equal(pdfeFeatureMatches(undefined, { version: 'unconfirmed', scope: 'any' }), false)
  assert.equal(pdfeFeatureMatches({ id: 'pending', introducedIn: null, changes: [] }, { version: 'unconfirmed', scope: 'any' }), true)
})

test('reloaded snapshots keep valid filters, retain data on failure and ignore superseded responses', () => {
  const first = { revision: 'first', manifest }
  const initial = reducePdfeIterations(PDFE_ITERATION_INITIAL, { type: 'start', request: 1 })
  const unavailable = reducePdfeIterations(initial, { type: 'failed', request: 1 })
  assert.deepEqual([unavailable.failed, unavailable.snapshot], [true, null])
  const second = reducePdfeIterations(unavailable, { type: 'start', request: 2 })
  const ready = reducePdfeIterations(second, { type: 'loaded', request: 2, snapshot: first, storedFilter: '{"version":"0.4","scope":"updated"}' })
  const third = reducePdfeIterations(ready, { type: 'start', request: 3 })
  const stale = reducePdfeIterations(third, { type: 'failed', request: 3 })
  assert.deepEqual([stale.failed, stale.snapshot, stale.filter], [true, first, { version: '0.4', scope: 'updated' }])
  const fourth = reducePdfeIterations(stale, { type: 'start', request: 4 })
  const latestManifest = readPdfeIterations(JSON.stringify({
    ...registry, current: '0.3', iterations: registry.iterations.filter(entry => entry.version !== '0.4'), features: {},
  }))
  const latest = reducePdfeIterations(fourth, { type: 'loaded', request: 4, snapshot: { revision: 'new', manifest: latestManifest }, storedFilter: null })
  assert.equal(latest.failed, false)
  assert.equal(latest.snapshot?.manifest.current, '0.3')
  assert.deepEqual(latest.filter, PDFE_ITERATION_DEFAULT)
  assert.equal(reducePdfeIterations(latest, { type: 'loaded', request: 3, snapshot: first, storedFilter: null }), latest)
})

test('reference counts deduplicate canonical feature aliases and retain registered changes', () => {
  const home = PREVIEW_CATALOG.find(page => page.id === 'page-home')!
  const subset = { ...manifest, baseline: { ...manifest.baseline, scenes: { [home.id]: ['home-empty', 'home-no-tasks'] } } }
  const references = pdfeIterationReferences(subset, [home])
  assert.equal(references.get('0.3'), 1)
  assert.equal(references.get('0.4'), 4)
})

test('a matching nested feature retains its navigation parent without exposing unrelated scenarios', () => {
  const home = PREVIEW_CATALOG.find(page => page.id === 'page-home')!
  const child = PREVIEW_CATALOG.find(page => page.id === 'surface-project-form')!
  const pages = pdfeIterationPages(manifest, [
    { ...home, scenarios: [] },
    child,
  ], { version: '0.3', scope: 'any' })
  assert.deepEqual(pages.map(page => page.id), [home.id, child.id])
  assert.deepEqual(pages[0].scenarios, [])
  assert.equal(pages[1].scenarios.length, 1)
})
