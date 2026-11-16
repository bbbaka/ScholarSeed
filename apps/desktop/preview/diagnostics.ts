import { createHmac, randomBytes } from 'node:crypto'
import { NOTIFICATION_PATH } from '../src/notifications.ts'
import {
  PDFE_DIAGNOSTIC_BUDGET,
  PDFE_UNMATCHED_ROUTE,
  type PdfeDiagnosticDetail,
  type PdfeHttpDiagnostic,
  type PdfeStreamDiagnostic,
} from '../src/pdfe.ts'
import { PREVIEW_BROWSING } from './listing.ts'

const PROJECTS = '/api/content/projects'
const UNKNOWN = '(unknown)'
const STREAM_PATH = {
  notification: NOTIFICATION_PATH,
  session: '/api/serve/sessions/:sessionId/events',
  file: '/api/content/events',
} as const
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'])
const OPERATION_STATES = new Set(['queued', 'running', 'succeeded', 'failed'])
const ERRORS = new Set<string>([
  PREVIEW_BROWSING.moreFailure, PREVIEW_BROWSING.explorerFailure, PREVIEW_BROWSING.invalid,
  'preview_project_creation_failed', 'preview_project_not_found', 'preview_instance_reset',
  'content_operation_unknown', 'content_operation_failed', 'name_required', 'name_too_long',
])
const EVENT_TYPES = new Set([
  'ready', 'created', 'modified', 'moved', 'deleted', 'artifact_changed', 'artifact_failed',
  'display_card', 'hil_requested', 'hil_resolved', 'message_delta', 'message_removed',
  'reasoning_completed', 'reasoning_delta', 'review_ready', 'session_state', 'tool_output_delta',
  'tool_started', 'tool_completed', 'turn_started', 'turn_completed', 'turn_failed',
  'turn_interrupted', 'user_message',
])
const EMPTY: PdfeDiagnosticDetail = { state: 'empty' }
const OMITTED: PdfeDiagnosticDetail = { state: 'omitted' }
const NAME_SUMMARY_LIMIT = 1000
const UNHANDLED_LIMIT = 24
const ALIAS_SECRET_BYTES = 32
const ALIAS_LENGTH = 16

type Entry = { http: PdfeHttpDiagnostic; stream?: never } | { stream: PdfeStreamDiagnostic; http?: never }
type StreamKind = PdfeStreamDiagnostic['kind']
type ConnectionEnd = Extract<PdfeStreamDiagnostic['phase'], 'closed' | 'interrupted'>

function safeMethod(method: string): string {
  return METHODS.has(method) ? method : UNKNOWN
}

function fields(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function count(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined
}

function aliasSource(value: string): string {
  try { return decodeURIComponent(value) } catch { return value }
}

export class PreviewDiagnostics {
  private readonly secret = randomBytes(ALIAS_SECRET_BYTES)
  private readonly records: { entry: Entry; bytes: number }[] = []
  private readonly unknownRequests = new Set<string>()
  private bytes = 0
  private dropped = 0
  private sequence = 0
  private connection = 0

  private alias(namespace: string, subject: string): string {
    return namespace + '-' + createHmac('sha256', this.secret).update(namespace + '\0' + subject).digest('hex').slice(0, ALIAS_LENGTH)
  }

  private append(entry: Entry): void {
    let bytes = Buffer.byteLength(JSON.stringify(entry)) + 1
    if (entry.http?.response.state === 'available' && entry.http.response.json !== undefined &&
      bytes > PDFE_DIAGNOSTIC_BUDGET.fullRecordBytes) {
      entry.http.response = { state: 'truncated' }
      bytes = Buffer.byteLength(JSON.stringify(entry)) + 1
    }
    const limit = entry.http?.response.state === 'available' && entry.http.response.json !== undefined
      ? PDFE_DIAGNOSTIC_BUDGET.fullRecordBytes : PDFE_DIAGNOSTIC_BUDGET.recordBytes
    if (bytes > limit) {
      this.dropped++
      return
    }
    this.records.push({ entry, bytes })
    this.bytes += bytes
    this.trim()
  }

  private trim(): void {
    while (this.records.length > PDFE_DIAGNOSTIC_BUDGET.records || this.bytes > PDFE_DIAGNOSTIC_BUDGET.bytes) {
      this.bytes -= this.records.shift()!.bytes
      this.dropped++
    }
  }

  markUnhandled(method: string): void {
    if (this.unknownRequests.size < UNHANDLED_LIMIT)
      this.unknownRequests.add(safeMethod(method) + ' ' + PDFE_UNMATCHED_ROUTE)
  }

  begin(method: string, url: URL) {
    let path = PDFE_UNMATCHED_ROUTE
    let parameters: Record<string, string | number> = {}
    const started = performance.now()
    let nameLength: number | undefined
    let hasBody = false
    let response = OMITTED
    let finished = false
    return {
      mockResponse(json: string): void {
        response = Buffer.byteLength(json) <= PDFE_DIAGNOSTIC_BUDGET.fullRecordBytes
          ? { state: 'available', json: JSON.parse(json) }
          : { state: 'truncated' }
      },
      match: (template: string, subjects: Readonly<Record<string, string>> = {}): void => {
        path = template
        parameters = Object.fromEntries(Object.entries(subjects).map(([key, value]) => [key, this.alias(key, aliasSource(value))]))
      },
      unmatch(): void {
        path = PDFE_UNMATCHED_ROUTE
        parameters = {}
      },
      request(value: unknown): void {
        if (method !== 'POST' || url.pathname !== PROJECTS) return
        const payload = fields(value)
        hasBody = Object.keys(payload).length > 0
        if (typeof payload.name === 'string') nameLength = payload.name.trim().length
      },
      response: (value: unknown): void => {
        if (method === 'GET' && path === '/api/serve/attention') {
          const payload = fields(value)
          const revision = count(payload.revision)
          const unread = count(payload.unread_count)
          const bySession = payload.by_session
          if (Object.keys(payload).length === 5 && typeof payload.epoch === 'string' &&
            revision !== undefined && unread !== undefined &&
            bySession && typeof bySession === 'object' && !Array.isArray(bySession) &&
            !Object.keys(bySession).length && Array.isArray(payload.items) && !payload.items.length) {
            response = { state: 'redacted', json: {
              epoch: this.alias('epoch', payload.epoch), revision, unread_count: unread, by_session: {}, items: [],
            } }
          }
          return
        }
        const projectCreation = method === 'POST' && path === PROJECTS
        const allowed = method === 'GET' && (
          path === PROJECTS + '/:projectId/tree' ? 'tree' :
          path === '/api/content/operations/:operationId' ? 'operation' : undefined
        )
        if (!allowed && !projectCreation) return
        const payload = fields(value)
        const projection: Record<string, string | number> = {}
        if (allowed === 'tree') {
          const total = count(payload.total)
          if (total !== undefined) projection.total = total
          if (Array.isArray(payload.nodes)) projection.returned = payload.nodes.length
        } else {
          if (typeof payload.operation === 'string') projection.operation = this.alias('operation', payload.operation)
          if (typeof payload.state === 'string' && OPERATION_STATES.has(payload.state)) projection.state = payload.state
        }
        const error = payload.error ?? payload.detail ?? payload.code
        if (typeof error === 'string' && ERRORS.has(error)) projection.error = error
        response = Object.keys(projection).length ? { state: 'redacted', fields: projection } : OMITTED
      },
      finish: (status: number | null, outcome: PdfeHttpDiagnostic['outcome']): void => {
        if (finished) return
        finished = true
        if (method === 'GET' && path === PROJECTS + '/:projectId/tree') {
          const offset = url.searchParams.get('offset') ?? '0'
          const numericOffset = /^\d+$/.test(offset) ? count(Number(offset)) : undefined
          if (numericOffset !== undefined) parameters.offset = numericOffset
        }
        if (method === 'GET' && path === PROJECTS) {
          const flag = url.searchParams.get('includeArchived')
          if (flag === 'true' || flag === 'false') parameters.includeArchived = flag
        }
        const safeParameters: PdfeDiagnosticDetail = Object.keys(parameters).length
          ? { state: 'redacted', fields: parameters } : url.search ? OMITTED : EMPTY
        let body = method === 'GET' || method === 'HEAD' ? EMPTY : OMITTED
        if (method === 'POST' && path === PROJECTS) {
          body = nameLength === undefined ? (hasBody ? OMITTED : EMPTY) : {
            state: nameLength > NAME_SUMMARY_LIMIT ? 'truncated' : 'redacted',
            fields: { nameLength: Math.min(nameLength, NAME_SUMMARY_LIMIT) },
          }
        }
        this.append({ http: {
          sequence: ++this.sequence, method: safeMethod(method), path, status,
          durationMs: Math.max(0, Math.round((performance.now() - started) * 10) / 10), outcome,
          parameters: safeParameters, body, response: status === 204 ? EMPTY : response,
        } })
      },
    }
  }

  open(kind: StreamKind, identity?: string, cursor?: number) {
    const connection = ++this.connection
    const subject = identity === undefined ? undefined : this.alias(kind === 'file' ? 'project' : kind, identity)
    const path = STREAM_PATH[kind]
    const lifecycle = this.records.map(({ entry }) => entry.stream).filter(record =>
      record?.kind === kind && record.subject === subject && record.phase !== 'write'
    )
    const preceding = lifecycle.at(-1)
    const precedingOpen = lifecycle.find(record => record?.connection === preceding?.connection && record?.phase === 'open')
    const parallel = lifecycle.some(record => record?.phase === 'open' && record.connection !== preceding?.connection &&
      !lifecycle.some(end => end?.connection === record.connection && (end.phase === 'closed' || end.phase === 'interrupted')))
    const reconnectOf = !parallel && preceding?.phase === 'interrupted' && preceding.reconnectable &&
      cursor !== undefined && precedingOpen?.cursor !== undefined && preceding.eventSequence !== undefined &&
      cursor > precedingOpen.cursor && cursor <= preceding.eventSequence ? preceding.connection : undefined
    const append = (details: Pick<PdfeStreamDiagnostic, 'phase'> & Partial<PdfeStreamDiagnostic>) => this.append({
      stream: { sequence: ++this.sequence, at: Date.now(), connection, kind, path, subject, ...details },
    })
    append({ phase: 'open', cursor, reconnectOf, heartbeats: 0 })
    let lastSequence = cursor
    let heartbeats = 0
    let closed = false
    return {
      written: (event: string, eventSequence?: number): void => {
        if (closed) return
        if (event === 'heartbeat') {
          heartbeats++
          const open = this.records.find(({ entry }) => entry.stream?.connection === connection && entry.stream.phase === 'open')
          if (open?.entry.stream) {
            const growth = String(heartbeats).length - String(open.entry.stream.heartbeats).length
            open.entry.stream.heartbeats = heartbeats
            open.bytes += growth
            this.bytes += growth
            this.trim()
          }
          return
        }
        const observedSequence = count(eventSequence)
        if (observedSequence !== undefined) lastSequence = observedSequence
        append({ phase: 'write', event: EVENT_TYPES.has(event) ? event : UNKNOWN, eventSequence: observedSequence })
      },
      close: (phase: ConnectionEnd, reconnectable = false): void => {
        if (closed) return
        closed = true
        append({ phase, eventSequence: lastSequence, heartbeats, ...(reconnectable ? { reconnectable } : {}) })
      },
    }
  }

  snapshot() {
    return {
      requests: this.records.flatMap(({ entry }) => entry.http ? [structuredClone(entry.http)] : []),
      streams: this.records.flatMap(({ entry }) => entry.stream ? [{ ...entry.stream }] : []),
      unhandled: [...this.unknownRequests],
      dropped: this.dropped,
    }
  }
}
