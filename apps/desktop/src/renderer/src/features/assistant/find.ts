export function findOccurrences(
  text: string,
  query: string
): Array<{ start: number; end: number }> {
  if (!query) return []
  const pattern = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu')
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
}

export function nextOccurrence(current: number, direction: number, count: number): number {
  return count ? (current + direction + count) % count : 0
}

export function conversationMatches(root: HTMLElement, query: string): Range[] {
  if (!query) return []
  const ranges: Range[] = []
  for (const scope of root.querySelectorAll<HTMLElement>('[data-conversation-search-text]')) {
    const nodes: Array<{ node: Text; start: number; end: number }> = []
    let text = ''
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent || parent.closest('button, [aria-hidden="true"], [hidden], script, style'))
          return NodeFilter.FILTER_REJECT
        if (!parent.getClientRects().length || getComputedStyle(parent).visibility === 'hidden')
          return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      },
    })
    while (walker.nextNode()) {
      const node = walker.currentNode as Text
      nodes.push({ node, start: text.length, end: text.length + node.length })
      text += node.data
    }
    for (const match of findOccurrences(text, query)) {
      const start = nodes.find((entry) => entry.end > match.start)
      const end = nodes.find((entry) => entry.end >= match.end)
      if (!start || !end) continue
      const range = document.createRange()
      range.setStart(start.node, match.start - start.start)
      range.setEnd(end.node, match.end - end.start)
      ranges.push(range)
    }
  }
  return ranges
}
