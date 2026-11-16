import assert from 'node:assert/strict'
import test from 'node:test'
import {
  HOT_DISCOVERY_PERIODS,
  visibleFeedMode,
  recommendationBatch,
  createInterest,
} from './feed.ts'

test('refresh switches batches, cycles safely and excludes dismissed papers', () => {
  const feed = {
    eligible: true,
    recommendations: ['a', 'b', 'c', 'd', 'e', 'f'].map((paperId) => ({
      paperId,
      reason: { zh: '', en: '' },
    })),
  }
  const ids = (batch: number, hidden: string[] = []) =>
    recommendationBatch(feed, batch, hidden).entries.map((entry) => entry.paperId)
  assert.deepEqual(ids(0), ['a', 'b', 'c'])
  assert.deepEqual(ids(1), ['d', 'e', 'f'])
  assert.deepEqual(ids(2), ids(0))
  assert.deepEqual(ids(1, ['d']), ['e', 'f'])
  assert.equal(recommendationBatch(feed, 0, ['d', 'e', 'f']).canRefresh, false)
  assert.deepEqual(recommendationBatch({ eligible: true, recommendations: [] }, 1, []).entries, [])
})

test('personal recommendations remain accessible before preferences are ready', () => {
  assert.equal(visibleFeedMode('personal', { eligible: false, recommendations: [] }), 'personal')
  assert.equal(visibleFeedMode('personal', { eligible: true, recommendations: [] }), 'personal')
  assert.equal(visibleFeedMode('hot', { eligible: true, recommendations: [] }), 'hot')
  assert.deepEqual(HOT_DISCOVERY_PERIODS, ['week', 'month'])
})

test('optional interests combine without duplicates and empty selection restores exploration', () => {
  const feed = {
    eligible: false,
    recommendations: ['a', 'b', 'c', 'd'].map((paperId) => ({
      paperId,
      reason: { zh: '探索', en: 'Explore' },
    })),
    interests: [
      { id: 'reasoning', label: { zh: '推理', en: 'Reasoning' }, paperIds: ['a', 'b'] },
      { id: 'agents', label: { zh: '智能体', en: 'Agents' }, paperIds: ['b', 'c'] },
    ],
  }
  const ids = (selected: string[], hidden: string[] = []) =>
    recommendationBatch(feed, 0, hidden, selected).entries.map((entry) => entry.paperId)
  assert.deepEqual(ids(['reasoning']), ['a', 'b'])
  assert.deepEqual(ids(['reasoning', 'agents']), ['a', 'b', 'c'])
  assert.deepEqual(ids(['reasoning', 'agents'], ['b']), ['a', 'c'])
  assert.deepEqual(ids([]), ['a', 'b', 'c'])
  assert.deepEqual(ids(['unknown']), ['a', 'b', 'c'])
  assert.deepEqual(ids(['reasoning'], ['a', 'b']), [])
})

test('custom interests trim input, reuse existing labels and only match declared sample terms', () => {
  const interests = [
    {
      id: 'reasoning',
      label: { zh: '推理模型', en: 'Reasoning models' },
      paperIds: ['a'],
      matchTerms: ['强化学习', 'reinforcement learning'],
    },
  ]
  assert.equal(createInterest('   ', interests), null)
  assert.equal(createInterest(' REASONING   models ', interests), interests[0])
  const custom = createInterest('  强化学习  ', interests)!
  assert.equal(custom.label.zh, '强化学习')
  assert.deepEqual(custom.paperIds, ['a'])
  assert.equal(createInterest('强化学习', [...interests, custom]), custom)
  const unknown = createInterest('土壤微生物', interests)!
  assert.deepEqual(unknown.paperIds, [])
  assert.equal(unknown.label.en, '土壤微生物')
  assert.deepEqual(
    recommendationBatch(
      {
        eligible: false,
        interests: [unknown],
        recommendations: [{ paperId: 'a', reason: { zh: '', en: '' } }],
      },
      0,
      [],
      [unknown.id]
    ).entries,
    []
  )
})
