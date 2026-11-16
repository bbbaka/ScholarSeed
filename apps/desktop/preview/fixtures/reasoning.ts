export const REASONING_SEARCH = {
  queries: ['推理模型', 'reasoning models', '最近推理模型有哪些值得关注的进展？'],
  papers: [
    { id: 'psydepth', reason: '模拟相关性：比较推理与非推理模型的创作表现，帮助了解推理能力的适用边界。', reasonEn: 'Mock relevance: compares creative writing by reasoning and non-reasoning models to explore the limits of reasoning capabilities.' },
    { id: 'rpeg', reason: '模拟相关性：关注推理语言模型的强化学习训练流程、扩展能力与训练成本。', reasonEn: 'Mock relevance: examines reinforcement learning workflows, scalability and training costs for reasoning language models.' },
    { id: 'leandojo2', reason: '模拟相关性：展示语言模型在形式化定理证明中的训练、证明搜索与工具应用。', reasonEn: 'Mock relevance: covers language-model training, proof search and tooling for formal theorem proving.' },
  ],
} as const
