import { CURATED_PAPERS, referencePaper } from '../src/renderer/src/features/literature/recommendations.ts'
import { searchPapersBibtex } from '../src/renderer/src/features/literature/result.ts'
import { WEB_SEARCH_CANDIDATE_LIMIT } from '../src/renderer/src/features/resources/search.ts'

export const PREVIEW_DISCOVERY = {
  bibliographyPath: '/api/v1/imports/bibliography',
  resultStatusPath: '/api/literature/searches/result-status',
  maxBytes: 64 * 1024,
} as const

export const PREVIEW_DISCOVERY_SAVED = CURATED_PAPERS
  .filter(paper => ['leandojo2', 'rpeg', 'flip'].includes(paper.id))
  .map(paper => paper.metadata)

const papers = CURATED_PAPERS.flatMap(paper => [
  paper.metadata,
  ...paper.references.map((_reference, index) => referencePaper(paper, index)),
])
const ids = new Set(papers.map(paper => paper.paper_id))
const bibliography = new Map(papers.map(paper => [searchPapersBibtex([paper]), paper]))

export async function previewDiscoveryPaper(url: URL, contentType: string, bytes: Buffer) {
  if (!contentType.toLowerCase().startsWith('multipart/form-data;')) return undefined
  try {
    const data = await new Request(url, {
      method: 'POST', headers: { 'content-type': contentType }, body: Uint8Array.from(bytes),
    }).formData()
    const files = data.getAll('files')
    const [file] = files
    if (files.length !== 1 || typeof file === 'string' || !file ||
      file.name !== 'ai-search-results.bib' || Array.from(data.keys()).some(key => key !== 'files'))
      return undefined
    return bibliography.get(await file.text())
  } catch {
    return undefined
  }
}

export function previewDiscoveryIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length > WEB_SEARCH_CANDIDATE_LIMIT) return undefined
  const entries = value.map(item => item && typeof item === 'object' ? item.id as unknown : undefined)
  return entries.every((id): id is string => typeof id === 'string' && ids.has(id)) ? entries : undefined
}
