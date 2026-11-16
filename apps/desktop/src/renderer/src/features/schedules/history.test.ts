import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ALL_FILTER,
  filterRuns,
  historyTasks,
  newestTasks,
  runActions,
  runSeconds,
  previewRuns,
  runDate,
  projectRuns,
  archivableRuns,
  RUN_STATUSES,
  runStatus,
  remainingSession,
  replacementSession,
} from './history.ts'
import type { ScheduledRun } from './model.ts'

test('scheduled tasks sort newest first without mutating the snapshot or reordering ties', () => {
  const tasks = [
    { id: 'old', created_at: 10, revision: 9 },
    { id: 'new', created_at: 30, revision: 1 },
    { id: 'same-time', created_at: 30, revision: 2 },
    { id: 'middle', created_at: 20, revision: 3 },
  ]
  assert.deepEqual(
    newestTasks(tasks).map((task) => task.id),
    ['new', 'same-time', 'middle', 'old']
  )
  assert.deepEqual(
    tasks.map((task) => task.id),
    ['old', 'new', 'same-time', 'middle']
  )
  assert.deepEqual(
    newestTasks(tasks.filter((task) => task.id !== 'new')).map((task) => task.id),
    ['same-time', 'middle', 'old']
  )
  assert.deepEqual(newestTasks([]), [])
})

test('batch lifecycle projects canonical names, archive state and deletion without changing the plan', () => {
  const runs = ['active', 'archived', 'deleted', 'busy'].map((id) => ({
    ...completed,
    id,
    session_id: id,
  }))
  const projected = projectRuns(runs, [
    { session_id: 'active', title: 'Renamed batch' },
    { session_id: 'archived', title: completed.name, archived: true },
    { session_id: 'busy', title: completed.name, running: true },
  ])
  assert.deepEqual(
    projected.map((run) => run.id),
    ['active', 'archived', 'busy']
  )
  assert.equal(projected[0].title, 'Renamed batch')
  assert.equal(projected[0].name, completed.name)
  assert.equal(projected[1].title, undefined)
  assert.deepEqual(
    archivableRuns(projected).map((run) => run.id),
    ['active', 'busy']
  )
  assert.deepEqual(
    filterRuns(projected, ALL_FILTER, ALL_FILTER).map((run) => run.id),
    ['active', 'busy']
  )
  assert.deepEqual(projectRuns([{ ...completed, session_id: null }], []).length, 1)
})

const completed: ScheduledRun = {
  id: 'run-one',
  task_id: 'task-one',
  name: 'Same name',
  status: 'completed',
  started_at: 100,
  finished_at: 163,
  session_id: 'session-one',
  error: null,
}
const failed: ScheduledRun = { ...completed, id: 'run-two', task_id: 'task-two', status: 'failed' }

test('empty entry yields to an available execution without replacing a selected real batch', () => {
  assert.equal(replacementSession([completed], 'empty', 'empty'), completed.session_id)
  assert.equal(replacementSession([], 'empty', 'empty'), null)
  assert.equal(replacementSession([{ ...completed, archived: true }], 'empty', 'empty'), null)
  assert.equal(replacementSession([completed], completed.session_id, 'empty'), null)
  assert.equal(replacementSession([completed], completed.session_id, completed.session_id), null)
  assert.equal(replacementSession([completed], 'unrelated', 'empty'), null)
  assert.equal(replacementSession([completed], null, null), null)
})

test('removing executions selects a remaining live batch or leaves the conversation', () => {
  const runs = [completed, { ...completed, id: 'old', session_id: 'old', archived: true }]
  assert.equal(remainingSession(runs, []), completed.session_id)
  assert.equal(remainingSession(runs, [completed.session_id!]), null)
  assert.equal(remainingSession([], []), null)
  assert.equal(remainingSession([{ ...completed, session_id: null }], []), null)
})

test('all archived or deleted batches leave no destination until restored or executed again', () => {
  const runs = [completed, { ...completed, id: 'older', session_id: 'older' }]
  const archived = projectRuns(
    runs,
    runs.map((run) => ({ session_id: run.session_id!, title: run.name, archived: true }))
  )
  assert.equal(remainingSession(archived, []), null)
  assert.deepEqual(filterRuns(archived, ALL_FILTER, ALL_FILTER), [])
  const restored = projectRuns(runs, [{ session_id: 'older', title: completed.name }])
  assert.equal(remainingSession(restored, []), 'older')
  assert.equal(remainingSession(restored, ['older']), null)
  assert.deepEqual(projectRuns(runs, []), [])
  const next = { ...completed, id: 'new-run', session_id: 'new-session' }
  assert.equal(
    remainingSession(
      projectRuns([next, ...runs], [{ session_id: next.session_id, title: next.name }]),
      []
    ),
    next.session_id
  )
  assert.equal(runs[0], completed)
})

test('history preview keeps four records and retains an older selected batch', () => {
  const runs = Array.from({ length: 8 }, (_, index) => ({
    ...completed,
    id: `run-${index}`,
    session_id: `session-${index}`,
  }))
  assert.deepEqual(previewRuns(runs, null, false), runs.slice(0, 4))
  assert.deepEqual(previewRuns(runs, 'session-7', false), [...runs.slice(0, 3), runs[7]])
  assert.deepEqual(previewRuns(runs, 'session-7', true), runs)
  assert.deepEqual(previewRuns([], null, false), [])
  assert.equal(runs.length, 8)
  const missed = [...runs.slice(0, 7), { ...runs[7], session_id: null }]
  assert.deepEqual(previewRuns(missed, null, false), missed.slice(0, 4))
})

test('batch labels have minute precision without merging runs in the same minute', () => {
  const timestamp = Date.UTC(2026, 10, 9, 2, 23, 4) / 1000
  assert.equal(runDate(timestamp, 'zh-CN', 'Asia/Shanghai'), '2026/11/09 10:23')
  assert.equal(
    runDate(timestamp, 'zh-CN', 'Asia/Shanghai'),
    runDate(timestamp + 20, 'zh-CN', 'Asia/Shanghai')
  )
  assert.equal(previewRuns([completed, failed], null, false).length, 2)
})

test('history exposes only retry and stop actions without separate view actions', () => {
  assert.deepEqual(runActions(completed, true), [])
  assert.deepEqual(runActions(failed, true), ['retryRun'])
  assert.deepEqual(runActions({ ...completed, status: 'interrupted' }, true), ['retryRun'])
  assert.deepEqual(runActions({ ...completed, status: 'running' }, true), ['stopRun'])
  assert.deepEqual(runActions({ ...completed, status: 'missed', session_id: null }, true), [
    'retryRun',
  ])
  assert.deepEqual(runActions(failed, false), [])
  assert.deepEqual(runActions({ ...failed, session_id: null }, true), ['retryRun'])
  assert.deepEqual(runActions({ ...failed, session_id: null }, false), [])
  assert.deepEqual(runActions({ ...completed, status: 'missed' }, false), [])
})

test('history filters intersect stable task identity and status without changing order', () => {
  const runs = [completed, failed]
  assert.deepEqual(filterRuns(runs, ALL_FILTER, ALL_FILTER), runs)
  assert.deepEqual(filterRuns(runs, 'task-one', ALL_FILTER), [completed])
  assert.deepEqual(filterRuns(runs, ALL_FILTER, 'failed'), [failed])
  assert.deepEqual(filterRuns(runs, 'task-one', 'failed'), [])
  for (const status of ['running', 'completed', 'failed', 'interrupted'] as const) {
    const run = { ...completed, status }
    assert.deepEqual(filterRuns([run], ALL_FILTER, status), [run])
  }
})

test('history separates interrupted executions while missed executions remain failures', () => {
  assert.deepEqual(RUN_STATUSES, ['completed', 'failed', 'running', 'interrupted'])
  const interrupted = { ...completed, status: 'interrupted' } as const
  const missed = { ...completed, status: 'missed' } as const
  assert.equal(runStatus(interrupted), 'interrupted')
  assert.equal(runStatus(missed), 'failed')
  assert.deepEqual(filterRuns([completed, failed, interrupted, missed], ALL_FILTER, 'failed'), [
    failed,
    missed,
  ])
  assert.deepEqual(
    filterRuns([completed, failed, interrupted, missed], ALL_FILTER, 'interrupted'),
    [interrupted]
  )
  assert.equal(interrupted.status, 'interrupted')
})

test('task choices retain deleted tasks and use current names for renamed tasks', () => {
  assert.deepEqual(
    historyTasks([{ id: 'task-one', name: 'Renamed' }], [completed, failed, completed]),
    [
      { id: 'task-one', name: 'Renamed' },
      { id: 'task-two', name: 'Same name' },
    ]
  )
})

test('duration uses recorded seconds, keeps zero, and does not invent a terminal timestamp', () => {
  assert.equal(runSeconds(completed, 200), 63)
  assert.equal(runSeconds({ ...completed, finished_at: 100 }, 200), 0)
  assert.equal(runSeconds({ ...completed, finished_at: null }, 200), null)
  assert.equal(runSeconds({ ...completed, status: 'running', finished_at: null }, 200.9), 100)
  assert.equal(runSeconds({ ...completed, finished_at: 99 }, 200), 0)
})
