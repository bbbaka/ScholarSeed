import assert from 'node:assert/strict'
import test from 'node:test'
import { groupSessions, unrepresentedGroups } from './grouping.ts'
import type { ServeSession } from '../../api'

test('archiving all executions retains live plan navigation without fabricating a session', () => {
  const groups = [
    {
      id: 'live',
      title: 'Plan',
      entrySessionId: 'archived',
      sessionIds: ['archived'],
      open: async () => 'new',
    },
    { id: 'deleted', title: 'Deleted plan', entrySessionId: 'removed', sessionIds: ['removed'] },
  ]
  assert.deepEqual(
    unrepresentedGroups([], groups).map((group) => group.id),
    ['live']
  )
  const visible = groupSessions(
    [{ session_id: 'archived', title: 'Run' } as ServeSession],
    groups,
    null
  )
  assert.equal(unrepresentedGroups(visible, groups).length, 0)
  assert.equal(visible[0].title, 'Plan')
})

test('one navigation entry per group preserves selected batch and unrelated conversations', () => {
  const rows = ['new', 'regular', 'old'].map(
    (session_id) => ({ session_id, title: session_id }) as ServeSession
  )
  const groups = [
    {
      id: 'task',
      title: 'Scheduled research',
      entrySessionId: 'new',
      sessionIds: ['new', 'old'],
      icon: 'clock',
    },
  ]
  assert.deepEqual(
    groupSessions(rows, groups, null).map((row) => row.session_id),
    ['new', 'regular']
  )
  const selected = groupSessions(rows, groups, 'old')
  assert.deepEqual(
    selected.map((row) => row.session_id),
    ['old', 'regular']
  )
  assert.equal(selected[0].title, 'Scheduled research')
  assert.equal(selected[0].navigationGroup, 'task')
  assert.equal(selected[0].navigationIcon, 'clock')
  assert.equal(selected[1].navigationIcon, undefined)
  assert.equal(rows.length, 3)
  assert.equal(groupSessions(rows.slice(1), groups, null)[1].session_id, 'old')
})

test('equal task names never merge distinct identities or ordinary conversations', () => {
  const rows = ['first', 'second', 'ordinary'].map(
    (session_id) => ({ session_id, title: 'Same name' }) as ServeSession
  )
  const groups = ['first', 'second'].map((id) => ({
    id,
    title: 'Same name',
    entrySessionId: id,
    sessionIds: [id],
  }))
  assert.equal(groupSessions(rows, groups, null).length, 3)
  assert.equal(groupSessions(rows, groups, null)[2].navigationGroup, undefined)
})
