import assert from 'node:assert/strict'
import test from 'node:test'

import { editableForkAnchors, forkBoundaryIndex, parseForkOrigin } from './fork.ts'
import type { ActivityRow } from '../../activity.ts'
import type { ConvItem } from '../../model.ts'

const inherited = [{ turn_id: 'inherited', item_id: 'answer' }]

test('edit anchors target the immediately preceding completed turn, never the edited turn', () => {
  const first = { kind: 'user', text: 'first', turnId: 'one', itemId: 'prompt-one' } as const
  const second = { kind: 'user', text: 'second', turnId: 'two', itemId: 'prompt-two' } as const
  const third = { kind: 'user', text: 'third', turnId: 'three', itemId: 'prompt-three' } as const
  const conversation: ConvItem[] = [
    first,
    { kind: 'agent', text: 'answer one', turnId: 'one' },
    second,
    { kind: 'agent', text: 'answer two', turnId: 'two' },
    third,
  ]
  assert.deepEqual(
    [...editableForkAnchors(conversation, { one: 'completed', two: 'failed', three: 'completed' })],
    [['prompt-two', 'one']]
  )
  assert.deepEqual(
    [
      ...editableForkAnchors(conversation, {
        one: 'completed',
        two: 'completed',
        three: 'completed',
      }),
    ],
    [
      ['prompt-two', 'one'],
      ['prompt-three', 'two'],
    ]
  )
  assert.deepEqual([...editableForkAnchors([first], { one: 'completed' })], [])
  assert.equal(
    editableForkAnchors(
      [first, { ...second, refs: [{ type: 'file', id: 'file', title: 'File' }] }],
      { one: 'completed', two: 'completed' }
    ).size,
    0
  )
})

test('fork boundary stays after inherited rows including grouped artifacts', () => {
  const rows: ActivityRow[] = [
    {
      kind: 'item',
      key: 'answer',
      item: { kind: 'agent', text: 'answer', turnId: 'inherited', itemId: 'answer' },
    },
    { kind: 'artifacts', key: 'files', turnId: 'inherited', items: [] },
    { kind: 'item', key: 'new', item: { kind: 'user', text: 'new', itemId: 'new' } },
  ]
  assert.equal(forkBoundaryIndex(rows, inherited), 2)
  assert.equal(forkBoundaryIndex(rows.slice(0, 2), inherited), 2)
  assert.equal(forkBoundaryIndex(rows, []), 0)
  assert.equal(forkBoundaryIndex(rows, [{ turn_id: '', item_id: 'new' }]), 3)
})

test('origin parsing rejects false available targets and malformed boundaries', () => {
  const origin = {
    source_session_id: 'actual-child',
    source_product_seq: 12,
    source_turn_id: null,
    inherited_messages: inherited,
    anchor: inherited[0],
    status: 'deleted',
    title: null,
    title_fallback: null,
    navigation: null,
  }
  assert.deepEqual(parseForkOrigin(origin), origin)
  assert.throws(() => parseForkOrigin({ ...origin, status: 'available' }))
  assert.throws(() => parseForkOrigin({ ...origin, inherited_messages: [{ item_id: 1 }] }))
  assert.throws(() => parseForkOrigin({ ...origin, status: 'unknown' }))
  assert.equal(parseForkOrigin(null), null)
})
