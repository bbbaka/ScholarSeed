import { randomUUID } from 'node:crypto'
import type { LiteratureSearchPaper, LiteratureSearchTask } from '../src/renderer/src/contracts/literature.ts'
import { WEB_SEARCH_CANDIDATE_LIMIT } from '../src/renderer/src/features/resources/search.ts'
import { CURATED_PAPERS } from '../src/renderer/src/features/literature/recommendations.ts'
import { REASONING_SEARCH } from './fixtures/reasoning.ts'

export const PREVIEW_SEARCH = {
  hostname: 'example.invalid',
  literatureQuery: '模拟文献检索：可复现研究',
  literatureTitle: 'Mock paper: reproducible research workflows',
} as const

export class PreviewSearchError extends Error {
  constructor(readonly status: number, readonly code: string) { super(code) }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class PreviewSearches {
  private readonly tasks: LiteratureSearchTask[]

  constructor({ literature = false }: { literature?: boolean } = {}) {
    if (!literature) {
      this.tasks = []
      return
    }
    const created = Date.now() / 1_000
    const papers: LiteratureSearchPaper[] = [
      { paper_id: randomUUID(), title: PREVIEW_SEARCH.literatureTitle, authors: ['Preview Research Team'], year: 2026, venue: 'Mock Research Collection', abstract: 'This is reviewed mock literature data for validating the real search result viewer. It is not a published scientific paper.', citation_count: 12, doi: '', arxiv_id: '', tier: null, reason: '模拟相关性说明：记录实验输入、方法与复现结果。', subtopics_covered: ['reproducibility'], access: 'open', source: 'preview', fulltext: 'abstract', url: `https://${PREVIEW_SEARCH.hostname}/paper/reproducibility` },
      { paper_id: randomUUID(), title: 'Mock paper: collaborative interface evaluation', authors: ['Preview Design Team'], year: 2025, venue: 'Mock Design Collection', abstract: 'An explicitly simulated abstract for shared interface evaluation. No literature retrieval or import has occurred.', citation_count: 3, doi: '', arxiv_id: '', tier: null, reason: '模拟相关性说明：在相同界面与受审数据上协作评估。', subtopics_covered: ['collaboration'], access: 'open', source: 'preview', fulltext: 'abstract', url: `https://${PREVIEW_SEARCH.hostname}/paper/collaboration` },
    ]
    const result = { search_summary: { query: PREVIEW_SEARCH.literatureQuery, total_rounds: 1, total_queries: 1, pool_size: papers.length, selected_count: papers.length, subtopics: ['reproducibility', 'collaboration'], coverage_assessment: '仅为受审模拟历史检索结果，不代表真实文献覆盖率。' }, papers }
    this.tasks = [{ id: randomUUID(), query: PREVIEW_SEARCH.literatureQuery, created_at: created, completed_at: created, status: 'completed', last_seq: 0, output: JSON.stringify(result), error: null, result }]
  }

  listLiterature(): { items: LiteratureSearchTask[] } {
    return { items: structuredClone(this.tasks) }
  }

  deleteLiterature(id: string): void {
    const index = this.tasks.findIndex(task => task.id === id)
    if (index >= 0) this.tasks.splice(index, 1)
  }

  conversation(body: unknown): { query: string; answer: string } {
    if (!record(body) || typeof body.task_id !== 'string' || !Array.isArray(body.paper_ids) || !body.paper_ids.every(id => typeof id === 'string')) throw new PreviewSearchError(422, 'preview_search_invalid')
    const task = this.tasks.find(task => task.id === body.task_id)
    if (!task?.result) throw new PreviewSearchError(404, 'preview_search_unknown')
    const ids = new Set(body.paper_ids)
    const papers = task.result.papers.filter(paper => !ids.size || ids.has(paper.paper_id))
    if (!papers.length || (ids.size && papers.length !== ids.size)) throw new PreviewSearchError(422, 'preview_search_paper_unknown')
    return {
      query: task.query,
      answer: papers.map((paper, index) => [
        `### ${index + 1}. ${paper.title}`,
        [paper.authors.join(', '), paper.venue, paper.year].filter(Boolean).join(' · '),
        paper.abstract,
        paper.reason,
        paper.doi ? `https://doi.org/${paper.doi}` : paper.url,
      ].filter(Boolean).join('\n\n')).join('\n\n'),
    }
  }

  createLiterature(body: unknown): LiteratureSearchTask {
    if (!record(body) || typeof body.query !== 'string' || !body.query.trim()) throw new PreviewSearchError(422, 'preview_search_invalid')
    const query = body.query.trim()
    const terms = query.toLocaleLowerCase().split(/\s+/)
    const sample = REASONING_SEARCH.queries.some(value => value === query.toLocaleLowerCase())
    const papers = sample ? REASONING_SEARCH.papers.map(item => {
      const paper = CURATED_PAPERS.find(paper => paper.id === item.id)
      if (!paper) throw new PreviewSearchError(500, 'preview_search_fixture_missing')
      return { ...structuredClone(paper.metadata), reason: /\p{Script=Han}/u.test(query) ? item.reason : item.reasonEn }
    }) : CURATED_PAPERS.filter(paper => {
      const text = [paper.metadata.title, paper.metadata.doi, paper.metadata.arxiv_id, ...paper.keywords, ...Object.values(paper.titles), paper.reading.zh.summary, paper.reading.en.summary].join(' ').toLocaleLowerCase()
      return terms.every(term => text.includes(term))
    }).map(paper => structuredClone(paper.metadata))
    const created = Date.now() / 1_000
    const result = { search_summary: { query, total_rounds: 1, total_queries: 1, pool_size: papers.length, selected_count: papers.length, subtopics: [], coverage_assessment: 'PDFE mock catalog search; no external retrieval.' }, papers }
    const task: LiteratureSearchTask = { id: randomUUID(), query, created_at: created, completed_at: created, status: papers.length ? 'completed' : 'empty', last_seq: 0, output: JSON.stringify(result), error: null, result }
    this.tasks.unshift(task)
    return structuredClone(task)
  }

  resultStatus(body: unknown): { items: Record<string, { library: 'absent' }> } {
    if (!record(body) || !Array.isArray(body.papers) || body.papers.length > WEB_SEARCH_CANDIDATE_LIMIT) throw new PreviewSearchError(422, 'preview_search_invalid')
    const known = new Set(this.tasks.flatMap(task => task.result?.papers.map(paper => paper.paper_id) ?? []))
    const items: Record<string, { library: 'absent' }> = {}
    for (const paper of body.papers) {
      if (!record(paper) || typeof paper.id !== 'string' || !known.has(paper.id)) throw new PreviewSearchError(422, 'preview_search_paper_unknown')
      items[paper.id] = { library: 'absent' }
    }
    return { items }
  }

}
