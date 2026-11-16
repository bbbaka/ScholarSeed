import { apiFetch } from '../../app/api/client'
import { interruptSession, loadSessionStatus } from '../../api'
import { projectRuns } from './history'
import {
  schedulePayload,
  type Schedule,
  type ScheduledTask,
  type ScheduleSnapshot,
  type ScheduleConversation,
} from './model'
import type { SessionGroup } from '../../contracts/features'

const REQUEST_TIMEOUT = 20000
const STOP_POLL_INTERVAL = 500

export async function stopScheduleSession(
  project: string,
  task: string,
  session: string
): Promise<void> {
  const conversation = await loadScheduleConversation(project, task)
  const run = conversation.runs.find((entry) => entry.session_id === session)
  if (!run?.busy && run?.status !== 'running') return
  if (!(await interruptSession(session)).ok) throw new Error('schedule_interrupt_failed')
  const deadline = Date.now() + REQUEST_TIMEOUT
  while (Date.now() < deadline) {
    const latest = await loadScheduleConversation(project, task)
    const current = latest.runs.find((entry) => entry.session_id === session)
    if (!current || (!current.busy && current.status !== 'running')) return
    await new Promise((resolve) => setTimeout(resolve, STOP_POLL_INTERVAL))
  }
  throw new Error('schedule_interrupt_timeout')
}
const route = (project: string): string =>
  `/api/serve/projects/${encodeURIComponent(project)}/schedules`

async function request<Value>(path: string, method = 'GET', body?: unknown): Promise<Value> {
  const response = await apiFetch(path, {
    method,
    cache: 'no-store',
    timeoutMs: REQUEST_TIMEOUT,
    ...(body
      ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }
      : {}),
  })
  if (!response.ok) {
    const result = await response.json().catch(() => null)
    throw new Error(typeof result?.detail === 'string' ? result.detail : 'schedule_request_failed')
  }
  return response.json() as Promise<Value>
}
async function projectSnapshot<
  Value extends Pick<ScheduleSnapshot, 'runs'> & { initial_session_id?: string | null },
>(value: Value): Promise<Value> {
  const ids = value.runs.flatMap((run) => (run.session_id ? [run.session_id] : []))
  if (value.initial_session_id) ids.push(value.initial_session_id)
  const sessions = ids.length ? await loadSessionStatus(ids, {}, new AbortController().signal) : []
  return {
    ...value,
    runs: projectRuns(value.runs, sessions),
    initial_session_id:
      sessions.find(
        (session) => session.session_id === value.initial_session_id && !session.archived
      )?.session_id ?? null,
  }
}
export const loadSchedules = async (project: string): Promise<ScheduleSnapshot> =>
  projectSnapshot(await request<ScheduleSnapshot>(route(project)))
export const loadScheduleGroups = (project: string): Promise<SessionGroup[]> =>
  request(`${route(project)}/groups`)
export const loadScheduleConversation = async (
  project: string,
  id: string
): Promise<ScheduleConversation> =>
  projectSnapshot(
    await request<ScheduleConversation>(`${route(project)}/${encodeURIComponent(id)}/conversation`)
  )
export const openScheduleConversation = (
  project: string,
  id: string
): Promise<{ session_id: string }> =>
  request(`${route(project)}/${encodeURIComponent(id)}/conversation`, 'POST')
export const saveSchedule = (
  project: string,
  id: string,
  schedule: Schedule,
  revision?: number,
  enabled = true
): Promise<ScheduledTask> =>
  request(`${route(project)}/${encodeURIComponent(id)}`, 'PUT', {
    schedule: schedulePayload(schedule),
    revision: revision ?? null,
    enabled,
  })
export const deleteSchedule = (project: string, task: ScheduledTask): Promise<unknown> =>
  request(`${route(project)}/${encodeURIComponent(task.id)}?revision=${task.revision}`, 'DELETE')
export const runSchedule = (project: string, task: ScheduledTask): Promise<{ run_id: string }> =>
  request(`${route(project)}/${encodeURIComponent(task.id)}/run`, 'POST')

const RUN_SESSION_POLL_INTERVAL = 500
export async function waitForScheduleRun(project: string, runId: string): Promise<string> {
  const deadline = Date.now() + REQUEST_TIMEOUT
  while (Date.now() < deadline) {
    const snapshot = await loadSchedules(project)
    const run = snapshot.runs.find((entry) => entry.id === runId)
    if (run?.session_id) return run.session_id
    if (run && run.status !== 'running') break
    await new Promise((resolve) => setTimeout(resolve, RUN_SESSION_POLL_INTERVAL))
  }
  throw new Error('schedule_run_session_unavailable')
}
