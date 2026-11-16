import assert from 'node:assert/strict'
import test from 'node:test'
import { PreviewDiagnostics } from './diagnostics.ts'
import { PDFE_DIAGNOSTIC_BUDGET } from '../src/pdfe.ts'

const origin = 'http://preview.local'
const privateText = '/Users/private/credentials?token=secret'
const url = (path: string) => new URL(path, origin)

test('HTTP projection keeps only fixed routes, approved fields and generation-local aliases', () => {
  const ledger = new PreviewDiagnostics()
  const create = ledger.begin('POST', url('/api/content/projects?token=private'))
  create.request({ name: privateText, token: 'private' })
  create.match('/api/content/projects')
  create.response({ operation: 'private-operation', state: 'queued', result: { path: privateText } })
  create.finish(202, 'completed')
  const status = ledger.begin('GET', url('/api/content/operations/private-operation'))
  status.match('/api/content/operations/:operationId', { operation: 'private-operation' })
  status.response({ operation: 'private-operation', state: 'failed', error: 'preview_project_creation_failed' })
  status.finish(200, 'completed')
  const tree = ledger.begin('GET', url('/api/content/projects/private-id/tree?offset=100&path=private-path'))
  tree.match('/api/content/projects/:projectId/tree', { project: 'private-id' })
  tree.response({ nodes: [{ path: privateText }], root: privateText, total: 120 })
  tree.finish(200, 'completed')
  ledger.begin('GET', url('/api/unknown/private-id')).finish(null, 'aborted')
  const { requests } = ledger.snapshot()
  assert.deepEqual(requests.map(request => [request.path, request.status, request.outcome]), [
    ['/api/content/projects', 202, 'completed'],
    ['/api/content/operations/:operationId', 200, 'completed'],
    ['/api/content/projects/:projectId/tree', 200, 'completed'],
    ['(unmatched)', null, 'aborted'],
  ])
  assert.equal(requests[0].response.fields?.operation, requests[1].parameters.fields?.operation)
  assert.equal(requests[0].body.fields?.nameLength, privateText.length)
  assert.equal(requests[0].body.state, 'redacted')
  assert.equal(requests[1].response.fields?.state, 'failed')
  assert.equal(requests[2].parameters.fields?.offset, 100)
  assert.equal(requests[2].response.fields?.returned, 1)
  assert.equal(requests[3].response.state, 'omitted')
  assert.equal(JSON.stringify(requests).includes('private'), false)
  const other = new PreviewDiagnostics()
  const foreign = other.begin('GET', url('/api/content/operations/private-operation'))
  foreign.match('/api/content/operations/:operationId', { operation: 'private-operation' })
  foreign.finish(200, 'completed')
  assert.notEqual(other.snapshot().requests[0].parameters.fields?.operation, requests[1].parameters.fields?.operation)
})

test('project list keeps the opted-in Mock response, not raw query parameters', () => {
  const ledger = new PreviewDiagnostics()
  const list = ledger.begin('GET', url('/api/content/projects?includeArchived=true&token=secret'))
  list.match('/api/content/projects')
  const payload = { projects: [{ id: 'mock-project', name: 'Mock Project' }], workspaceRoot: '/preview', current: 'mock-project' }
  list.mockResponse(JSON.stringify(payload))
  list.finish(200, 'completed')
  const [record] = ledger.snapshot().requests
  assert.deepEqual(record.parameters, { state: 'redacted', fields: { includeArchived: 'true' } })
  assert.deepEqual(record.body, { state: 'empty' })
  assert.deepEqual(record.response, { state: 'available', json: payload })
  assert.doesNotMatch(JSON.stringify(record), /secret|private/)
})

test('oversized Mock responses leave a request record with explicit truncation', () => {
  const ledger = new PreviewDiagnostics()
  const list = ledger.begin('GET', url('/api/content/projects'))
  list.match('/api/content/projects')
  list.mockResponse(JSON.stringify({ projects: ['x'.repeat(PDFE_DIAGNOSTIC_BUDGET.fullRecordBytes)] }))
  list.finish(200, 'completed')
  assert.deepEqual(ledger.snapshot().requests[0].response, { state: 'truncated' })
  assert.equal(ledger.snapshot().dropped, 0)
})

test('route identity comes from the dispatcher, never the raw URL', () => {
  const ledger = new PreviewDiagnostics()
  const matched = ledger.begin('GET', url('/api/private-id?token=secret'))
  matched.match('/api/:projectId', { project: 'private-id' })
  matched.finish(200, 'completed')
  const rejected = ledger.begin('POST', url('/api/private-id'))
  rejected.match('/api/:projectId', { project: 'private-id' })
  rejected.unmatch()
  rejected.finish(501, 'completed')
  const { requests } = ledger.snapshot()
  assert.deepEqual(requests.map(record => record.path), ['/api/:projectId', '(unmatched)'])
  assert.equal(requests[1].parameters.state, 'empty')
  assert.doesNotMatch(JSON.stringify(requests), /private-id|secret/)
})

test('attention exposes its complete empty Mock response shape without the raw epoch', () => {
  const ledger = new PreviewDiagnostics()
  const payload = { epoch: 'private-instance', revision: 0, unread_count: 0, by_session: {}, items: [] }
  for (const value of [payload, { ...payload, items: [{ title: privateText }] }]) {
    const request = ledger.begin('GET', url('/api/serve/attention'))
    request.match('/api/serve/attention')
    request.response(value)
    request.finish(200, 'completed')
  }
  const [safe, omitted] = ledger.snapshot().requests
  assert.deepEqual(safe.response, {
    state: 'redacted',
    json: { ...payload, epoch: (safe.response.json as { epoch: string }).epoch },
  })
  assert.match((safe.response.json as { epoch: string }).epoch, /^epoch-[a-f0-9]+$/)
  assert.deepEqual(omitted.response, { state: 'omitted' })
})

test('bounded ledger returns copies and tracks eviction', () => {
  const ledger = new PreviewDiagnostics()
  for (let index = 0; index < PDFE_DIAGNOSTIC_BUDGET.records + 2; index++) {
    ledger.begin('GET', url('/api/account/credits')).finish(200, 'completed')
  }
  const snapshot = ledger.snapshot()
  assert.ok(snapshot.requests.length <= PDFE_DIAGNOSTIC_BUDGET.records)
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < PDFE_DIAGNOSTIC_BUDGET.bytes)
  assert.ok(snapshot.dropped >= 2)
  snapshot.requests[0].status = 500
  assert.equal(ledger.snapshot().requests[0].status, 200)
})

test('streams distinguish written events, heartbeats, interruption and cursor-linked reconnects', () => {
  const ledger = new PreviewDiagnostics()
  const first = ledger.open('session', 'private-session', 0)
  first.written('message_delta', 2)
  first.written('heartbeat')
  first.close('interrupted', true)
  const second = ledger.open('session', 'private-session', 1)
  second.written('turn_completed', 3)
  second.close('closed')
  const unrelated = ledger.open('session', 'private-session', 2)
  unrelated.close('closed')
  const snapshot = ledger.snapshot()
  assert.deepEqual(snapshot.streams.map(record => record.phase), ['open', 'write', 'interrupted', 'open', 'write', 'closed', 'open', 'closed'])
  assert.equal(snapshot.streams[2].heartbeats, 1)
  assert.equal(snapshot.streams[3].reconnectOf, snapshot.streams[0].connection)
  assert.equal(snapshot.streams[6].reconnectOf, undefined)
  assert.equal(snapshot.streams[4].eventSequence, 3)
  assert.equal(JSON.stringify(snapshot).includes('private'), false)
})

test('client disconnect and overlapping subscriptions do not imply reconnect', () => {
  const ledger = new PreviewDiagnostics()
  const cancelled = ledger.open('session', 'session', 0)
  cancelled.written('message_delta', 1)
  cancelled.close('interrupted')
  const parallel = ledger.open('session', 'session', 1)
  const fault = ledger.open('session', 'session', 1)
  fault.written('message_delta', 2)
  fault.close('interrupted', true)
  ledger.open('session', 'session', 2)
  parallel.close('closed')
  assert.ok(ledger.snapshot().streams.every(record => record.reconnectOf === undefined))
})
