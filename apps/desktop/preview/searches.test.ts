import assert from 'node:assert/strict'
import test from 'node:test'
import { PreviewSearches, PREVIEW_SEARCH } from './searches.ts'

test('closing a search removes only its instance-owned task and is idempotent', () => {
  const searches = new PreviewSearches()
  const first = searches.createLiterature({ query: '推理模型' })
  const second = searches.createLiterature({ query: 'reasoning models' })
  new PreviewSearches().deleteLiterature(first.id)
  assert.equal(searches.listLiterature().items.length, 2)
  searches.deleteLiterature(first.id)
  searches.deleteLiterature(first.id)
  assert.deepEqual(searches.listLiterature().items.map(task => task.id), [second.id])
  assert.throws(() => searches.conversation({ task_id: first.id, paper_ids: [] }), { status: 404 })
})

test('search continuation copies all or selected existing results and rejects unknown identities', () => {
  const searches = new PreviewSearches()
  const task = searches.createLiterature({ query: '推理模型' })
  const papers = task.result!.papers
  const all = searches.conversation({ task_id: task.id, paper_ids: [] })
  assert.equal(all.query, task.query)
  for (const paper of papers) assert.ok(all.answer.includes(paper.title))
  const selected = searches.conversation({ task_id: task.id, paper_ids: [papers[0].paper_id] })
  assert.ok(selected.answer.includes(papers[0].title))
  assert.ok(!selected.answer.includes(papers[1].title))
  assert.throws(() => searches.conversation({ task_id: task.id, paper_ids: ['unknown'] }), { status: 422 })
  assert.throws(() => new PreviewSearches().conversation({ task_id: task.id, paper_ids: [] }), { status: 404 })
})

test('reasoning sample returns three ordered papers with isolated results for both sample queries', () => {
  const searches = new PreviewSearches()
  for (const query of ['推理模型', 'reasoning models', '最近推理模型有哪些值得关注的进展？']) {
    const task = searches.createLiterature({ query })
    assert.equal(task.status, 'completed')
    assert.equal(task.result?.papers.length, 3)
    assert.match(task.result!.papers[0].title, /Psychological Depth/)
    assert.match(task.result!.papers[1].title, /RPEG/)
    assert.match(task.result!.papers[2].title, /LeanDojo/)
    assert.ok(task.result!.papers.every(paper => paper.reason && paper.authors.length))
    task.result!.papers.length = 0
    assert.equal(searches.listLiterature().items[0].result?.papers.length, 3)
  }
  assert.equal(new PreviewSearches().listLiterature().items.length, 0)
})

test('catalog searches match titles and identifiers, keep isolated history and reject blank queries', () => {
  const searches = new PreviewSearches()
  const task = searches.createLiterature({ query: '2611.09061' })
  assert.equal(task.status, 'completed')
  assert.equal(task.result?.papers.length, 1)
  assert.match(task.result!.papers[0].title, /Psychological Depth/)
  assert.equal(searches.createLiterature({ query: 'no-matching-paper-unique' }).status, 'empty')
  assert.equal(searches.listLiterature().items.length, 2)
  assert.equal(new PreviewSearches().listLiterature().items.length, 0)
  assert.throws(() => searches.createLiterature({ query: '  ' }), { status: 422 })
})

test('literature history is scene scoped, isolated and consumable as a terminal production task', () => {
  assert.deepEqual(new PreviewSearches().listLiterature(), { items: [] })
  const first = new PreviewSearches({ literature: true })
  const second = new PreviewSearches({ literature: true })
  const task = first.listLiterature().items[0]
  assert.equal(task.query, PREVIEW_SEARCH.literatureQuery)
  assert.equal(task.status, 'completed')
  assert.ok(task.completed_at! >= task.created_at)
  assert.notEqual(task.id, second.listLiterature().items[0].id)
  assert.equal(task.result?.papers.length, 2)
  assert.deepEqual(JSON.parse(task.output), task.result)
  task.result!.papers.length = 0
  assert.equal(first.listLiterature().items[0].result?.papers.length, 2)
})

test('library lookup resolves only seeded paper identities and does not fabricate imports', () => {
  const searches = new PreviewSearches({ literature: true })
  const papers = searches.listLiterature().items[0].result!.papers
  const request = { project_id: '', papers: papers.map(paper => ({ id: paper.paper_id, title: paper.title, doi: paper.doi, year: paper.year })) }
  assert.deepEqual(searches.resultStatus(request), { items: Object.fromEntries(papers.map(paper => [paper.paper_id, { library: 'absent' }])) })
  assert.throws(() => new PreviewSearches().resultStatus(request), { status: 422, code: 'preview_search_paper_unknown' })
  assert.throws(() => searches.resultStatus({ papers: [{ id: 'unknown' }] }), { status: 422 })
})


test('library lookup rejects malformed requests without execution', () => {
  const searches = new PreviewSearches()
  for (const body of [null, {}, { papers: 'invalid' }]) assert.throws(() => searches.resultStatus(body), { status: 422 })
})
