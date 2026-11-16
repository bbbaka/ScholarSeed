import React, { useLayoutEffect, useRef, useState } from 'react'
import { Badge, Button, CopyButton, SearchBox, Tabs, TabsContent, TabsList, TabsTrigger } from '../src/renderer/src/components/ui'
import { PDFE_UNMATCHED_ROUTE, type PdfeDiagnosticDetail, type PdfeDiagnosticStatus, type PdfeHttpDiagnostic, type PdfeStreamDiagnostic } from '../src/pdfe.ts'
import type { PdfeTranslate } from './collaboration.ts'

const STACK = 'grid min-w-0 content-start gap-[var(--vds-space-2)]'
const MUTE = 'text-[var(--vds-text-secondary)]'
const STREAM = { session: 'diagnosticSession', notification: 'diagnosticNotification', file: 'diagnosticFile' } as const
const PHASE = { open: 'diagnosticOpen', write: 'diagnosticWrite', closed: 'diagnosticClosed', interrupted: 'diagnosticInterrupted' } as const
const DETAIL = { available: 'diagnosticAvailable', empty: 'diagnosticEmptyData', omitted: 'diagnosticOmitted', redacted: 'diagnosticRedacted', truncated: 'diagnosticTruncated' } as const
const FIELD = {
  project: 'diagnosticProject', session: 'diagnosticSession', offset: 'diagnosticOffset',
  includeArchived: 'diagnosticIncludeArchived',
  total: 'diagnosticTotal', returned: 'diagnosticReturned', nameLength: 'diagnosticNameLength',
  operation: 'diagnosticOperation', state: 'diagnosticState', error: 'diagnosticErrorCode',
} as const

function Projection({ title, value, translate }: { title: string; value: PdfeDiagnosticDetail; translate: PdfeTranslate }) {
  return <section className={STACK}>
    <h3 className="font-semibold">{title}</h3>
    <p className={MUTE}>{translate(DETAIL[value.state])}</p>
    {value.json !== undefined && <pre className="min-w-0 whitespace-pre-wrap break-all"><code>{JSON.stringify(value.json, null, 2)}</code></pre>}
    {value.fields && <dl>{Object.entries(value.fields).map(([field, entry]) => {
      const label = FIELD[field as keyof typeof FIELD]
      return <div key={field} className="flex flex-wrap gap-[var(--vds-space-2)]">
        <dt>{label ? translate(label) : field}</dt><dd className="break-all"><code>{entry}</code></dd>
      </div>
    })}</dl>}
  </section>
}

function HttpTitle({ record, translate }: { record: PdfeHttpDiagnostic; translate: PdfeTranslate }) {
  const failed = record.status !== null && record.status >= 400
  const outcome = record.outcome === 'aborted' ? 'diagnosticAborted' : failed ? 'diagnosticHttpFailed' : null
  return <>
    <code className={MUTE}>#{record.sequence}</code>
    <code className="break-all">{record.method} {record.path === PDFE_UNMATCHED_ROUTE ? translate('diagnosticUnmatchedRoute') : record.path}</code>
    <Badge tone={record.outcome === 'aborted' || failed ? 'danger' : 'neutral'}>{record.status ?? '—'}</Badge>
    <span className={MUTE}>{outcome && <>{translate(outcome)} · </>}{translate('diagnosticDuration', { duration: record.durationMs })}</span>
  </>
}

function StreamTitle({ record, translate }: { record: PdfeStreamDiagnostic; translate: PdfeTranslate }) {
  return <>
    <span>{translate(STREAM[record.kind])} · {translate('diagnosticConnection', { id: record.connection })}</span>
    <Badge variant="outline">{translate(PHASE[record.phase])}</Badge>
    {record.event && <code>{record.event}</code>}
  </>
}

export function PdfeRequests({ snapshot, pending, failed, onCopy, translate }: {
  snapshot: PdfeDiagnosticStatus | null
  pending: boolean
  failed: boolean
  onCopy?: (generation: string, sequences: readonly number[]) => Promise<void>
  translate: PdfeTranslate
}) {
  const [view, setView] = useState('http')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<number>()
  const rowRefs = useRef(new Map<number, HTMLButtonElement>())
  const backRef = useRef<HTMLButtonElement>(null)
  const returnTo = useRef<number | undefined>(undefined)
  const term = query.trim().toLowerCase()
  const environment = snapshot?.environment ?? []
  const requests = [...(snapshot?.requests ?? [])].reverse()
  const streams = [...(snapshot?.streams ?? [])].reverse()
  const http = view === 'http' ? requests.find(record => record.sequence === selected) : undefined
  const stream = view === 'sse' ? streams.find(record => record.sequence === selected) : undefined
  const candidates = view === 'http' ? requests : streams
  const matching = candidates.filter(record =>
    !term || JSON.stringify(record).toLowerCase().includes(term) ||
    (record.path === PDFE_UNMATCHED_ROUTE && translate('diagnosticUnmatchedRoute').toLowerCase().includes(term))
  )
  const copyRecords = async (records: readonly (PdfeHttpDiagnostic | PdfeStreamDiagnostic)[]) => {
    if (!snapshot || !onCopy) throw new Error('PDFE diagnostic copy unavailable')
    await onCopy(snapshot.generation, records.map(record => record.sequence))
  }
  const streamGroups = new Map<number, PdfeStreamDiagnostic[]>()
  for (const record of matching) {
    if (!('connection' in record)) continue
    const group = streamGroups.get(record.connection) ?? []
    group.push(record)
    streamGroups.set(record.connection, group)
  }
  useLayoutEffect(() => {
    if (selected !== undefined) backRef.current?.focus()
    else if (returnTo.current !== undefined) {
      rowRefs.current.get(returnTo.current)?.focus()
      returnTo.current = undefined
    }
  }, [selected])
  const row = (record: PdfeHttpDiagnostic | PdfeStreamDiagnostic) => <li key={record.sequence}>
    <Button ref={button => {
      if (button) rowRefs.current.set(record.sequence, button)
      else rowRefs.current.delete(record.sequence)
    }} variant="secondary" size="content" className="w-full flex-wrap justify-start whitespace-normal text-left" onClick={() => {
      returnTo.current = record.sequence
      setSelected(record.sequence)
    }}>
      {'method' in record ? <HttpTitle record={record} translate={translate} /> : <StreamTitle record={record} translate={translate} />}
    </Button>
  </li>

  return <section className={STACK} aria-label={translate('diagnosticTab')}>
    {(pending || (!snapshot && !failed)) && <p role="status">{translate('operationPending')}</p>}
    {failed && <p role="alert">{translate(snapshot ? 'diagnosticStale' : 'requestFailed')}</p>}
    {snapshot && !onCopy && <p role="status" className={MUTE}>{translate('diagnosticCopyRestartRequired')}</p>}
    <Tabs value={view} onValueChange={value => { setView(value); setQuery(''); setSelected(undefined) }}>
      <TabsList aria-label={translate('diagnosticTypes')} className="w-full">
        <TabsTrigger value="http" aria-label={translate('diagnosticHttp')} className="min-w-0 flex-1">{translate('diagnosticHttpTab')}</TabsTrigger>
        <TabsTrigger value="sse" aria-label={translate('diagnosticSse')} className="min-w-0 flex-1">{translate('diagnosticSseTab')}</TabsTrigger>
        <TabsTrigger value="environment" className="flex-1">{translate('diagnosticEnvironment')}</TabsTrigger>
      </TabsList>
      {view === 'environment'
        ? <TabsContent value="environment" className={STACK}>
            {snapshot && !snapshot.unhandled.length && !environment.length && <p>{translate('diagnosticNoRecords')}</p>}
            {!!snapshot?.unhandled.length && <section className={STACK}>
              <h3>{translate('diagnosticUnhandled')}</h3>
              <ul>{snapshot.unhandled.map(entry => <li key={entry}><code>{entry.replace(PDFE_UNMATCHED_ROUTE, translate('diagnosticUnmatchedRoute'))}</code></li>)}</ul>
            </section>}
            {!!environment.length && <section className={STACK}>
              <h3>{translate('diagnosticBridge')}</h3>
              <ul>{environment.map(entry => <li key={entry}><code>{entry}</code></li>)}</ul>
            </section>}
          </TabsContent>
        : <TabsContent value={view} className={STACK}>
            {!snapshot ? null : http || stream
              ? <div className={STACK} data-testid="preview-diagnostic-detail">
                  <div className="flex flex-wrap gap-[var(--vds-space-2)]">
                    <Button ref={backRef} variant="ghost" onClick={() => setSelected(undefined)}>{translate('diagnosticBack')}</Button>
                    <CopyButton variant="secondary" idleLabel={translate('diagnosticCopyDetail')} disabled={!onCopy} value="" writeText={() => copyRecords(http ? [http] : stream ? [stream] : [])} />
                  </div>
                  {http && <>
                    <h3 className="flex flex-wrap items-center gap-[var(--vds-space-2)]"><HttpTitle record={http} translate={translate} /></h3>
                    {http.parameters.state !== 'empty' && <Projection title={translate('diagnosticParameters')} value={http.parameters} translate={translate} />}
                    {http.body.state !== 'empty' && <Projection title={translate('diagnosticBody')} value={http.body} translate={translate} />}
                    <Projection title={translate('diagnosticResponse')} value={http.response} translate={translate} />
                  </>}
                  {stream && <>
                    <h3 className="flex flex-wrap items-center gap-[var(--vds-space-2)]"><StreamTitle record={stream} translate={translate} /></h3>
                    <code className="break-all">{stream.path}</code>
                    <time dateTime={new Date(stream.at).toISOString()}>{new Date(stream.at).toISOString()}</time>
                    {stream.subject && <code className="break-all">{stream.subject}</code>}
                    {stream.cursor !== undefined && <p>{translate('diagnosticCursor', { cursor: stream.cursor })}</p>}
                    {stream.eventSequence !== undefined && <p>{translate('diagnosticEventSequence', { sequence: stream.eventSequence })}</p>}
                    {stream.reconnectOf !== undefined && <p>{translate('diagnosticReconnect', { id: stream.reconnectOf })}</p>}
                    {(stream.heartbeats ?? 0) > 0 && <p>{translate('diagnosticHeartbeats', { count: stream.heartbeats ?? 0 })}</p>}
                  </>}
                </div>
              : <>
                  <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-[var(--vds-space-2)]">
                    <SearchBox containerClassName="min-w-0" aria-label={translate('diagnosticSearch')} placeholder={translate('diagnosticSearch')} value={query} onChange={event => setQuery(event.target.value)} />
                    <CopyButton variant="secondary" idleLabel={translate('diagnosticCopyList')} disabled={!onCopy || !matching.length} value="" writeText={() => copyRecords(matching)} />
                  </div>
                  {!matching.length && <p role="status">{translate('diagnosticNoRecords')}</p>}
                  <div className={STACK} data-testid="preview-diagnostic-history">
                    {view === 'http' ? <ul className={STACK}>{matching.map(row)}</ul>
                      : [...streamGroups].map(([connection, records]) => <section className={STACK} key={connection}>
                          <h3 className="font-semibold">{translate(STREAM[records[0].kind])} · {translate('diagnosticConnection', { id: connection })}</h3>
                          <ul className={STACK}>{records.map(row)}</ul>
                        </section>)}
                  </div>
                </>}
          </TabsContent>}
    </Tabs>
  </section>
}
