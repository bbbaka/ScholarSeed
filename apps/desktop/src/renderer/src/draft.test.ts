import assert from 'node:assert/strict'
import test from 'node:test'
import {
  composerDraftKey,
  createComposerDraftStore,
  readComposerDrafts,
  restoreComposerDraft,
  serializeComposerDrafts,
  type ConversationDraft,
} from './draft.ts'

test('template fields remain empty until supplied and never send example hints', () => {
  const draft = createComposerDraftStore()
  draft.setTemplate({
    prefix: '研究：',
    suffix: '，附引用。',
    label: '方向',
    placeholder: '例如材料预测',
  })
  assert.equal(draft.getSnapshot(), '研究：，附引用。')
  draft.fillTemplate('  ')
  draft.fillTemplate('土壤碳循环')
  assert.equal(draft.getSnapshot(), '研究：土壤碳循环，附引用。')
  draft.finishTemplate()
  assert.equal(draft.getTemplate(), null)
  assert.equal(draft.getSnapshot(), '研究：土壤碳循环，附引用。')
})

test('incomplete templates cannot become ordinary drafts and reset clears template state', () => {
  const draft = createComposerDraftStore()
  const template = { prefix: '研究：', suffix: '', label: '方向', placeholder: '示例' }
  draft.setTemplate(template)
  draft.finishTemplate()
  assert.notEqual(draft.getTemplate(), null)
  draft.reset()
  assert.equal(draft.getTemplate(), null)
  assert.equal(draft.getSnapshot(), '')
  draft.setTemplate(template)
  draft.set('普通问题')
  assert.equal(draft.getTemplate(), null)
})

test('composer draft updates notify only draft subscribers', () => {
  const draft = createComposerDraftStore('seed')
  const snapshots: string[] = []
  const unsubscribe = draft.subscribe(() => snapshots.push(draft.getSnapshot()))

  draft.set('你为什么')
  draft.set((current) => `${current}卡顿`)
  draft.set('你为什么卡顿')
  unsubscribe()
  draft.set('ignored after unsubscribe')

  assert.deepEqual(snapshots, ['你为什么', '你为什么卡顿'])
})

test('reselecting a template creates a fresh focus target without retaining an old answer', () => {
  const draft = createComposerDraftStore()
  const template = {
    prefix: 'Topic: ',
    suffix: '. Cite sources.',
    label: 'Topic',
    placeholder: 'Example',
  }
  draft.setTemplate(template)
  const generation = draft.getTemplate()?.generation
  draft.fillTemplate('Ecology')
  assert.equal(draft.getTemplate()?.generation, generation)
  draft.setTemplate(template)
  assert.notEqual(draft.getTemplate()?.generation, generation)
  assert.equal(draft.getTemplate()?.value, '')
})

test('failed submissions restore before any draft typed while sending', () => {
  assert.equal(restoreComposerDraft('原问题', ''), '原问题')
  assert.equal(restoreComposerDraft('原问题', '后续草稿'), '原问题\n后续草稿')
})

test('draft revisions distinguish edits that return to the submitted text', () => {
  const draft = createComposerDraftStore('submitted')
  const revision = draft.getRevision()
  draft.set('submitted')
  assert.equal(draft.getRevision(), revision)
  draft.set('')
  draft.set('submitted')
  assert.equal(draft.getSnapshot(), 'submitted')
  assert.equal(draft.getRevision(), revision + 2)
})

test('only an explicit draft reset advances scope, including empty-to-empty resets', () => {
  const draft = createComposerDraftStore()
  const initial = draft.getScope()
  draft.set('typing')
  draft.set('')
  assert.equal(draft.getScope(), initial)
  draft.reset()
  assert.equal(draft.getScope(), initial + 1)
  draft.reset()
  assert.equal(draft.getScope(), initial + 2)
  draft.set('continued typing')
  assert.equal(draft.getScope(), initial + 2)
})

test('new project and session drafts survive reopening without sharing their keys or losing references', () => {
  const project = composerDraftKey(null, 'project-a')!
  const other = composerDraftKey(null, 'project-b')!
  const session = composerDraftKey('session-a', 'project-a')!
  assert.notEqual(project, other)
  assert.notEqual(project, session)
  assert.equal(composerDraftKey(null, null), null)
  const reference = {
    type: 'file' as const,
    id: 'registered-id',
    referenceId: 'registered-id',
    title: 'source.md',
    path: '/project/source.md',
    sha256: 'source-revision',
  }
  const drafts = new Map<string, ConversationDraft>([
    [project, { text: 'Unsent project text', refs: [reference] }],
    [other, { text: 'Other project', refs: [] }],
    [session, { text: 'Existing session', refs: [reference] }],
  ])
  const reopened = readComposerDrafts(serializeComposerDrafts(drafts))
  assert.equal(reopened.get(project)?.text, 'Unsent project text')
  assert.equal(reopened.get(other)?.text, 'Other project')
  assert.equal(reopened.get(session)?.text, 'Existing session')
  assert.deepEqual(reopened.get(session)?.refs, [reference])
  reopened.set(session, { text: '', refs: [] })
  reopened.delete(project)
  const afterConsumption = readComposerDrafts(serializeComposerDrafts(reopened))
  assert.equal(afterConsumption.has(project), false)
  assert.equal(afterConsumption.get(session)?.text, '')
  assert.equal(afterConsumption.get(other)?.text, 'Other project')
})

test('volatile File bytes are not persisted as an apparently usable attachment', () => {
  const file = new File(['private bytes'], 'clipboard.txt', { type: 'text/plain' })
  const reference = {
    type: 'file' as const,
    id: 'clipboard',
    title: file.name,
    path: '',
    localSource: { file },
  }
  const drafts = new Map([['scope', { text: 'Keep text', refs: [reference] }]])
  const saved = serializeComposerDrafts(drafts)
  assert.equal(drafts.get('scope')?.refs[0].localSource.file, file)
  assert.equal(saved.includes('private bytes'), false)
  assert.deepEqual(readComposerDrafts(saved).get('scope')?.refs[0], {
    ...reference,
    localSource: {},
  })
})

test('malformed persisted references are not restored as executable draft state', () => {
  for (const value of [
    'invalid-json',
    '{}',
    '[["scope",{"text":"text","refs":[null]}]]',
    '[["scope",{"text":"text","refs":[],"context":{"refs":[null],"projectPolicy":"explicit_only","searchScope":"web"}}]]',
  ]) {
    assert.equal(readComposerDrafts(value).size, 0)
  }
})
