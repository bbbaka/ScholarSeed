import type { LiteratureSearchPaper } from '../../contracts/literature'
import papers from './papers.json' with { type: 'json' }

export const INTEREST_LENGTH = 60
export const INTEREST_LIMIT = 20
export const CURATED_TOPICS = [
  'ai',
  'robot',
  'math',
  'life',
  'neuro',
  'med',
  'chem',
  'energy',
  'quantum',
  'astro',
  'earth',
  'eco',
] as const
export const TOPIC_LABELS = {
  ai: 'discovery.topics.ai',
  robot: 'discovery.topics.robot',
  math: 'discovery.topics.math',
  life: 'discovery.topics.life',
  neuro: 'discovery.topics.neuro',
  med: 'discovery.topics.med',
  chem: 'discovery.topics.chem',
  energy: 'discovery.topics.energy',
  quantum: 'discovery.topics.quantum',
  astro: 'discovery.topics.astro',
  earth: 'discovery.topics.earth',
  eco: 'discovery.topics.eco',
} as const
export const DISCOVERY_EDITION = '2026-11-09'
export const DISCOVERY_PERIODS = ['today', 'week', 'month'] as const
export type DiscoveryPeriod = (typeof DISCOVERY_PERIODS)[number]
const PERIOD_DAYS = { today: 1, week: 7, month: 30 } as const
const DAY_MILLISECONDS = 86_400_000
export type CuratedTopic = (typeof CURATED_TOPICS)[number]
export interface PaperReading {
  headline: string
  summary: string
  question: string
  approach: string
  steps: string[]
  flow: { stage: string; title: string; description: string }[]
  finding: string
  caution: string
  limitations: string[]
  terms?: { name: string; description: string }[]
}
export interface CuratedPaper {
  id: string
  topic: CuratedTopic
  topics: CuratedTopic[]
  label: string
  metadata: LiteratureSearchPaper
  originalLanguage: string
  titles: Record<string, string>
  keywords: string[]
  reading: { zh: PaperReading; en: PaperReading }
  published: string
  affiliations: string[]
  pdf: string
  identifier: string
  openAccess: boolean
  kind: string
  abstractSummary: Record<string, string>
  metrics: {
    value: string
    zh: string
    en: string
    source: string
    sourceEn: string
    valueEn?: string
  }[]
  citations?: CitationStatistics
  relatedCitations?: Record<string, CitationStatistics>
  evidence?: { section: 'question' | 'approach' | 'finding'; page: number; location?: string }[]
  references: {
    title: string
    authors?: string
    year?: number
    venue?: string
    citation?: string
    citations?: CitationStatistics
  }[]
  referenceTotal: number | null
  referenceSource: string
  referenceComplete: boolean
  figure?: {
    source: string
    credit: string
    license: string
    zh: { alt: string; reason: string; guide: string[] }
    en: { alt: string; reason: string; guide: string[] }
  }
}

export interface CitationStatistics {
  count: number
  source: string
  updated: string
  simulated?: boolean
}

export const CURATED_PAPERS = papers as CuratedPaper[]

export function paperLanguage(language: string): string {
  try {
    return new Intl.Locale(language).language
  } catch {
    return 'und'
  }
}

export function paperText(
  paper: CuratedPaper,
  language: string,
  original = false
): { title: string | null; abstract: string | null; language: string } {
  const target = paperLanguage(language)
  const source = paperLanguage(paper.originalLanguage)
  return {
    title: original || target === source ? paper.metadata.title : paper.titles[target] || null,
    abstract: original ? paper.metadata.abstract || null : paper.abstractSummary[target] || null,
    language: original ? source : target,
  }
}

export function paperLanguageName(language: string, displayLanguage: string): string {
  const code = paperLanguage(language)
  return new Intl.DisplayNames([displayLanguage], { type: 'language' }).of(code) || code
}

export function paperOriginalUrl(paper: LiteratureSearchPaper): string | null {
  if (paper.doi) return `https://doi.org/${paper.doi}`
  if (paper.arxiv_id) return `https://arxiv.org/abs/${paper.arxiv_id}`
  return paper.url || null
}

export function paperIdentifier(
  paper: LiteratureSearchPaper
): { kind: 'arxiv' | 'doi'; value: string; url: string } | null {
  if (paper.arxiv_id)
    return { kind: 'arxiv', value: paper.arxiv_id, url: `https://arxiv.org/abs/${paper.arxiv_id}` }
  if (paper.doi) return { kind: 'doi', value: paper.doi, url: `https://doi.org/${paper.doi}` }
  return null
}

export function referencePaper(paper: CuratedPaper, index: number): LiteratureSearchPaper {
  const reference = paper.references[index]
  const existing = CURATED_PAPERS.find(
    (item) => item.metadata.title.toLocaleLowerCase() === reference.title.toLocaleLowerCase()
  )
  if (existing) return existing.metadata
  const citation = reference.citation || reference.title
  const doi = citation.match(/\b10\.\d{4,9}\/[^\s<>]+/i)?.[0].replace(/[.,;]+$/, '') ?? ''
  const arxiv = citation.match(/arxiv\s*:?\s*(\d{4}\.\d{4,5}(?:v\d+)?)/i)?.[1] ?? ''
  return {
    paper_id: doi || arxiv || `${paper.id}:reference:${index}`,
    title: reference.title,
    authors: reference.authors ? [reference.authors] : [],
    year: reference.year ?? null,
    doi,
    arxiv_id: arxiv,
    url: doi
      ? `https://doi.org/${doi}`
      : arxiv
        ? `https://arxiv.org/abs/${arxiv}`
        : `https://scholar.google.com/scholar?q=${encodeURIComponent(reference.title)}`,
    abstract: '',
    venue: reference.venue ?? '',
    citation_count: null,
    tier: null,
    reason: '',
    subtopics_covered: [],
    access: '',
    source: paper.referenceSource,
  }
}

export function filterPapers(
  items: readonly CuratedPaper[],
  options: { topic: string; period: DiscoveryPeriod; interests?: readonly string[]; now: Date }
): CuratedPaper[] {
  const today = Date.UTC(options.now.getFullYear(), options.now.getMonth(), options.now.getDate())
  return items.filter((paper) => {
    const age = (today - Date.parse(paper.published)) / DAY_MILLISECONDS
    return (
      (options.topic === 'all' || paper.topics.includes(options.topic as CuratedTopic)) &&
      age >= 0 &&
      age < PERIOD_DAYS[options.period] &&
      (!options.interests || matchesInterests(paper, options.interests))
    )
  })
}

export function relatedPapers(paper: CuratedPaper): CuratedPaper[] {
  return CURATED_PAPERS.filter(
    (item) => item.id !== paper.id && item.topics.some((topic) => paper.topics.includes(topic))
  ).slice(0, 4)
}

export function relatedEntries(paper: CuratedPaper): {
  metadata: LiteratureSearchPaper
  curated?: CuratedPaper
}[] {
  const curated = relatedPapers(paper)
  if (curated.length) return curated.map((item) => ({ metadata: item.metadata, curated: item }))
  const seen = new Set([paper.metadata.title.trim().toLocaleLowerCase()])
  return paper.references
    .flatMap((reference, index) => {
      const title = reference.title.trim().toLocaleLowerCase()
      if (!title || seen.has(title)) return []
      seen.add(title)
      return [{ metadata: referencePaper(paper, index) }]
    })
    .slice(0, 4)
}

export function addInterest(current: string[], input: string): string[] {
  const value = input.trim().replace(/\s+/g, ' ')
  if (
    !value ||
    value.length > INTEREST_LENGTH ||
    current.length >= INTEREST_LIMIT ||
    current.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())
  )
    return current
  return [...current, value]
}

export function matchesInterests(paper: CuratedPaper, interests: readonly string[]): boolean {
  const searchable = [
    paper.metadata.title,
    ...paper.keywords,
    paper.reading.zh.headline,
    paper.reading.en.headline,
  ]
    .join(' ')
    .toLocaleLowerCase()
  return interests.some(
    (interest) => interest.trim() && searchable.includes(interest.trim().toLocaleLowerCase())
  )
}
