import { randomUUID } from 'node:crypto'
import {
  schedulePayload,
  scheduleValid,
  type Schedule,
  type ScheduledRun,
  type ScheduledTask,
} from '../src/renderer/src/features/schedules/model.ts'

const ROUTE = /^\/api\/serve\/projects\/([^/]+)\/schedules(?:\/([^/]+)(?:\/(conversation|run))?)?$/
const SEED_TASK_ID = 'preview-schedule-literature'
const MOCK_NEXT_OFFSET_SECONDS = 3600
const ID_LIMIT = 200
const MOCK_DAY_SECONDS = 86400
const MOCK_RUN_AGE_SECONDS = 120
const MOCK_RUN_DURATION_SECONDS = 45
const MOCK_TASK_AGE_DAYS = 14

export type PreviewSchedulePolicy = 'sample' | 'empty' | 'proposal' | 'created' | 'clarification' | 'archived' | 'read-failure'
export type PreviewScheduleRecommendations = 'new-project' | 'conversations' | 'materials'

export const PREVIEW_SCHEDULE_INTERESTS = [
  '大语言模型推理与强化学习',
  '多智能体科研协作',
  '检索增强生成与知识更新',
  '长上下文记忆评测',
  '科研代码复现与实验记录',
  '论文阅读与证据核验',
  '模型评测数据集更新',
  '开放科学与可复现研究',
] as const

export const PREVIEW_SCHEDULE = {
  name: '模拟文献追踪',
  prompt: '汇总当前模拟项目的文献动态；不运行真实模型或工具。',
  frequency: 'weekly',
  time: '09:00',
  timezone: 'Asia/Shanghai',
  weekdays: [1],
  month_day: 1,
} as const satisfies Schedule

export const PREVIEW_CREATED_SCHEDULE = {
  cardId: 'preview-schedule-created',
  title: '创建定时任务：AI科研工具月度动态',
  request: '帮我定期看看面向科研人员的 AI 工具有什么新动态，整理成报告。',
  confirmation: '按这个计划创建吧。',
  firstRun: '2026-12-01T09:00:00+08:00',
  schedule: {
    ...PREVIEW_SCHEDULE,
    name: 'AI科研工具月度动态',
    prompt: '追踪过去一个月面向科研人员的 AI 工具动态，包括新产品发布、功能更新、融资和并购，以及重要论文和评测基准。覆盖文献检索与综述、研究想法生成、实验自动化等方向。重点关注 Elicit、Consensus、SciSpace、Semantic Scholar、FutureHouse、Google AI co-scientist 和国内同类产品。\n\n生成一份中文月报，包括 3–5 条要点摘要、一张附来源链接的表格（产品或机构、动态、日期、对科研 AI 产品的启示），以及对文献综述和想法生成类产品的竞争分析。只收录有可靠来源的信息；没有可靠来源的内容不收录。\n\n每次结果保存在独立的执行会话中，可从定时任务的执行记录查看。不发送邮件通知。',
    frequency: 'monthly',
    weekdays: [],
    timezone: 'Asia/Shanghai',
  } satisfies Schedule,
} as const

export const PREVIEW_CREATED_SCHEDULE_REPLY = `我已创建“${PREVIEW_CREATED_SCHEDULE.schedule.name}”自动化，现在是开启状态。

- **运行时间：** 每月1日上午9点（北京时间）。第一次运行是2026年12月1日上午9点。
- **监测内容：** 过去一个月面向科研人员的AI工具动态，包括新产品发布、功能更新、融资和并购，以及重要论文和评测基准。覆盖文献检索与综述、研究想法生成、实验自动化等方向。重点关注 Elicit、Consensus、SciSpace、Semantic Scholar、FutureHouse、Google AI co-scientist 和国内同类产品等。
- **输出内容：** 一份中文月报，包括3–5条要点摘要、一张附来源链接的表格（产品或机构、动态、日期、对科研AI产品的启示），以及对文献综述和想法生成类产品的竞争分析。只收录有可靠来源的信息。
- **结果查看：** 每次的结果会保存在独立的执行会话中，你可以从定时任务的执行记录查看。

如果想调整关注的产品名单、运行时间或报告格式，告诉我就行。`

const SAMPLE_TASKS: {
  id: string
  schedule: Schedule
  enabled: boolean
  statuses: ScheduledRun['status'][]
}[] = [
  {
    id: SEED_TASK_ID,
    schedule: { ...PREVIEW_SCHEDULE, weekdays: [1], name: '每日论文追踪（全状态演示）', frequency: 'daily' },
    enabled: true,
    statuses: ['running', 'completed', 'failed', 'interrupted', 'missed', 'completed', 'completed'],
  },
  {
    id: 'preview-schedule-report',
    schedule: {
      ...PREVIEW_SCHEDULE, weekdays: [5], name: '每周科研进展汇总', time: '18:00',
      prompt: '汇总本周研究进展与待办事项。这是模拟任务，不读取真实文件或调用模型。',
    },
    enabled: true,
    statuses: ['completed', 'completed'],
  },
  {
    id: 'preview-schedule-files',
    schedule: {
      ...PREVIEW_SCHEDULE, weekdays: [1], name: '项目资料整理', frequency: 'monthly', month_day: 10,
      prompt: '检查模拟项目资料并生成分类建议。这是模拟任务，不修改真实文件。',
    },
    enabled: false,
    statuses: ['interrupted'],
  },
  {
    id: 'preview-schedule-topics',
    schedule: {
      ...PREVIEW_SCHEDULE, weekdays: [1, 3, 5], name: '研究主题动态提醒', time: '16:30',
      prompt: '整理感兴趣研究主题的近期动态。这是模拟任务，不访问外部服务。',
    },
    enabled: true,
    statuses: ['failed'],
  },
]

type Reply = { status: number; body: unknown }
type SessionPorts = {
  open: (title: string, result?: ScheduledRun['status']) => string
  available: (id: string) => boolean
}
const ok = (body: unknown): Reply => ({ status: 200, body })
const fail = (status: number, detail: string): Reply => ({ status, body: { detail } })

export function previewScheduleRoute(path: string) {
  const match = ROUTE.exec(path)
  if (!match) return null
  const template = '/api/serve/projects/:projectId/schedules' +
    (match[2] === 'groups' && !match[3] ? '/groups' : match[2] ? '/:scheduleId' : '') +
    (match[3] ? '/' + match[3] : '')
  try {
    return {
      template,
      project: decodeURIComponent(match[1]),
      identity: match[2] ? decodeURIComponent(match[2]) : undefined,
      action: match[3],
    }
  } catch {
    return { template, project: '', identity: undefined, action: undefined }
  }
}

export class PreviewSchedules {
  private readRecovered = false
  private readonly tasks = new Map<string, ScheduledTask>()
  private readonly runs: ScheduledRun[] = []
  private readonly anchors = new Map<string, string>()

  constructor(
    private readonly policy?: PreviewSchedulePolicy,
    seedSession?: (task: ScheduledTask, run: ScheduledRun) => string,
    creationSessionId?: string
  ) {
    if (policy === 'created' && creationSessionId) {
      const now = Date.now() / 1000
      const task: ScheduledTask = {
        ...schedulePayload(PREVIEW_CREATED_SCHEDULE.schedule),
        id: `card:${creationSessionId}:${PREVIEW_CREATED_SCHEDULE.cardId}`,
        enabled: true, revision: 1,
        created_at: now,
        next_at: Date.parse(PREVIEW_CREATED_SCHEDULE.firstRun) / 1000,
      }
      this.tasks.set(task.id, task)
    }
    if (policy === 'sample' || policy === 'archived') {
      const now = Date.now() / 1000
      for (const sample of SAMPLE_TASKS) {
        const task: ScheduledTask = {
          ...schedulePayload(sample.schedule), id: sample.id, enabled: sample.enabled, revision: 1,
          created_at: now - MOCK_TASK_AGE_DAYS * MOCK_DAY_SECONDS,
          next_at: sample.enabled ? now + MOCK_NEXT_OFFSET_SECONDS : 0,
        }
        this.tasks.set(task.id, task)
        sample.statuses.forEach((status, index) => {
          const started = now - MOCK_RUN_AGE_SECONDS - index * MOCK_DAY_SECONDS
          const run: ScheduledRun = {
            id: randomUUID(), task_id: task.id, name: task.name, status,
            started_at: started,
            finished_at: status === 'running' ? null : status === 'missed' ? started : started + MOCK_RUN_DURATION_SECONDS,
            session_id: null,
            error: status === 'failed' ? 'schedule_execution_failed' : status === 'missed' ? 'schedule_missed' : null,
          }
          if (status !== 'missed' && seedSession) run.session_id = seedSession(task, run)
          this.runs.push(run)
        })
      }
      this.runs.sort((left, right) => right.started_at - left.started_at)
    }
  }

  get enabled(): boolean { return Boolean(this.policy) }

  recoverRead(): boolean {
    if (this.policy !== 'read-failure') return false
    this.readRecovered = true
    return true
  }

  interrupt(sessionId: string): void {
    const run = this.runs.find(candidate => candidate.session_id === sessionId && candidate.status === 'running')
    if (!run) return
    run.status = 'interrupted'
    run.finished_at = Date.now() / 1000
  }

  removeSession(sessionId: string): void {
    const index = this.runs.findIndex(run => run.session_id === sessionId)
    if (index !== -1) this.runs.splice(index, 1)
    for (const [taskId, anchor] of this.anchors) {
      if (anchor === sessionId) this.anchors.delete(taskId)
    }
  }

  request(
    route: NonNullable<ReturnType<typeof previewScheduleRoute>>,
    method: string,
    url: URL,
    body: Record<string, unknown>,
    ports: SessionPorts
  ): Reply {
    const { identity, action } = route
    if (method === 'GET' && !identity) {
      if (this.policy === 'read-failure' && !this.readRecovered) return fail(503, 'schedule_request_failed')
      return ok({ tasks: [...this.tasks.values()], runs: this.runs })
    }
    if (method === 'GET' && identity === 'groups' && !action) {
      const ids = new Set([...this.tasks.keys(), ...this.runs.map(run => run.task_id)])
      return ok([...ids].flatMap(id => {
        const runs = this.runs.filter(run => run.task_id === id)
        const anchor = this.anchors.get(id)
        const sessionIds = [...runs.map(run => run.session_id), anchor].filter(
          (session): session is string => Boolean(session)
        )
        const entrySessionId = sessionIds.find(ports.available)
        return entrySessionId ? [{
          id, title: this.tasks.get(id)?.name ?? runs[0]?.name, entrySessionId, sessionIds,
        }] : []
      }))
    }
    if (!this.enabled) return fail(404, 'schedule_project_unavailable')
    if (!identity || identity.length > ID_LIMIT) return fail(422, 'schedule_identity_invalid')
    const task = this.tasks.get(identity)
    const runs = this.runs.filter(run => run.task_id === identity)
    if (action === 'conversation' && (method === 'GET' || method === 'POST')) {
      let anchor = this.anchors.get(identity) ?? null
      const available = [...runs.map(run => run.session_id), anchor]
        .find((id): id is string => Boolean(id && ports.available(id))) ?? null
      if (method === 'GET') {
        if (!task && !runs.length) return fail(404, 'schedule_not_found')
        return ok({ task: task ?? null, runs, initial_session_id: anchor, session_id: available })
      }
      if (available) return ok({ session_id: available })
      if (!task) return fail(404, 'schedule_not_found')
      anchor = ports.open(task.name)
      this.anchors.set(identity, anchor)
      return ok({ session_id: anchor })
    }
    if (!action && method === 'PUT') {
      if (task && (body.revision === undefined || body.revision === null)) return ok(task)
      if (task ? body.revision !== task.revision : body.revision != null)
        return fail(409, 'schedule_conflict')
      const schedule = body.schedule as Schedule | undefined
      if (!schedule || typeof schedule !== 'object' || !scheduleValid(schedule) ||
        typeof body.enabled !== 'boolean') return fail(422, 'schedule_invalid')
      const now = Date.now() / 1000
      const saved = {
        ...schedulePayload(schedule), id: identity, enabled: body.enabled,
        revision: (task?.revision ?? 0) + 1, created_at: task?.created_at ?? now,
        next_at: task?.next_at ?? now + MOCK_NEXT_OFFSET_SECONDS,
      }
      this.tasks.set(identity, saved)
      return ok(saved)
    }
    if (!task) return fail(404, 'schedule_not_found')
    if (!action && method === 'DELETE') {
      if (url.searchParams.get('revision') !== String(task.revision))
        return fail(409, 'schedule_conflict')
      this.tasks.delete(identity)
      this.anchors.delete(identity)
      return ok({ ok: true })
    }
    if (action === 'run' && method === 'POST') {
      const now = Date.now() / 1000
      const id = randomUUID()
      this.runs.unshift({
        id, task_id: identity, name: task.name, status: 'completed',
        started_at: now, finished_at: now, session_id: ports.open(task.name, 'completed'),
        error: null,
      })
      return ok({ ok: true, run_id: id })
    }
    return fail(405, 'schedule_request_failed')
  }
}
