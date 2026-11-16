import type { HistoryResult } from '../src/renderer/src/api.ts'
import type { GlobalHit, SearchEverythingResult } from '../src/renderer/src/features/search/api.ts'

export const PREVIEW_PROJECT_SEARCH = {
  path: '/api/search',
  scene: 'project-search-shortcuts',
  feature: 'search-shortcuts',
  keyword: '检索样本',
  user: '请在对话中查找「检索样本」。',
  answer: '这是第二处检索样本。搜索只使用当前 PDFE 实例中的模拟数据。',
  maxQueryLength: 200,
  maxResults: 80,
} as const

const DOMAINS = ['resource', 'literature', 'session'] as const
export const previewSearchMatches = (value: string, query: string): boolean =>
  value.toLowerCase().includes(query.toLowerCase())

export function previewSessionHit(
  session: { id: string; title: string; history: HistoryResult },
  query: string
): GlobalHit | undefined {
  const matches = session.history.turns.filter(turn =>
    (turn.kind === 'user' || turn.kind === 'text') &&
    typeof turn.text === 'string' && previewSearchMatches(turn.text, query)
  )
  const match = matches.find(turn => turn.turn_id && turn.item_id)
  if (!match && !previewSearchMatches(session.title, query)) return undefined
  return {
    domain: 'session', id: session.id, title: session.title, subtitle: match?.text ?? '',
    locator: match ? { turn_id: match.turn_id, item_id: match.item_id, role: match.role, count: matches.length } : null,
  }
}

export function previewProjectSearch(
  hits: readonly GlobalHit[],
  literatureTotal = 0
): SearchEverythingResult {
  const groups: SearchEverythingResult['groups'] = {}
  const visible: GlobalHit[] = []
  for (const domain of DOMAINS) {
    const matches = hits.filter(hit => hit.domain === domain)
    const total = domain === 'literature' ? literatureTotal : matches.length
    groups[domain] = { total, truncated: total > PREVIEW_PROJECT_SEARCH.maxResults }
    visible.push(...matches.slice(0, PREVIEW_PROJECT_SEARCH.maxResults))
  }
  return { hits: visible, groups }
}
