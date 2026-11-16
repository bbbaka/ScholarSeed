import assert from 'node:assert/strict'
import { test } from 'node:test'
import { revisionSnapshot } from './revisions.ts'

const turns = [
  { kind: 'user', text: 'first', turn_id: 'one', item_id: 'user-one' },
  { kind: 'text', text: 'answer', turn_id: 'one', item_id: 'answer-one' },
  { kind: 'user', text: 'middle', turn_id: 'two', item_id: 'user-two' },
  { kind: 'text', text: 'later answer', turn_id: 'two', item_id: 'answer-two' },
  { kind: 'user', text: 'latest', turn_id: 'three', item_id: 'user-three' },
]

test('revision snapshots only history before the selected message', () => {
  const snapshot = revisionSnapshot(turns, 'two', 'user-two')
  assert.deepEqual(snapshot, turns.slice(0, 2))
  snapshot[0].text = 'changed in child'
  assert.equal(turns[0].text, 'first')
  assert.equal(revisionSnapshot(turns, 'three', 'user-three').length, 4)
})

test('first turn, assistant messages, stale anchors and steer messages cannot be edited', () => {
  for (const [turnId, itemId] of [['one', 'user-one'], ['one', 'answer-one'], ['two', 'missing']]) {
    assert.throws(() => revisionSnapshot(turns, turnId, itemId))
  }
  assert.throws(() => revisionSnapshot([
    ...turns, { kind: 'user', origin: 'steer', turn_id: 'three', item_id: 'steer' },
  ], 'three', 'steer'))
})
