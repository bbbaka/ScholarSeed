import assert from 'node:assert/strict'
import test from 'node:test'
import { findOccurrences, nextOccurrence } from './find.ts'

test('conversation search treats queries literally and matches all occurrences', () => {
  assert.deepEqual(findOccurrences('A.b a.B aXb', 'a.b'), [
    { start: 0, end: 3 },
    { start: 4, end: 7 },
  ])
  assert.deepEqual(findOccurrences('研究🙂研究', '研究'), [
    { start: 0, end: 2 },
    { start: 4, end: 6 },
  ])
  assert.deepEqual(findOccurrences('研究🙂研究', '🙂'), [{ start: 2, end: 4 }])
  assert.deepEqual(findOccurrences('x [a] x', '[a]'), [{ start: 2, end: 5 }])
  assert.deepEqual(findOccurrences('abc', ''), [])
  assert.deepEqual(findOccurrences('abc', 'missing'), [])
})

test('navigation wraps and handles empty results', () => {
  assert.equal(nextOccurrence(2, 1, 3), 0)
  assert.equal(nextOccurrence(0, -1, 3), 2)
  assert.equal(nextOccurrence(0, 1, 0), 0)
})
