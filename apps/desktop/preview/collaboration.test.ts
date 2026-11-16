import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { PREVIEW_CATALOG } from './catalog.ts'
import { PDFE_ROLES, PDFE_ROLE_KNOWLEDGE, PDFE_TASK_SCOPES, pdfeFeatureTarget, pdfeFeatureLabels, pdfeGuidance, pdfePageMatches, pdfeTaskContext, type PdfeTranslate } from './collaboration.ts'
import { createLocalization } from '../src/localization/engine.ts'
import zh from './locales/zh.json' with { type: 'json' }
import en from './locales/en.json' with { type: 'json' }

test('feature labels distinguish introduction and every changed version in both languages', () => {
  const feature = { id: 'example', introducedIn: '0.3', changes: [
    { version: '0.3.1', summary: 'First update' },
    { version: '0.3.2', summary: 'Second update' },
  ] }
  for (const language of ['zh', 'en'] as const) {
    const translate = createLocalization(language, { zh: { preview: zh }, en: { preview: en } }).getFixedT(null, 'preview' as never) as unknown as PdfeTranslate
    assert.deepEqual(pdfeFeatureLabels(feature, translate).map(label => label.text), language === 'zh'
      ? ['v0.3 新增', 'v0.3.1 变更', 'v0.3.2 变更']
      : ['Added in v0.3', 'Changed in v0.3.1', 'Changed in v0.3.2'])
    assert.equal(pdfeFeatureLabels(feature, translate)[1].summary, 'First update')
    assert.deepEqual(pdfeFeatureLabels(undefined, translate), [])
    assert.deepEqual(pdfeFeatureLabels({ ...feature, introducedIn: null, changes: [] }, translate).map(label => label.text), [language === 'zh' ? '新增版本待确认' : 'Introduction unconfirmed'])
  }
})

test('every project center scenario has bilingual guidance from one resource source', () => {
  const home = PREVIEW_CATALOG.find(page => page.id === 'page-home')!
  const before = JSON.stringify(home)
  for (const language of ['zh', 'en'] as const) {
    const dictionary = language === 'zh' ? zh : en
    const translate = createLocalization(language, { zh: { preview: zh }, en: { preview: en } }).getFixedT(null, 'preview' as never) as unknown as PdfeTranslate
    for (const scene of home.scenarios) {
      assert.ok(scene.expectedKeys?.length, scene.id)
      assert.ok(scene.limitationKeys?.length, scene.id)
      assert.deepEqual(scene.expected, scene.expectedKeys.map(key => zh[key]))
      assert.deepEqual(scene.limitations, scene.limitationKeys.map(key => zh[key]))
      const guidance = pdfeGuidance(home, scene, translate)
      assert.deepEqual(guidance.entry, [dictionary.homeEntry])
      assert.deepEqual(guidance.expected, scene.expectedKeys.map(key => dictionary[key]))
      assert.deepEqual(guidance.limitations, scene.limitationKeys.map(key => dictionary[key]))
      if (language === 'en') assert.doesNotMatch([...guidance.entry, ...guidance.expected, ...guidance.limitations].join('\n'), /[\u3400-\u9fff]/u, scene.id)
    }
  }
  assert.equal(JSON.stringify(home), before)
})

test('browser snapshot guidance is bilingual without claiming removed inner-tab controls', () => {
  for (const pageId of ['page-browser', 'viewer-browser']) {
    const page = PREVIEW_CATALOG.find(page => page.id === pageId)!
    const before = JSON.stringify(page)
    for (const language of ['zh', 'en'] as const) {
      const dictionary = language === 'zh' ? zh : en
      const translate = createLocalization(language, { zh: { preview: zh }, en: { preview: en } }).getFixedT(null, 'preview' as never) as unknown as PdfeTranslate
      for (const scene of page.scenarios) {
        assert.ok(scene.expectedKeys?.length && scene.limitationKeys?.length && scene.titleKey)
        const guidance = pdfeGuidance(page, scene, translate)
        assert.deepEqual(guidance.expected, scene.expectedKeys.map(key => dictionary[key]))
        assert.deepEqual(guidance.limitations, scene.limitationKeys.map(key => dictionary[key]))
        if (language === 'en') assert.doesNotMatch([dictionary[scene.titleKey], ...guidance.expected, ...guidance.limitations].join('\n'), /[\u3400-\u9fff]/u, scene.id)
      }
    }
    assert.equal(JSON.stringify(page), before)
  }
})

test('feedback guidance reuses the current activity entry and localizes normal submission', () => {
  const page = PREVIEW_CATALOG.find(page => page.id === 'surface-feedback')!
  const scene = page.scenarios.find(scene => scene.id === 'feedback-normal')!
  for (const dictionary of [zh, en]) {
    const guidance = pdfeGuidance(page, scene, key => dictionary[key])
    assert.deepEqual(guidance.entry, [dictionary['dialogEntry_feedback-form']])
    assert.deepEqual(guidance.expected, [dictionary.feedbackSubmitExpected])
  }
})

test('guidance preserves unmodified catalog text for pages outside this milestone', () => {
  const page = PREVIEW_CATALOG.find(page => page.id === 'page-conversation')!
  const scene = page.scenarios[0]
  const guidance = pdfeGuidance(page, scene, () => { throw new Error('Unexpected translation of legacy guidance') })
  assert.deepEqual(guidance.entry, page.entryInstructions ?? [])
  assert.equal(guidance.expected, scene.expected)
  assert.equal(guidance.limitations, scene.limitations)
})

test('UI assets return navigation restores only a known available feature scene', () => {
  const target = { pageId: 'page-projects', sceneId: 'projects-browse' }
  assert.deepEqual(pdfeFeatureTarget(JSON.stringify(target)), target)
  const fallback = pdfeFeatureTarget(null)
  for (const value of ['{', 'null', '[]', '"foreign"', '{"pageId":"unknown","sceneId":"unknown"}', '{"pageId":"page-projects","sceneId":"foreign"}', '{"pageId":"development-components","sceneId":"components-states"}']) assert.deepEqual(pdfeFeatureTarget(value), fallback)
})

test('every declared Mock state has readable Chinese and English capability labels', () => {
  const states = (language: string): Record<string, string> => Object.fromEntries(Object.entries(JSON.parse(readFileSync(new URL('./locales/' + language + '.json', import.meta.url), 'utf8'))).filter(([key]) => key.startsWith('state_')).map(([key, value]) => [key.slice('state_'.length), value as string]))
  const zh = states('zh')
  const en = states('en')
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort())
  for (const page of PREVIEW_CATALOG) for (const scene of page.scenarios) for (const state of scene.states) {
    assert.ok(typeof zh[state] === 'string' && zh[state].trim(), scene.id + '/' + state)
    assert.ok(typeof en[state] === 'string' && en[state].trim(), scene.id + '/' + state)
  }
})

test('role knowledge points to real Owner sources without creating role-specific product targets or permissions', () => {
  const root = new URL('../../../', import.meta.url)
  const page = PREVIEW_CATALOG.find(entry => entry.id === 'page-conversation')!
  const scene = page.scenarios[0]
  const source = JSON.stringify(page)
  const contexts = PDFE_ROLES.map(role => pdfeTaskContext({ role: role.id, intent: 'review', task: ' 调整当前页面 ', pageId: page.id, sceneId: scene.id }))
  assert.deepEqual(PDFE_ROLES.map(role => role.id), ['product', 'design', 'frontend', 'backend'])
  for (const context of contexts) {
    assert.equal(context.task, '调整当前页面')
    assert.equal(context.pageId, page.id)
    assert.equal(context.sceneId, scene.id)
    assert.equal(context.authorization, 'not-granted-by-context')
    assert.equal(context.sourceBaseline, null)
    assert.equal(context.requiresSemanticReview, true)
    assert.deepEqual(context.confirmedChanges, [])
    assert.ok(context.knowledge.includes(PDFE_ROLE_KNOWLEDGE))
    for (const path of context.knowledge) assert.equal(existsSync(fileURLToPath(new URL(path, root))), true, path)
  }
  assert.equal(JSON.stringify(page), source)
  assert.notDeepEqual(contexts[0].knowledge, contexts[1].knowledge)
  assert.deepEqual(contexts.map(context => context.scope), ['mock', 'presentation', 'presentation', 'backend'])
  assert.deepEqual(contexts[2].candidateFiles, [`apps/desktop/${page.source}`])
  assert.deepEqual(contexts[3].candidateFiles, [])
  assert.ok(contexts[3].knowledge.includes('apps/serve/AGENTS.md'))
  assert.deepEqual(contexts.map(context => context.verification), Array(4).fill('read-only-source-review'))
  assert.deepEqual(contexts[0].requiresScopeReview, contexts[2].requiresScopeReview)
})

test('task scope keeps mock candidates distinct from product requirements', () => {
  assert.deepEqual(PDFE_TASK_SCOPES.map(scope => scope.id), ['mock', 'presentation', 'backend'])
  const page = PREVIEW_CATALOG[0]
  const context = pdfeTaskContext({ role: 'product', intent: 'prototype', task: 'samples', pageId: page.id, sceneId: page.scenarios[0].id })
  assert.deepEqual(context.candidateFiles, ['apps/desktop/preview/catalog.ts', 'apps/desktop/preview/fixtures/'])
  assert.deepEqual(context.confirmedChanges, [])
  assert.ok(context.requiresScopeReview.includes('mock-engine'))
})

test('task context preserves unbound review, explicit scope and the source baseline without granting write access', () => {
  const review = pdfeTaskContext({ intent: 'review', task: '查找来源' })
  assert.equal(review.role, null)
  assert.equal(review.pageId, null)
  assert.equal(review.sceneId, null)
  assert.deepEqual(review.candidateFiles, [])
  const baseline = { revision: '4ccb6db94', dirtyPaths: ['apps/desktop/preview/Console.tsx'] }
  const changes = [{ file: 'apps/serve/service/chat/api/settings.py', behavior: '限定此次已经确认的后端错误处理' }]
  const context = pdfeTaskContext({ intent: 'product', role: 'backend', task: '核对后端处理', source: '用户已确认的需求', sourceBaseline: baseline, confirmedChanges: changes })
  assert.deepEqual(context.sourceBaseline, baseline)
  assert.deepEqual(context.confirmedChanges, changes)
  assert.equal(context.requirementSource, '用户已确认的需求')
  assert.equal(context.authorization, 'not-granted-by-context')
  assert.throws(() => pdfeTaskContext({ intent: 'review', task: '只读', confirmedChanges: changes }), /Read-only/)
  assert.throws(() => pdfeTaskContext({ intent: 'review', task: '只读', proposedChanges: changes }), /Read-only/)
  assert.throws(() => pdfeTaskContext({ intent: 'product', role: 'backend', task: '修 Serve', proposedChanges: changes }), /prototype/)
  assert.throws(() => pdfeTaskContext({ intent: 'product', role: 'frontend', task: '改页面', confirmedChanges: changes }), /source baseline/)
  assert.throws(() => pdfeTaskContext({ intent: 'review', task: '错误场景', pageId: 'page-home', sceneId: 'conversation-stream' }), /Unknown PDFE target/)
  assert.throws(() => pdfeTaskContext({ intent: 'product', role: 'backend', task: '错误路径', sourceBaseline: baseline, confirmedChanges: [{ file: '../outside', behavior: '写入' }] }), /repository-relative/)
})

test('an omitted scope uses the role default; explicit invalid scopes fail', () => {
  const task = { intent: 'review', role: 'frontend', task: '核对页面' }
  assert.equal(pdfeTaskContext(task).scope, 'presentation')
  for (const scope of [null, '', false, 'unknown']) {
    assert.throws(() => pdfeTaskContext({ ...task, scope }), /Unknown PDFE task scope/)
  }
})

test('prototype proposals distinguish a scene source from cross-layer handoffs without confirming either', () => {
  const task = { intent: 'prototype', role: 'frontend', task: '调整项目中心', pageId: 'page-home', sceneId: 'home-no-tasks' }
  const local = { file: 'apps/desktop/src/renderer/src/features/home/HomeOverview.tsx', behavior: '调整无任务时的展示文案' }
  const mixed = { ...local, behavior: '在展示文件内更改接口请求和共享状态语义' }
  const crossLayer = [
    { file: 'apps/desktop/src/renderer/src/store.tsx', behavior: '调整全局状态' },
    { file: 'apps/desktop/src/renderer/src/api.ts', behavior: '调整接口协议' },
    { file: 'apps/desktop/src/renderer/src/components/ui/index.ts', behavior: '调整共享组件' },
    { file: 'apps/desktop/src/renderer/src/shell/ConversationSurface.tsx', behavior: '调整另一页面' },
  ]
  const context = pdfeTaskContext({ ...task, proposedChanges: [local, mixed, ...crossLayer] })
  assert.deepEqual(context.candidateFiles, [local.file])
  assert.deepEqual(context.proposedChanges, [
    ...[local, mixed].map(change => ({ ...change, disposition: 'semantic-review-required' })),
    ...crossLayer.map(change => ({ ...change, disposition: 'owner-handoff-required' })),
  ])
  assert.deepEqual(context.confirmedChanges, [])
  assert.deepEqual(pdfeTaskContext({ ...task, sceneId: undefined, proposedChanges: [local] }).proposedChanges,
    [{ ...local, disposition: 'owner-handoff-required' }])
  const sourceBaseline = { revision: '4ccb6db94', dirtyPaths: [] }
  for (const change of [local, mixed, ...crossLayer]) {
    assert.throws(() => pdfeTaskContext({ ...task, sourceBaseline, confirmedChanges: [change] }), /cannot confirm/)
  }
})

test('discovery searches stable page, scenario and state identities and respects categories', () => {
  const conversation = PREVIEW_CATALOG.find(page => page.id === 'page-conversation')!
  const components = PREVIEW_CATALOG.find(page => page.id === 'development-components')!
  assert.equal(pdfePageMatches(conversation, ' CONVERSATION-STREAM '), true)
  assert.equal(pdfePageMatches(conversation, 'streaming'), true)
  assert.equal(pdfePageMatches(conversation, '', 'settings'), false)
  assert.equal(pdfePageMatches(components, '组件', 'development'), true)
  assert.equal(pdfePageMatches(components, 'no-matching-pdfe-page-or-state'), false)
})
