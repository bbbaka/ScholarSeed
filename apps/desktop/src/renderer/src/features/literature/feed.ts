import { createContext } from 'react'

export interface DiscoveryInterest {
  id: string
  label: { zh: string; en: string }
  paperIds: readonly string[]
  matchTerms?: readonly string[]
}

export interface DiscoveryFeed {
  eligible: boolean
  recommendations: readonly {
    paperId: string
    reason: { zh: string; en: string }
  }[]
  interests?: readonly DiscoveryInterest[]
}

export const DiscoveryFeedContext = createContext<DiscoveryFeed>({
  eligible: false,
  recommendations: [],
})

export const HOT_DISCOVERY_PERIODS = ['week', 'month'] as const
export const PERSONAL_FEED_BATCH_SIZE = 3
export const INTEREST_TEXT_LIMIT = 80

export function createInterest(
  value: string,
  interests: readonly DiscoveryInterest[]
): DiscoveryInterest | null {
  const label = value.trim().replace(/\s+/g, ' ')
  if (!label || label.length > INTEREST_TEXT_LIMIT) return null
  const normalized = label.toLocaleLowerCase()
  const existing = interests.find((interest) =>
    Object.values(interest.label).some((text) => text.toLocaleLowerCase() === normalized)
  )
  if (existing) return existing
  const matching = interests.filter((interest) =>
    [...Object.values(interest.label), ...(interest.matchTerms ?? [])].some((term) =>
      normalized.includes(term.toLocaleLowerCase())
    )
  )
  return {
    id: `custom:${normalized}`,
    label: { zh: label, en: label },
    paperIds: [...new Set(matching.flatMap((interest) => [...interest.paperIds]))],
  }
}

export function recommendationBatch(
  feed: DiscoveryFeed,
  batch: number,
  hidden: readonly string[],
  selectedInterests: readonly string[] = []
) {
  const interests =
    feed.interests?.filter((interest) => selectedInterests.includes(interest.id)) ?? []
  const matches = new Set(interests.flatMap((interest) => [...interest.paperIds]))
  const available = feed.recommendations.filter(
    (entry) => !hidden.includes(entry.paperId) && (!interests.length || matches.has(entry.paperId))
  )
  const count = Math.ceil(available.length / PERSONAL_FEED_BATCH_SIZE)
  const start = count ? (batch % count) * PERSONAL_FEED_BATCH_SIZE : 0
  return {
    entries: available.slice(start, start + PERSONAL_FEED_BATCH_SIZE),
    canRefresh: count > 1,
  }
}

export function visibleFeedMode(mode: string, _feed: DiscoveryFeed): 'hot' | 'personal' {
  return mode === 'personal' ? 'personal' : 'hot'
}
