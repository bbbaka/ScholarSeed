import type { SessionNode } from '../../model'
import { searchSessionTitles } from '../../tree.ts'
import { NAME_LIMIT, PROMPT_LIMIT, newSchedule, type Schedule } from './model.ts'

export const RECOMMENDATION_LIMIT = 9
export const FIXED_RECOMMENDATIONS = [
  { example: 'papers', kind: 'paper' },
  { example: 'report', kind: 'session' },
  { example: 'files', kind: 'file' },
] as const
export const RECOMMENDATION_DYNAMIC_LIMIT = RECOMMENDATION_LIMIT - FIXED_RECOMMENDATIONS.length
export const RECOMMENDATION_PAGE_SIZE = 3
export const RECOMMENDATION_WIDE_WIDTH = 640
export const RECOMMENDATION_PAPER_LIMIT = 12
export const RECOMMENDATION_KINDS = ['paper', 'file', 'session', 'project'] as const
export type RecommendationKind = (typeof RECOMMENDATION_KINDS)[number]
export interface RecommendationSource {
  id: string
  kind: RecommendationKind
  title: string
  reference: string
}
export interface RecommendationEvidence {
  papers: { id: string; title: string }[]
  files: { path: string; name: string; available: boolean }[]
  sessions: SessionNode[]
}

export function recommendationSources(
  project: { path: string; description?: string },
  evidence: RecommendationEvidence,
  excludedSessions: ReadonlySet<string> = new Set()
): RecommendationSource[] {
  const groups: Record<RecommendationKind, RecommendationSource[]> = {
    paper: evidence.papers.map((paper) => ({
      id: `paper:${paper.id}`,
      kind: 'paper',
      title: paper.title,
      reference: paper.title,
    })),
    file: evidence.files
      .filter((file) => file.available)
      .map((file) => ({
        id: `file:${file.path}`,
        kind: 'file',
        title: file.name,
        reference: file.path,
      })),
    session: searchSessionTitles(evidence.sessions, '')
      .filter(
        (session) =>
          session.projectPath === project.path &&
          !session.title_fallback &&
          !excludedSessions.has(session.id) &&
          !session.parentSessionId &&
          !session.displayParentSessionId
      )
      .map((session) => ({
        id: `session:${session.id}`,
        kind: 'session',
        title: session.title,
        reference: session.title,
      })),
    project: project.description?.trim()
      ? [
          {
            id: 'project:description',
            kind: 'project',
            title: project.description.trim(),
            reference: project.description.trim(),
          },
        ]
      : [],
  }
  const result: RecommendationSource[] = []
  if (![...groups.paper, ...groups.file, ...groups.session].some((source) => source.title.trim()))
    return result
  const seen = new Set<string>()
  const longest = Math.max(...RECOMMENDATION_KINDS.map((kind) => groups[kind].length))
  for (let index = 0; index < longest && result.length < RECOMMENDATION_DYNAMIC_LIMIT; index += 1) {
    for (const kind of RECOMMENDATION_KINDS) {
      const source = groups[kind][index]
      if (!source || result.length >= RECOMMENDATION_DYNAMIC_LIMIT) continue
      const title = source.title.trim().replace(/\s+/g, ' ')
      const key = `${kind}:${title.toLocaleLowerCase()}`
      if (!title || seen.has(key)) continue
      seen.add(key)
      result.push({ ...source, title })
    }
  }
  return result
}

export function recommendationDraft(
  kind: RecommendationKind,
  text: { name: string; prompt: string }
): Schedule {
  const schedule = newSchedule()
  schedule.name = text.name.slice(0, NAME_LIMIT)
  schedule.prompt = text.prompt.slice(0, PROMPT_LIMIT)
  if (kind === 'session') {
    schedule.weekdays = [4]
    schedule.time = '17:00'
  }
  if (kind === 'file') schedule.frequency = 'monthly'
  return schedule
}

export function recommendationPage<Value>(
  items: readonly Value[],
  requested: number,
  size = RECOMMENDATION_PAGE_SIZE
) {
  const total = Math.max(1, Math.ceil(items.length / size))
  const index = Math.min(Math.max(0, requested), total - 1)
  return {
    index,
    total,
    items: items.slice(index * size, (index + 1) * size),
  }
}
