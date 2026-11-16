import type { DiscoveryFeed } from '../src/renderer/src/features/literature/feed'

export const DISCOVERY_COLD_START: DiscoveryFeed = {
  eligible: false,
  interests: [
    {
      id: 'reasoning',
      label: { zh: '推理模型', en: 'Reasoning models' },
      paperIds: ['psydepth', 'rpeg', 'tmi', 'leandojo2'],
      matchTerms: ['强化学习', 'reinforcement learning', '大语言模型', 'large language models'],
    },
    {
      id: 'agents',
      label: { zh: '科研智能体', en: 'Research agents' },
      paperIds: ['autodna', 'tmi', 'leandojo2'],
      matchTerms: ['多智能体', 'multi-agent'],
    },
    { id: 'proofs', label: { zh: '自动化证明', en: 'Automated proofs' }, paperIds: ['leandojo2'] },
    { id: 'experiments', label: { zh: '实验自动化', en: 'Lab automation' }, paperIds: ['autodna'] },
    {
      id: 'astronomy',
      label: { zh: '系外行星探测', en: 'Exoplanet detection' },
      paperIds: ['flip'],
    },
  ],
  recommendations: ['flip', 'autodna', 'psydepth', 'leandojo2', 'tmi', 'rpeg'].map((paperId) => ({
    paperId,
    reason: { zh: '探索不同研究方向', en: 'Explore different research directions' },
  })),
}
