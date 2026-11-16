import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { test } from 'node:test'
import { PREVIEW_PROJECT_ID, PREVIEW_SCHEDULE_RECOVERY } from './constants.ts'
import { createPreviewService } from './service.ts'
import { PREVIEW_DISCOVERY, PREVIEW_DISCOVERY_SAVED } from './discovery.ts'
import { PREVIEW_PROJECT_SEARCH } from './search.ts'
import { PREVIEW_CREATED_SCHEDULE, PREVIEW_CREATED_SCHEDULE_REPLY } from './scheduling.ts'
import { CURATED_PAPERS } from '../src/renderer/src/features/literature/recommendations.ts'
import { searchPapersBibtex } from '../src/renderer/src/features/literature/result.ts'
import type { ScheduleSnapshot } from '../src/renderer/src/features/schedules/model.ts'

async function fixture(initialScene: string) {
  const service = createPreviewService()
  const server = createServer((request, response) => {
    const referer = new URL(request.headers.referer ?? 'http://preview.local')
    referer.searchParams.set('scene', initialScene)
    request.headers.referer = referer.toString()
    service.middleware(request, response, () => response.writeHead(404).end())
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  assert.ok(address && typeof address !== 'string')
  const base = 'http://127.0.0.1:' + address.port
  return {
    base,
    request(path: string, instance: string, body: unknown) {
      return fetch(base + path, {
        method: 'POST',
        headers: { referer: base + '/?previewInstance=' + instance, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
    },
    close() {
      service.dispose()
      server.closeAllConnections()
      server.close()
    },
  }
}

for (const [scene, expectedSessions, hasFiles] of [
  ['schedules-new-project', 0, false],
  ['schedules-conversations', 8, false],
  ['schedules-materials', 0, true],
] as const) {
  test(`PDFE recommendation seeds isolate conversation and material evidence: ${scene}`, async () => {
    const runtime = await fixture(scene)
    try {
      const read = async (path: string) => {
        const response = await fetch(runtime.base + path, { headers: { referer: runtime.base + '/?previewInstance=recommendations' } })
        assert.equal(response.status, 200)
        return response.json()
      }
      const catalog = await read('/api/serve/sessions?scope=all')
      assert.equal(catalog.sessions.length, expectedSessions)
      const files = await read(`/api/content/projects/${PREVIEW_PROJECT_ID}/tree?path=&offset=0`)
      assert.equal(files.nodes.length > 0, hasFiles)
      assert.deepEqual(await read(`/api/serve/projects/${PREVIEW_PROJECT_ID}/schedules`), { tasks: [], runs: [] })
      for (const session of catalog.sessions) {
        const history = await read('/api/serve/history/' + session.session_id)
        assert.ok(JSON.stringify(history).includes(session.title))
      }
    } finally {
      runtime.close()
    }
  })
}

test('schedule clarification has unanswered questions without a plan or execution', async () => {
  const runtime = await fixture('schedules-clarification')
  try {
    const read = async (path: string) => {
      const response = await fetch(runtime.base + path, { headers: { referer: runtime.base + '/?previewInstance=clarification' } })
      assert.equal(response.status, 200)
      return response.json()
    }
    const snapshot = await read(`/api/serve/projects/${PREVIEW_PROJECT_ID}/schedules`)
    assert.equal(snapshot.tasks.length, 0)
    assert.equal(snapshot.runs.length, 0)
    const catalog = await read('/api/serve/sessions?scope=all')
    assert.equal(catalog.sessions.length, 1)
    const session = catalog.sessions[0]
    assert.equal(session.title, PREVIEW_CREATED_SCHEDULE.title)
    const pending = await read('/api/serve/interactions/pending')
    assert.equal(pending.interactions.length, 1)
    assert.equal(pending.interactions[0].state, 'pending')
    assert.equal(pending.interactions[0].questions.length, 3)
    assert.equal(pending.interactions[0].session_id, session.session_id)
    const history = await read('/api/serve/history/' + session.session_id)
    assert.ok(history.turns.some((turn: {text: string}) => turn.text === PREVIEW_CREATED_SCHEDULE.request))
    assert.equal(history.activity_events.filter((event: {type: string}) => event.type === 'hil_requested').length, 1)
    assert.equal(history.activity_events.some((event: {type: string}) => ['hil_resolved', 'display_card'].includes(event.type)), false)
    assert.equal(history.turns.some((turn: {text: string}) => turn.text === PREVIEW_CREATED_SCHEDULE_REPLY), false)
  } finally {
    runtime.close()
  }
})

test('created schedule retains answered clarification and a separate execution conversation', async () => {
  const runtime = await fixture('schedules-created')
  try {
    const read = async (path: string) => {
      const response = await fetch(runtime.base + path, { headers: { referer: runtime.base + '/?previewInstance=created' } })
      assert.equal(response.status, 200)
      return response.json()
    }
    const endpoint = `/api/serve/projects/${PREVIEW_PROJECT_ID}/schedules`
    const snapshot = await read(endpoint)
    assert.equal(snapshot.tasks.length, 1)
    assert.equal(snapshot.tasks[0].frequency, 'monthly')
    assert.equal(snapshot.tasks[0].month_day, 1)
    assert.equal(snapshot.tasks[0].time, '09:00')
    assert.equal(snapshot.tasks[0].timezone, 'Asia/Shanghai')
    assert.equal(snapshot.tasks[0].next_at, Date.parse(PREVIEW_CREATED_SCHEDULE.firstRun) / 1000)
    assert.equal(snapshot.tasks[0].prompt, PREVIEW_CREATED_SCHEDULE.schedule.prompt)
    assert.equal(snapshot.tasks[0].enabled, true)
    assert.equal(snapshot.runs.length, 0)
    const catalog = await read('/api/serve/sessions?scope=all')
    assert.equal(catalog.sessions.length, 1)
    const creation = catalog.sessions.find((session: {title: string}) => session.title.startsWith('创建定时任务'))
    assert.ok(creation)
    const history = await read('/api/serve/history/' + creation.session_id)
    assert.equal(new Set(history.turns.map((turn: {item_id: string}) => turn.item_id)).size, history.turns.length)
    const resolved = history.activity_events.find((event: {type: string}) => event.type === 'hil_resolved')
    assert.equal(resolved.data.state, 'resolved')
    assert.equal(Object.keys(resolved.data.answers).length, 3)
    const card = history.activity_events.find((event: {type: string}) => event.type === 'display_card')
    assert.equal(history.turn_activity.find((turn: {turn_id: string}) => turn.turn_id === card.turn_id)?.outcome, 'completed')
    assert.equal(snapshot.tasks[0].id, `card:${creation.session_id}:${card.data.card_id}`)
    assert.equal(card.data.content.prompt, snapshot.tasks[0].prompt)
    assert.ok(history.turns.some((turn: {text: string}) => turn.text === PREVIEW_CREATED_SCHEDULE_REPLY))
    const runResponse = await fetch(runtime.base + endpoint + '/' + encodeURIComponent(snapshot.tasks[0].id) + '/run', {
      method: 'POST', headers: { referer: runtime.base + '/?previewInstance=created' },
    })
    assert.equal(runResponse.status, 200)
    const afterRun = await read(endpoint)
    assert.equal(afterRun.runs.length, 1)
    assert.notEqual(creation.session_id, afterRun.runs[0].session_id)
    const conversation = await read(endpoint + '/' + encodeURIComponent(snapshot.tasks[0].id) + '/conversation')
    assert.equal(conversation.session_id, afterRun.runs[0].session_id)
    const groups = await read(endpoint + '/groups')
    assert.ok(!groups[0].sessionIds.includes(creation.session_id))
    const execution = await read('/api/serve/history/' + afterRun.runs[0].session_id)
    assert.equal(execution.turn_activity[0].outcome, 'completed')
  } finally { runtime.close() }
})

test('PDFE schedule mock keeps writes, runs and session anchors inside one instance', async () => {
  const runtime = await fixture('schedules-empty')
  const endpoint = '/api/serve/projects/' + PREVIEW_PROJECT_ID + '/schedules'
  const request = async (suffix = '', method = 'GET', body?: object, instance = 'first') => {
    const response = await fetch(runtime.base + endpoint + suffix, {
      method,
      headers: { referer: runtime.base + '/?previewInstance=' + instance, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })
    return { status: response.status, body: await response.json() }
  }
  const schedule = { name: 'PDFE plan', prompt: 'mock only', frequency: 'daily', time: '09:00', timezone: 'UTC', weekdays: [], month_day: 1,
    execution: { model_key: 'preview-model', reasoning_effort: 'medium', references: [
      { type: 'skill', id: 'mock-review', title: 'Mock review', path: '/mock/review' },
      { type: 'file', id: '/mock/paper.pdf', title: 'paper.pdf', path: '/mock/paper.pdf' },
    ], contexts: [{ kind: 'literature', source_id: 'mock-paper', label: 'Mock paper', origin: 'explicit' }] },
  }
  try {
    assert.deepEqual((await request()).body, { tasks: [], runs: [] })
    assert.equal((await request('/new', 'PUT', { schedule: {}, enabled: true })).status, 422)
    const created = await request('/new', 'PUT', { schedule, enabled: true })
    assert.equal(created.body.revision, 1)
    assert.deepEqual(created.body.execution, schedule.execution)
    assert.deepEqual((await request()).body.tasks[0].execution, schedule.execution)
    assert.equal((await request('/new', 'PUT', { schedule, enabled: false, revision: 2 })).status, 409)
    const edited = { ...schedule, execution: { ...schedule.execution, reasoning_effort: 'low', references: [], contexts: [] } }
    assert.equal((await request('/new', 'PUT', { schedule: edited, enabled: false, revision: 1 })).body.enabled, false)
    assert.deepEqual((await request()).body.tasks[0].execution, edited.execution)
    const first = await request('/new/conversation', 'POST')
    assert.equal(typeof first.body.session_id, 'string')
    assert.deepEqual((await request('/new/conversation', 'POST')).body, first.body)
    assert.deepEqual((await request('/new/conversation')).body.runs, [])
    const run = await request('/new/run', 'POST')
    assert.equal(run.status, 200)
    const saved = (await request('/new/conversation')).body
    assert.equal(saved.runs[0].id, run.body.run_id)
    assert.equal(saved.runs[0].status, 'completed')
    assert.notEqual(saved.runs[0].session_id, first.body.session_id)
    const projection = await runtime.request('/api/serve/status', 'first', {
      session_ids: [saved.runs[0].session_id, 'unavailable'], queued_ids: {},
    })
    assert.equal(projection.status, 200)
    const { sessions } = await projection.json()
    assert.deepEqual(sessions.map((session: { session_id: string }) => session.session_id), [saved.runs[0].session_id])
    assert.equal(sessions[0].running, false)
    assert.deepEqual((await request('', 'GET', undefined, 'second')).body, { tasks: [], runs: [] })
    assert.equal((await request('/new?revision=2', 'DELETE')).status, 200)
    assert.equal((await request('/new/conversation')).body.task, null)
    assert.equal((await request('/new/conversation')).body.runs.length, 1)
    await runtime.request('/__preview/reset', 'first', { pageId: 'page-schedules', scene: 'schedules-empty' })
    assert.deepEqual((await request()).body, { tasks: [], runs: [] })
  } finally { runtime.close() }
})

test('PDFE schedule sample covers every run status with isolated navigable conversations', async () => {
  const runtime = await fixture('schedules-sample')
  const endpoint = '/api/serve/projects/' + PREVIEW_PROJECT_ID + '/schedules'
  const read = async (path: string, instance = 'sample-first') => {
    const response = await fetch(runtime.base + path, {
      headers: { referer: runtime.base + '/?previewInstance=' + instance },
    })
    assert.equal(response.status, 200, path)
    return response.json()
  }
  try {
    const snapshot: ScheduleSnapshot = await read(endpoint)
    assert.equal(snapshot.tasks.length, 4)
    assert.equal(snapshot.tasks.filter(task => task.enabled).length, 3)
    assert.equal(snapshot.runs.length, 11)
    assert.deepEqual(await read(endpoint), snapshot)
    const main = snapshot.tasks.find(task => task.id === 'preview-schedule-literature')!
    assert.ok(main)
    const runs = snapshot.runs.filter(run => run.task_id === main.id)
    assert.equal(runs.length, 7)
    assert.deepEqual(new Set(runs.map(run => run.status)), new Set([
      'running', 'completed', 'failed', 'interrupted', 'missed',
    ]))
    const catalog = await read('/api/serve/sessions?scope=all')
    for (const run of snapshot.runs) {
      assert.ok(snapshot.tasks.some(task => task.id === run.task_id))
      assert.equal(run.finished_at === null, run.status === 'running')
      if (run.finished_at !== null) assert.ok(run.finished_at >= run.started_at)
      if (run.status === 'missed') {
        assert.equal(run.session_id, null)
        assert.ok(run.error)
        continue
      }
      assert.ok(run.session_id)
      const session = catalog.sessions.find((entry: { session_id: string }) => entry.session_id === run.session_id)
      assert.ok(session)
      assert.equal(session.last_turn_status, run.status)
      assert.equal(session.running, run.status === 'running')
      assert.equal(session.title, run.name)
      const history = await read('/api/serve/history/' + run.session_id)
      assert.ok(history.turns.some((turn: { role: string }) => turn.role === 'user'))
      assert.equal(history.turn_activity[0].outcome ?? null, run.status === 'running' ? null : run.status)
    }
    assert.equal(new Set(snapshot.runs.filter(run => run.session_id).map(run => run.session_id)).size, 10)
    const groups = await read(endpoint + '/groups')
    assert.equal(groups.length, 4)
    for (const task of snapshot.tasks) {
      const conversation = await read(endpoint + '/' + task.id + '/conversation')
      assert.ok(conversation.runs.some((run: { session_id: string }) => run.session_id === conversation.session_id))
      assert.equal(groups.find((group: { id: string }) => group.id === task.id).entrySessionId, conversation.session_id)
    }
    const other: ScheduleSnapshot = await read(endpoint, 'sample-second')
    assert.equal(other.tasks.length, 4)
    assert.equal(other.runs.length, 11)
    assert.ok(other.runs.every(run => !snapshot.runs.some(first => first.id === run.id || (run.session_id && first.session_id === run.session_id))))
    const reset = await runtime.request('/__preview/reset', 'sample-first', { pageId: 'page-schedules', scene: 'schedules-empty' })
    assert.equal(reset.status, 200)
    assert.deepEqual(await read(endpoint), { tasks: [], runs: [] })
    assert.deepEqual(await read(endpoint, 'sample-second'), other)
  } finally { runtime.close() }
})

test('PDFE schedule stop and deletion update only the affected execution', async () => {
  const runtime = await fixture('schedules-sample')
  const endpoint = '/api/serve/projects/' + PREVIEW_PROJECT_ID + '/schedules'
  const request = (path: string, method = 'GET') => fetch(runtime.base + path, {
    method, headers: { referer: runtime.base + '/?previewInstance=execution' },
  })
  try {
    const before: ScheduleSnapshot = await (await request(endpoint)).json()
    const running = before.runs.find(run => run.status === 'running')!
    const sessionPath = '/api/serve/sessions/' + running.session_id
    assert.equal((await request(sessionPath + '/interrupt', 'POST')).status, 200)
    const stopped: ScheduleSnapshot = await (await request(endpoint)).json()
    assert.equal(stopped.runs.find(run => run.id === running.id)?.status, 'interrupted')
    assert.equal((await request(sessionPath, 'DELETE')).status, 200)
    const after: ScheduleSnapshot = await (await request(endpoint)).json()
    assert.deepEqual(after.tasks, before.tasks)
    assert.deepEqual(after.runs, before.runs.filter(run => run.id !== running.id))
    const group = await (await request(endpoint + '/' + running.task_id + '/conversation')).json()
    assert.ok(group.runs.every((run: { id: string }) => run.id !== running.id))
  } finally { runtime.close() }
})

test('PDFE schedule reads recover only for the selected preview instance', async () => {
  const runtime = await fixture('schedules-load-failure')
  const endpoint = '/api/serve/projects/' + PREVIEW_PROJECT_ID + '/schedules'
  const read = (instance: string) => fetch(runtime.base + endpoint, {
    headers: { referer: runtime.base + '/?previewInstance=' + instance },
  })
  try {
    assert.equal((await read('first')).status, 503)
    assert.equal((await read('first')).status, 503)
    assert.equal((await runtime.request(PREVIEW_SCHEDULE_RECOVERY, 'first', {})).status, 200)
    const recovered = await read('first')
    assert.equal(recovered.status, 200)
    assert.deepEqual(await recovered.json(), { tasks: [], runs: [] })
    assert.equal((await read('second')).status, 503)
  } finally { runtime.close() }
})

test('PDFE discovery seeds three library papers with consistent admission status', async () => {
  const runtime = await fixture('paper-discovery-curated')
  try {
    assert.equal(PREVIEW_DISCOVERY_SAVED.length, 3)
    const response = await runtime.request(PREVIEW_DISCOVERY.resultStatusPath, 'first', {
      project_id: '', papers: PREVIEW_DISCOVERY_SAVED.map(paper => ({ id: paper.paper_id })),
    })
    assert.equal(response.status, 200)
    const status = await response.json()
    for (const paper of PREVIEW_DISCOVERY_SAVED) assert.equal(status.items[paper.paper_id].library, 'matched')
  } finally { runtime.close() }
})

test('PDFE discovery admits only bundled metadata and does not leak across instances', async () => {
  const runtime = await fixture('paper-discovery-curated')
  const paper = CURATED_PAPERS[0].metadata
  const status = async (instance: string) => {
    const response = await runtime.request(PREVIEW_DISCOVERY.resultStatusPath, instance, {
      project_id: '', papers: [{ id: paper.paper_id }],
    })
    assert.equal(response.status, 200)
    return (await response.json()).items[paper.paper_id].library
  }
  const admit = (contents: string) => {
    const body = new FormData()
    body.append('files', new File([contents], 'ai-search-results.bib', { type: 'application/x-bibtex' }))
    return fetch(runtime.base + PREVIEW_DISCOVERY.bibliographyPath, {
      method: 'POST', headers: { referer: runtime.base + '/?previewInstance=first' }, body,
    })
  }
  try {
    assert.equal(await status('first'), 'absent')
    assert.equal((await admit('not an approved curated entry')).status, 422)
    const response = await admit(searchPapersBibtex([paper]))
    assert.equal(response.status, 201)
    const receipt = await response.json()
    assert.equal(receipt.items[0].title, paper.title)
    assert.deepEqual(receipt.items[0].attachments, [])
    assert.equal(await status('first'), 'matched')
    assert.equal(await status('second'), 'absent')
  } finally { runtime.close() }
})

test('PDFE project search returns navigable scoped hits from the isolated sample', async () => {
  const runtime = await fixture(PREVIEW_PROJECT_SEARCH.scene)
  const otherScene = await fixture('resource-states')
  const search = (query: string, project = PREVIEW_PROJECT_ID, instance = 'first', base = runtime.base) => {
    const params = new URLSearchParams({ q: query, project })
    return fetch(base + PREVIEW_PROJECT_SEARCH.path + '?' + params, {
      headers: { referer: base + '/?previewInstance=' + instance },
    })
  }
  try {
    const files = await (await search('HELLO.PY')).json()
    assert.equal(files.groups.resource.total, 1)
    assert.equal(files.hits[0].id, 'hello.py')
    const papers = await (await search('可复现研究流程')).json()
    const other = await (await search('可复现研究流程', PREVIEW_PROJECT_ID, 'second')).json()
    assert.equal(papers.groups.literature.total, 1)
    assert.notEqual(papers.hits[0].id, other.hits[0].id)
    const sessions = await (await search(PREVIEW_PROJECT_SEARCH.keyword)).json()
    assert.equal(sessions.groups.session.total, 1)
    assert.equal(sessions.hits[0].locator.count, 2)
    assert.equal(typeof sessions.hits[0].locator.item_id, 'string')
    assert.deepEqual((await (await search('nothing-matches-this')).json()).hits, [])
    assert.equal((await search(PREVIEW_PROJECT_SEARCH.keyword, 'foreign-project')).status, 400)
    assert.equal((await search(PREVIEW_PROJECT_SEARCH.keyword, PREVIEW_PROJECT_ID, 'first', otherScene.base)).status, 501)
  } finally {
    runtime.close()
    otherScene.close()
  }
})
