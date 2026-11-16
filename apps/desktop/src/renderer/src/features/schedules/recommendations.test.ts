import assert from 'node:assert/strict'
import test from 'node:test'
import {
  recommendationSources,
  recommendationDraft,
  recommendationPage,
  RECOMMENDATION_LIMIT,
  RECOMMENDATION_DYNAMIC_LIMIT,
  FIXED_RECOMMENDATIONS,
} from './recommendations.ts'

const project = { path: '/research', description: '' }
const empty = { papers: [], files: [], sessions: [] }

test('empty projects leave room for the three default examples', () => {
  assert.deepEqual(recommendationSources(project, empty), [])
})

test('uses project evidence, deduplicates titles and excludes unavailable files and generated sessions', () => {
  const result = recommendationSources(
    project,
    {
      papers: [
        { id: 'one', title: 'Protein design' },
        { id: 'two', title: ' Protein design ' },
      ],
      files: [
        { path: 'notes.md', name: 'notes.md', available: true },
        { path: 'missing', name: 'Missing', available: false },
      ],
      sessions: [
        { id: 'other', title: 'Other project', projectPath: '/other', status: 'done' },
        { id: 'mine', title: 'Experiment analysis', projectPath: '/research', status: 'done' },
        { id: 'run', title: 'Scheduled run', projectPath: '/research', status: 'done' },
      ],
    },
    new Set(['run'])
  )
  assert.deepEqual(
    result.map((source) => source.title),
    ['Protein design', 'notes.md', 'Experiment analysis']
  )
  assert.equal(result[1].reference, 'notes.md')
})

test('a project description alone does not replace the three fixed templates', () => {
  assert.equal(recommendationSources({ path: '/empty', description: '  ' }, empty).length, 0)
  assert.equal(
    recommendationSources({ path: '/empty', description: 'Study soil moisture' }, empty).length,
    0
  )
})

test('bounds recommendations while balancing evidence types and paginates without wrapping', () => {
  const sources = recommendationSources(project, {
    ...empty,
    papers: Array.from({ length: 30 }, (_, index) => ({
      id: String(index),
      title: `Paper ${index}`,
    })),
    files: [{ path: 'data.csv', name: 'data.csv', available: true }],
  })
  assert.equal(sources.length, RECOMMENDATION_DYNAMIC_LIMIT)
  assert.equal(sources.length + FIXED_RECOMMENDATIONS.length, RECOMMENDATION_LIMIT)
  assert.equal(sources[1].kind, 'file')
  assert.equal(recommendationPage(sources, 0).items.length, 3)
  assert.equal(recommendationPage(sources, 999).index, 1)
  assert.equal(recommendationPage(sources, 1, 1).items[0].kind, 'file')
  assert.equal(recommendationPage(sources, 1, 1).total, RECOMMENDATION_DYNAMIC_LIMIT)
  assert.equal(recommendationPage([], -1).index, 0)
})

test('conversation-only and material-only projects can independently produce suggestions', () => {
  const sessions = Array.from({ length: 8 }, (_, index) => ({
    id: `interest-${index}`,
    title: `Research interest ${index}`,
    projectPath: project.path,
    status: 'done' as const,
  }))
  assert.equal(
    recommendationSources(project, { ...empty, sessions }).length,
    RECOMMENDATION_DYNAMIC_LIMIT
  )
  assert.equal(
    recommendationSources(project, {
      ...empty,
      files: [{ path: 'notes.md', name: 'notes.md', available: true }],
    }).length,
    1
  )
  assert.equal(
    recommendationSources(project, { ...empty, papers: [{ id: 'paper', title: 'Research paper' }] })
      .length,
    1
  )
  assert.equal(
    recommendationSources(
      project,
      { ...empty, sessions },
      new Set(sessions.map((session) => session.id))
    ).length,
    0
  )
  assert.equal(FIXED_RECOMMENDATIONS.length, 3)
})

test('drafts keep contextual instructions, limits and cadence without mutating inputs', () => {
  const text = { name: 'x'.repeat(250), prompt: 'Use the selected paper as a starting point.' }
  const draft = recommendationDraft('paper', text)
  assert.equal(draft.name.length, 200)
  assert.equal(draft.prompt, text.prompt)
  assert.equal(draft.frequency, 'weekly')
  assert.equal(recommendationDraft('session', text).time, '17:00')
  assert.equal(recommendationDraft('file', text).frequency, 'monthly')
  assert.equal(text.name.length, 250)
})
