import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import {
  addInterest,
  CURATED_PAPERS,
  CURATED_TOPICS,
  INTEREST_LENGTH,
  INTEREST_LIMIT,
  matchesInterests,
  filterPapers,
  relatedPapers,
  relatedEntries,
  paperIdentifier,
  paperOriginalUrl,
  referencePaper,
  paperText,
  paperLanguageName,
} from './recommendations.ts'
import { searchPapersBibtex } from './result.ts'

test('first reading example supplies structured references and explicitly simulated citation provenance', () => {
  const paper = CURATED_PAPERS.find((paper) => paper.id === 'psydepth')!
  assert.deepEqual(
    paper.evidence?.map((item) => item.page),
    [1, 4, 6]
  )
  assert.equal(paper.references.length, 35)
  for (const [index, reference] of paper.references.entries()) {
    assert.ok(reference.authors)
    assert.ok(reference.year)
    assert.notEqual(reference.title, reference.citation)
    assert.equal(referencePaper(paper, index).title, reference.title)
    assert.equal(reference.citations?.simulated, true)
    assert.equal(reference.citations?.source, 'Semantic Scholar')
    assert.equal(reference.citations?.updated, '2026-11-12')
  }
  assert.equal(paper.citations?.simulated, true)
  for (const item of relatedEntries(paper))
    assert.equal(paper.relatedCitations?.[item.metadata.paper_id]?.simulated, true)
  assert.equal(CURATED_PAPERS.find((paper) => paper.id === 'magic')?.citations, undefined)
})

test('paper content separates interface language from arbitrary original languages', () => {
  for (const originalLanguage of ['ja', 'es', 'ru', 'zh', 'en']) {
    const paper = {
      ...CURATED_PAPERS[0],
      originalLanguage,
      metadata: {
        ...CURATED_PAPERS[0].metadata,
        title: 'Source title',
        abstract: 'Source abstract',
      },
      titles: { zh: '中文译名', en: 'Translated title' },
      abstractSummary: { zh: '中文速读摘要', en: 'English reading summary' },
    }
    assert.equal(
      paperText(paper, 'en-US').title,
      originalLanguage === 'en' ? 'Source title' : 'Translated title'
    )
    assert.equal(paperText(paper, 'en-US').abstract, 'English reading summary')
    assert.deepEqual(paperText(paper, 'en-US', true), {
      title: 'Source title',
      abstract: 'Source abstract',
      language: originalLanguage,
    })
    assert.equal(paperText(paper, 'fr').abstract, null)
    assert.equal(paperText(paper, 'fr').title, null)
    assert.ok(paperLanguageName(originalLanguage, 'en'))
  }
})

test('missing originals never substitute an editorial summary', () => {
  assert.equal(paperText(CURATED_PAPERS[0], 'en', true).abstract, null)
})

test('all curated cases have English editorial copy without Chinese placeholders', () => {
  for (const paper of CURATED_PAPERS) {
    assert.equal(paper.originalLanguage, 'en')
    assert.ok(paper.titles.zh)
    assert.doesNotMatch(JSON.stringify(paper.reading.en), /\p{Script=Han}/u, paper.id)
    for (const metric of paper.metrics) {
      assert.doesNotMatch(
        `${metric.en} ${metric.sourceEn} ${metric.valueEn || metric.value}`,
        /\p{Script=Han}/u,
        paper.id
      )
    }
  }
})

test('related original links prefer DOI, then arXiv, then the supplied source', () => {
  const metadata = CURATED_PAPERS[0].metadata
  assert.equal(
    paperOriginalUrl({ ...metadata, doi: '10.1234/example', arxiv_id: '2501.00001' }),
    'https://doi.org/10.1234/example'
  )
  assert.equal(
    paperOriginalUrl({ ...metadata, doi: '', arxiv_id: '2501.00001' }),
    'https://arxiv.org/abs/2501.00001'
  )
  assert.equal(
    paperOriginalUrl({
      ...metadata,
      doi: '',
      arxiv_id: '',
      url: 'https://example.org/paper',
    }),
    'https://example.org/paper'
  )
  assert.equal(paperOriginalUrl({ ...metadata, doi: '', arxiv_id: '', url: undefined }), null)
})

test('every curated paper has related reading backed by curated cases or its bibliography', () => {
  for (const paper of CURATED_PAPERS) {
    const entries = relatedEntries(paper)
    assert.ok(entries.length > 0, paper.id)
    assert.ok(entries.length <= 4)
    assert.equal(new Set(entries.map((entry) => entry.metadata.title)).size, entries.length)
    for (const entry of entries) {
      assert.notEqual(entry.metadata.title, paper.metadata.title)
      if (entry.curated) assert.ok(relatedPapers(paper).includes(entry.curated))
      else assert.ok(paper.references.some((reference) => reference.title === entry.metadata.title))
    }
  }
})

test('related fallback excludes self and duplicate references and tolerates missing data', () => {
  const paper = CURATED_PAPERS.find((item) => item.id === 'flip')!
  assert.deepEqual(relatedEntries({ ...paper, references: [] }), [])
  const entries = relatedEntries({
    ...paper,
    references: [
      { title: paper.metadata.title },
      { title: 'Related study' },
      { title: 'Related study' },
    ],
  })
  assert.equal(entries.length, 1)
  assert.equal(entries[0].metadata.title, 'Related study')
})

test('reader identifiers link to DOI and arXiv instead of displaying only venue details', () => {
  const journal = CURATED_PAPERS.find((paper) => paper.id === 'flip')!
  assert.deepEqual(paperIdentifier(journal.metadata), {
    kind: 'doi',
    value: journal.metadata.doi,
    url: `https://doi.org/${journal.metadata.doi}`,
  })
  const preprint = CURATED_PAPERS.find((paper) => paper.metadata.arxiv_id)!
  assert.deepEqual(paperIdentifier(preprint.metadata), {
    kind: 'arxiv',
    value: preprint.metadata.arxiv_id,
    url: `https://arxiv.org/abs/${preprint.metadata.arxiv_id}`,
  })
  assert.equal(paperIdentifier({ ...journal.metadata, doi: '', arxiv_id: '' }), null)
})

test('reference admission preserves available citation data without inventing missing metadata', () => {
  const parent = {
    ...CURATED_PAPERS[0],
    references: [{ title: 'Unresolved citation' }, { title: 'Example arXiv:2501.12948' }],
  }
  const first = referencePaper(parent, 0)
  assert.equal(first.title, 'Unresolved citation')
  assert.equal(first.abstract, '')
  assert.equal(first.year, null)
  assert.equal(first.doi, '')
  assert.equal(first.url, 'https://scholar.google.com/scholar?q=Unresolved%20citation')
  assert.equal(referencePaper(parent, 1).url, 'https://arxiv.org/abs/2501.12948')
})

test('custom interests trim, deduplicate and enforce bounded input', () => {
  assert.deepEqual(addInterest([], '  protein  folding '), ['protein folding'])
  assert.deepEqual(addInterest(['AI'], 'ai'), ['AI'])
  assert.deepEqual(addInterest([], '  '), [])
  assert.deepEqual(addInterest([], 'a'.repeat(INTEREST_LENGTH + 1)), [])
  const full = Array.from({ length: INTEREST_LIMIT }, (_, index) => String(index))
  assert.equal(addInterest(full, 'new'), full)
})

test('curated interests match bilingual metadata and leave unknown directions empty', () => {
  assert.ok(CURATED_PAPERS.filter((paper) => matchesInterests(paper, ['气候'])).length > 0)
  assert.ok(CURATED_PAPERS.filter((paper) => matchesInterests(paper, ['量子'])).length > 0)
  assert.ok(
    CURATED_PAPERS.filter((paper) => matchesInterests(paper, ['Language Models'])).length > 0
  )
  assert.equal(CURATED_PAPERS.filter((paper) => matchesInterests(paper, ['考古学'])).length, 0)
  assert.equal(matchesInterests(CURATED_PAPERS[0], []), false)
})

test('real records export verified identifiers without importing editorial copy as an abstract', () => {
  const bibtex = searchPapersBibtex(CURATED_PAPERS.map((paper) => paper.metadata))
  for (const paper of CURATED_PAPERS) {
    assert.ok(CURATED_TOPICS.includes(paper.topic))
    assert.ok(paper.metadata.url?.startsWith('https://'))
    assert.ok(paper.metadata.doi && bibtex.includes(paper.metadata.doi))
    assert.equal(paper.metadata.abstract, '')
    assert.equal(paper.reading.zh.steps.length, 4)
  }
  assert.ok(!bibtex.includes('abstract ='))
  assert.equal(
    new Set(CURATED_PAPERS.map((paper) => paper.metadata.paper_id)).size,
    CURATED_PAPERS.length
  )
})

test('bundled figures are present and the original SVG has no active or external content', () => {
  for (const file of ['alphafold.png', 'reflexion.svg', 'graphcast.png']) {
    assert.ok(existsSync(new URL(`../../assets/papers/${file}`, import.meta.url)))
  }
  const svg = readFileSync(new URL('../../assets/papers/reflexion.svg', import.meta.url), 'utf8')
  assert.doesNotMatch(svg, /<(script|foreignObject|image)\b|(?:href|src)=["']https?:/i)
})

test('retained original figures have attribution and bilingual guidance', () => {
  for (const paper of CURATED_PAPERS) {
    if (!paper.figure) continue
    assert.ok(paper.figure.source.startsWith('https://'))
    assert.equal(paper.figure.license, 'CC BY 4.0')
    assert.ok(paper.figure.credit.length > 0)
    for (const language of ['zh', 'en'] as const) {
      assert.ok(paper.figure[language].alt.length > 0)
      assert.equal(paper.figure[language].guide.length, 3)
      assert.ok(paper.figure[language].reason.length > 0)
    }
  }
})

test('publication windows use the current local date and compose with fields and interests', () => {
  const now = new Date(2026, 10, 9)
  const options = { now, topic: 'all', period: 'week' as const }
  assert.deepEqual(
    filterPapers(CURATED_PAPERS, options).map((paper) => paper.id),
    ['flip', 'autodna', 'psydepth', 'tmi', 'ecofm', 'leandojo2', 'rpeg', 'numbers']
  )
  assert.equal(filterPapers(CURATED_PAPERS, { ...options, topic: 'life' }).length, 1)
  assert.equal(filterPapers(CURATED_PAPERS, { ...options, interests: [] }).length, 0)
  assert.equal(
    filterPapers(CURATED_PAPERS, { ...options, period: 'month' }).length,
    CURATED_PAPERS.length
  )
  const first = CURATED_PAPERS[0]
  assert.equal(filterPapers([{ ...first, published: '2026-11-10' }], options).length, 0)
  assert.equal(filterPapers([{ ...first, published: '2026-11-02' }], options).length, 0)
  assert.equal(filterPapers([{ ...first, published: '2026-11-03' }], options).length, 1)
})

test('reader data has explicit sources, bilingual summaries and non-fabricated related records', () => {
  for (const paper of CURATED_PAPERS) {
    assert.match(paper.published, /^\d{4}-\d{2}-\d{2}$/)
    assert.ok(paper.pdf.startsWith('https://'))
    assert.ok(paper.abstractSummary.zh && paper.abstractSummary.en)
    for (const reference of paper.references) assert.ok(reference.title.length > 0)
    for (const related of relatedPapers(paper)) {
      assert.notEqual(related.id, paper.id)
      assert.ok(related.topics.some((topic) => paper.topics.includes(topic)))
    }
  }
})

test('prototype edition retains all cases, twelve fields and inclusive date windows', () => {
  assert.equal(CURATED_PAPERS.length, 18)
  assert.equal(CURATED_TOPICS.length, 12)
  const options = { now: new Date(2026, 10, 9), topic: 'all' }
  assert.equal(filterPapers(CURATED_PAPERS, { ...options, period: 'today' }).length, 3)
  assert.equal(filterPapers(CURATED_PAPERS, { ...options, period: 'month' }).length, 18)
  const crossField = filterPapers(CURATED_PAPERS, { ...options, period: 'week', topic: 'ai' })
  assert.ok(crossField.some((paper) => paper.id === 'autodna'))
  assert.ok(crossField.some((paper) => paper.id === 'leandojo2'))
})

test('every prototype case includes its complete verified bibliography inline', () => {
  const counts = [49, 51, 53, 63, 35, 23, 44, 27, 54, 150, 13, 63, 17, 50, 50, 79, 108, 51]
  assert.deepEqual(
    CURATED_PAPERS.map((paper) => paper.id),
    [
      'magic',
      'flip',
      'autodna',
      'subseasonal',
      'psydepth',
      'tmi',
      'biosenter',
      'phenom',
      'spinqubit',
      'ecofm',
      'leandojo2',
      'rpeg',
      'lfd',
      'sodium',
      'cigs',
      'electrocat',
      'numbers',
      'embodied',
    ]
  )
  CURATED_PAPERS.forEach((paper, index) => {
    assert.equal(paper.references.length, counts[index])
    assert.equal(paper.referenceTotal, counts[index])
    assert.equal(paper.referenceComplete, true)
    assert.ok(paper.referenceSource.startsWith('https://'))
    assert.equal(paper.reading.zh.flow.length, 4)
    for (const reference of paper.references) {
      assert.ok(reference.citation && reference.citation.length > 30)
      assert.doesNotMatch(reference.citation, /Cited by:|External Links:|Article in Press/)
    }
  })
  const electrocat = CURATED_PAPERS.find((paper) => paper.id === 'electrocat')!
  assert.equal(electrocat.metadata.doi, '10.1038/s41467-026-78335-w')
  assert.match(electrocat.references[0].title, /bandit optimization/)
})
