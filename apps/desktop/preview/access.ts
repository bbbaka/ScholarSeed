import { randomBytes, timingSafeEqual } from 'node:crypto'
import { PREVIEW_INSTANCE_PATTERN } from './constants.ts'

const SECRET_BYTES = 32
const SECRET_ENCODING = 'base64url'
const SECRET_PATTERN = /^[a-zA-Z0-9_-]{43}$/

export const PREVIEW_DIAGNOSTIC_ACCESS_PLUGIN = 'scholarseed-preview-diagnostic-access'
export type PreviewDiagnosticAuthorize = (instance: string, secret: unknown) => boolean

export function createPreviewDiagnosticAccess() {
  const grants = new Map<string, Buffer>()
  return {
    grant(instance: string) {
      if (!PREVIEW_INSTANCE_PATTERN.test(instance)) throw new Error('Invalid PDFE diagnostic instance')
      const value = randomBytes(SECRET_BYTES)
      grants.set(instance, value)
      return {
        secret: value.toString(SECRET_ENCODING),
        revoke() {
          if (grants.get(instance) === value) grants.delete(instance)
        },
      }
    },
    authorize(instance: string, secret: unknown): boolean {
      const expected = grants.get(instance)
      if (!expected || typeof secret !== 'string' || !SECRET_PATTERN.test(secret)) return false
      const actual = Buffer.from(secret, SECRET_ENCODING)
      return actual.toString(SECRET_ENCODING) === secret && timingSafeEqual(expected, actual)
    },
  }
}
