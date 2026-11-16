import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { applyPdfeIterationEdit, readPdfeIterations } from './iterations.ts'
import { bindPdfeIterationReader } from './main/iterations.ts'

const checkedIn = new URL('../../../PDFE-iterations.json', import.meta.url)

function candidate() {
  return {
    current: '0.4',
    iterations: [
      { version: '0.3', status: 'released' },
      { version: '0.4', status: 'prototype', description: '当前原型开发' },
      { version: '0.10', status: 'prototype' },
    ],
    baseline: { version: '0.3', scenes: { 'page-home': ['home-browse'] } },
    features: {
      'project-browse': {
        introducedIn: '0.3',
        changes: [{ version: '0.4', summary: '新的项目入口' }],
      },
    },
  }
}

test('PDFE iteration document validates the current checkout and preserves descriptions and numeric order', () => {
  const current = readPdfeIterations(readFileSync(checkedIn, 'utf8'))
  assert.equal(current.current, '0.4')
  assert.equal(current.baseline.version, '0.3')
  const manifest = readPdfeIterations(JSON.stringify(candidate()))
  assert.deepEqual(
    manifest.iterations.map((entry) => entry.version),
    ['0.10', '0.4', '0.3']
  )
  assert.equal(manifest.iterations[1].description, '当前原型开发')
  assert.equal(manifest.features['project-browse'].changes[0].summary, '新的项目入口')
})

test('invalid shape, version identity, released baseline and feature references fail closed', () => {
  const manifest = candidate()
  for (const value of [
    null,
    { ...manifest, iterations: [null] },
    { ...manifest, current: '99.99' },
    {
      ...manifest,
      iterations: [...manifest.iterations, { version: '0.4.0', status: 'prototype' }],
    },
    { ...manifest, iterations: [...manifest.iterations, { version: '00.5', status: 'prototype' }] },
    {
      ...manifest,
      iterations: [
        ...manifest.iterations,
        { version: '0.5', status: 'prototype', description: {} },
      ],
    },
    { ...manifest, baseline: { ...manifest.baseline, version: '0.4' } },
    {
      ...manifest,
      baseline: { version: '0.3', scenes: { 'page-home': ['home-browse', 'home-browse'] } },
    },
    {
      ...manifest,
      features: {
        'project-browse': { introducedIn: '0.4', changes: [{ version: '0.3', summary: '更早' }] },
      },
    },
    { ...manifest, features: { 'project-browse': { introducedIn: '9.0', changes: [] } } },
  ]) {
    assert.throws(() => readPdfeIterations(JSON.stringify(value)), /Invalid PDFE iteration/)
  }
  assert.throws(() => readPdfeIterations('{invalid'), /Invalid PDFE iteration/)
})

test('structured iteration edits preserve unknown fields and allow the complete safe lifecycle', () => {
  const source = JSON.stringify({ ...candidate(), annotation: { owner: 'kept' } })
  const created = applyPdfeIterationEdit(source, {
    kind: 'create',
    version: '0.11',
    description: '下一轮',
  })
  assert.deepEqual(JSON.parse(created).annotation, { owner: 'kept' })
  assert.equal(readPdfeIterations(created).iterations[0].status, 'prototype')
  const described = applyPdfeIterationEdit(created, {
    kind: 'edit',
    version: '0.11',
    description: '新描述',
  })
  assert.equal(readPdfeIterations(described).iterations[0].description, '新描述')
  const selected = applyPdfeIterationEdit(described, { kind: 'select', version: '0.11' })
  assert.equal(readPdfeIterations(selected).current, '0.11')
  const released = applyPdfeIterationEdit(selected, {
    kind: 'edit',
    version: '0.11',
    status: 'released',
    confirmRelease: true,
  })
  assert.equal(readPdfeIterations(released).iterations[0].status, 'released')
  const deleted = applyPdfeIterationEdit(released, { kind: 'delete', version: '0.10' })
  assert.ok(!readPdfeIterations(deleted).iterations.some((entry) => entry.version === '0.10'))
})

test('iteration maintenance rejects direct or indirect deletion and unauthorized edits', () => {
  const source = JSON.stringify({
    ...candidate(),
    current: '0.10',
    iterations: [...candidate().iterations, { version: '0.2', status: 'released' }],
  })
  for (const [version, code] of [
    ['0.3', 'baseline'],
    ['0.2', 'released'],
    ['0.10', 'current'],
    ['0.4', 'referenced'],
  ]) {
    assert.throws(() => applyPdfeIterationEdit(source, { kind: 'delete', version }), {
      message: code,
    })
  }
  assert.throws(
    () => applyPdfeIterationEdit(source, { kind: 'edit', version: '0.4', status: 'released' }),
    { message: 'confirm-release' }
  )
  assert.throws(
    () => applyPdfeIterationEdit(source, { kind: 'edit', version: '0.3', status: 'prototype' }),
    { message: 'downgrade' }
  )
  assert.throws(
    () => applyPdfeIterationEdit(source, { kind: 'edit', version: '0.4', path: '/outside' }),
    { message: 'invalid-edit' }
  )
  assert.throws(() => applyPdfeIterationEdit(source, { kind: 'create', version: '0.4.0' }), {
    message: 'duplicate',
  })
  assert.throws(() => applyPdfeIterationEdit(source, { kind: 'select', version: '1.0' }), {
    message: 'unknown-version',
  })
})

test('iteration host distinguishes a known pre-publication conflict from uncertain publication and readback', () => {
  const original = Buffer.from(JSON.stringify(candidate()))
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  for (const [failure, status, persisted] of [
    ['ERR_LEASE_CHANGED', 'conflict', false],
    ['ERR_LEASE_RESULT_UNKNOWN', 'unknown', true],
    ['readback-failed', 'unknown', true],
    ['readback-different', 'unknown', true],
  ] as const) {
    let bytes: Buffer = original
    let published = false
    const reader = bindPdfeIterationReader(
      {
        pin: () => Symbol(),
        lineage: () => ['bound-worktree'],
        release: () => undefined,
        readAt: () => {
          if (published && failure === 'readback-failed') throw new Error(failure)
          return bytes
        },
        replaceProjectAt: (_pin, _name, expected, next) => {
          assert.deepEqual(expected, original)
          if (failure === 'ERR_LEASE_CHANGED')
            throw Object.assign(new Error(failure), { code: failure })
          published = true
          bytes = failure === 'readback-different' ? Buffer.from('external') : next
          if (failure === 'ERR_LEASE_RESULT_UNKNOWN')
            throw Object.assign(new Error(failure), { code: failure })
        },
      },
      root
    )
    try {
      const { revision } = reader.read()
      assert.deepEqual(reader.save(revision, { kind: 'create', version: '0.11' }), { status })
      assert.equal(published, persisted)
    } finally {
      reader.close()
    }
  }
})
