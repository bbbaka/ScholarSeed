import assert from 'node:assert/strict'
import test from 'node:test'
import { createPreviewDiagnosticAccess } from './access.ts'

test('diagnostic capabilities are isolated by instance and can be revoked or replaced', () => {
  const access = createPreviewDiagnosticAccess()
  const first = access.grant('first')
  const second = access.grant('second')
  assert.notEqual(first.secret, second.secret)
  assert.equal(access.authorize('first', first.secret), true)
  assert.equal(access.authorize('second', first.secret), false)
  assert.equal(access.authorize('first', undefined), false)
  assert.equal(access.authorize('first', [first.secret]), false)
  assert.equal(access.authorize('unknown', first.secret), false)
  const replacement = access.grant('first')
  first.revoke()
  assert.equal(access.authorize('first', first.secret), false)
  assert.equal(access.authorize('first', replacement.secret), true)
  replacement.revoke()
  assert.equal(access.authorize('first', replacement.secret), false)
  assert.equal(access.authorize('second', second.secret), true)
})
