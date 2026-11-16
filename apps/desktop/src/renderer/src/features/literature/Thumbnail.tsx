import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import psychologicalDepth from '../../assets/papers/psydepth.png'
import magicState from '../../assets/papers/magic.png'
import type { LiteratureSearchPaper } from '../../contracts/literature'

const FIGURES: Record<string, { image: string; source: string }> = {
  '2611.09061': { image: psychologicalDepth, source: 'https://arxiv.org/html/2611.09061v1#S1.F1' },
  '2512.13908': { image: magicState, source: 'https://arxiv.org/html/2512.13908v1#S1.F1' },
}

export function PaperThumbnail({
  paper,
  expanded = false,
}: {
  paper: LiteratureSearchPaper
  expanded?: boolean
}): React.JSX.Element | null {
  const { t } = useTranslation('literature')
  const [failed, setFailed] = useState(false)
  const figure = FIGURES[paper.arxiv_id ?? '']
  if (!figure || failed) return null
  return (
    <figure
      className={
        expanded
          ? 'm-0 w-full bg-[var(--vds-bg-white-default)] p-[var(--vds-space-4)]'
          : 'pointer-events-none relative order-last m-0 w-1/4 max-w-[var(--vds-discovery-card-min)] shrink-0 self-center bg-[var(--vds-bg-white-default)] p-[var(--vds-space-4)]'
      }
      data-testid="paper-thumbnail"
    >
      <img
        src={figure.image}
        alt={t('discovery.figureAlt', { title: paper.title })}
        loading="lazy"
        className="aspect-video w-full object-contain"
        onError={() => setFailed(true)}
      />
      <figcaption className="mt-[var(--vds-space-2)] line-clamp-2 text-[length:var(--vds-font-caption)] text-[var(--vds-text-tertiary)]">
        {t('discovery.figureCredit')}
        <span className="sr-only">{figure.source}</span>
      </figcaption>
    </figure>
  )
}
