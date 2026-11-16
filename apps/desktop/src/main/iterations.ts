import { createHash } from 'node:crypto'
import { isAbsolute } from 'node:path'
import { TextDecoder } from 'node:util'
import type { DomainNative } from '../../native/domains.cjs'
import {
  PDFE_ITERATION_FILENAME,
  PDFE_ITERATION_LIMIT,
  applyPdfeIterationEdit,
  PdfeIterationEditError,
  readPdfeIterations,
  type PdfeIterationManifest,
  type PdfeIterationSaveResult,
  type PdfeIterationSnapshot,
} from '../iterations.ts'

type IterationNative = Pick<DomainNative, 'pin' | 'lineage' | 'readAt' | 'release'> & {
  replaceProjectAt?: (pin: unknown, name: string, expected: Buffer, next: Buffer) => void
}
const UTF8 = new TextDecoder('utf-8', { fatal: true })
const REVISION = /^[a-f0-9]{64}$/

export function bindPdfeIterationReader(
  native: IterationNative,
  root: string,
  validate?: (manifest: PdfeIterationManifest) => void
) {
  if (!isAbsolute(root)) throw new Error('Invalid PDFE iteration worktree')
  const anchor = native.pin(root, false, 'project')
  try {
    const expected = native.lineage(anchor)
    if (!expected.length) throw new Error('Invalid PDFE iteration worktree identity')
    const assertBound = (pin: unknown): void => {
      const observed = native.lineage(pin)
      if (
        observed.length !== expected.length ||
        observed.some((identity, index) => identity !== expected[index])
      )
        throw new Error('PDFE iteration worktree changed')
    }
    let closed = false
    const withPin = <Result>(use: (pin: unknown) => Result): Result => {
      if (closed) throw new Error('PDFE iteration reader is closed')
      const pin = native.pin(root, false, 'project')
      try {
        assertBound(pin)
        return use(pin)
      } finally {
        native.release(pin)
      }
    }
    const bytesAt = (pin: unknown): Buffer => {
      const bytes = native.readAt(pin, PDFE_ITERATION_FILENAME, PDFE_ITERATION_LIMIT.bytes)
      if (bytes === null) throw new Error('PDFE iteration file is missing')
      return bytes
    }
    const snapshotOf = (bytes: Buffer): PdfeIterationSnapshot => {
      const manifest = readPdfeIterations(UTF8.decode(bytes))
      validate?.(manifest)
      return { revision: createHash('sha256').update(bytes).digest('hex'), manifest }
    }
    return {
      writable: typeof native.replaceProjectAt === 'function',
      read(): PdfeIterationSnapshot {
        return withPin((pin) => {
          const snapshot = snapshotOf(bytesAt(pin))
          withPin(() => undefined)
          return snapshot
        })
      },
      save(revision: unknown, edit: unknown): PdfeIterationSaveResult {
        if (!native.replaceProjectAt) return { status: 'unavailable' }
        if (typeof revision !== 'string' || !REVISION.test(revision))
          return { status: 'invalid', code: 'invalid-edit' }
        let published = false
        try {
          return withPin((pin) => {
            const previous = bytesAt(pin)
            if (createHash('sha256').update(previous).digest('hex') !== revision)
              return { status: 'conflict' }
            snapshotOf(previous)
            const next = Buffer.from(applyPdfeIterationEdit(UTF8.decode(previous), edit), 'utf8')
            if (next.length > PDFE_ITERATION_LIMIT.bytes)
              return { status: 'invalid', code: 'invalid-edit' }
            native.replaceProjectAt!(pin, PDFE_ITERATION_FILENAME, previous, next)
            published = true
            const verified = bytesAt(pin)
            if (!verified.equals(next)) return { status: 'unknown' }
            const snapshot = snapshotOf(verified)
            withPin(() => undefined)
            return { status: 'saved', snapshot }
          })
        } catch (error) {
          const code = (error as { code?: string })?.code
          if (published || code === 'ERR_LEASE_RESULT_UNKNOWN') return { status: 'unknown' }
          if (error instanceof PdfeIterationEditError)
            return { status: 'invalid', code: error.code }
          if (code === 'ERR_LEASE_CHANGED' || code === 'ERR_LEASE_BUSY')
            return { status: 'conflict' }
          return { status: 'unavailable' }
        }
      },
      close(): void {
        if (closed) return
        closed = true
        native.release(anchor)
      },
    }
  } catch (error) {
    native.release(anchor)
    throw error
  }
}
