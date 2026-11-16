import assert from 'node:assert/strict'
import test from 'node:test'
import { searchShortcut } from './keyboard.ts'

const key = {
  key: 'f',
  metaKey: true,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  repeat: false,
  isComposing: false,
  defaultPrevented: false,
}

test('search shortcuts use the platform primary modifier', () => {
  assert.equal(searchShortcut(key, 'mac'), 'conversation')
  assert.equal(searchShortcut({ ...key, key: 'k' }, 'mac'), 'project')
  assert.equal(searchShortcut({ ...key, metaKey: false, ctrlKey: true }, 'windows'), 'conversation')
  assert.equal(
    searchShortcut({ ...key, key: 'K', metaKey: false, ctrlKey: true }, 'windows'),
    'project'
  )
  assert.equal(searchShortcut(key, 'windows'), null)
  assert.equal(searchShortcut({ ...key, metaKey: false, ctrlKey: true }, 'mac'), null)
})

test('search ignores composition, repeats, consumed events and extra modifiers', () => {
  for (const property of [
    'isComposing',
    'repeat',
    'defaultPrevented',
    'altKey',
    'shiftKey',
    'ctrlKey',
  ]) {
    assert.equal(searchShortcut({ ...key, [property]: true }, 'mac'), null)
  }
  assert.equal(searchShortcut({ ...key, keyCode: 229 }, 'mac'), null)
  assert.equal(searchShortcut({ ...key, key: 'a' }, 'mac'), null)
})
