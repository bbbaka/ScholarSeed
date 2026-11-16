import type { MemoryEntry } from '../../src/renderer/src/features/memory/context'

export const MEMORY_REVIEW_SESSIONS = [
  {
    id: 'preview-session',
    title: 'CPS 综述 · 有记忆更新',
    user: '我熟悉整数规划，正在学习 Python，编程操作请给具体步骤。这篇综述聚焦 CPS/HCPS 体系架构。方案先讨论再执行，回答简洁，多用表格。之后补充 ACM TCPS 和 CPS 专门会议的论文。',
    answer:
      '已将综述范围收敛到体系架构。下一步按系统分层与人机协同补充检索，形成比较表后与你确认。',
  },
  {
    id: 'preview-session-memory-empty',
    title: '术语解释 · 无记忆更新',
    user: '请解释一下 cyber-physical system 是什么意思。',
    answer:
      '信息物理系统把计算、通信与现实中的物理设备结合起来。例如，工厂传感器采集状态，软件分析并控制机器，形成持续反馈。',
  },
  {
    id: 'preview-session-memory-many',
    title: '综述范围确认 · 大量更新',
    user: '我们把综述的范围、比较标准与后续安排一起整理下来，后续按这些要求继续。',
    answer:
      '已整理本轮确认的研究关注与后续安排。右侧可查看本次更新，完整条目按维度分组；先确认综述提纲，再继续补充文献与证据。',
  },
] as const

const focus = [
  '以系统体系架构为主线，比较不同 CPS/HCPS 分层方案。',
  '区分物理层、网络层、计算层与人机交互层的职责。',
  '关注人参与控制回路时的决策分工与反馈机制。',
  '比较集中式、分布式与边云协同三类架构。',
  '将实时性与确定性作为架构比较的重要指标。',
  '区分模型驱动和数据驱动方法各自的适用条件。',
  '关注系统的可验证性及形式化建模方法。',
  '工业制造作为主要应用场景，交通场景用于补充比较。',
  '保留数字孪生与 CPS 的概念边界，避免混用。',
  '关注系统运行中的不确定性及其传播方式。',
  '比较不同架构在安全与可靠性上的设计取舍。',
  '关注跨系统互操作性与开放接口。',
  '对照工业标准分析学术模型的落地条件。',
  '区分已有实验验证与仅有理论构想的架构。',
  '优先关注能明确描述系统边界与层间依赖的研究。',
  '补充 HCPS 中人的认知与行为建模工作。',
  '区分数据采集、状态估计、决策与执行环节。',
  '记录不同研究对 CPS 和 HCPS 术语定义的差异。',
]
const progress = [
  '先完成架构分类，再整理代表性论文的证据表。',
  '下一轮检索加入 ACM TCPS 和 CPS 专门会议。',
  '优先补全 Edward Lee 相关的理论与报告。',
  '比较表记录问题、方法、假设、证据与局限。',
  '论文中的结论保留页码与对应原文来源。',
  '未读全文的文献暂不作为关键结论依据。',
  '把标准、白皮书与学术论文分开标记。',
  '综述提纲确认后，再进入正文撰写。',
  '暂不安排实验，先完成证据核查与方案讨论。',
  '有分歧的术语先记录双方定义，不直接合并。',
  '整理完架构比较表后，列出待确认的问题清单。',
  '下一次讨论从人机协同架构的分类标准继续。',
]
export const MEMORY_REVIEW_ENTRIES: MemoryEntry[] = [
  ...focus.map((content, index) => ({ content, dimension: 'focus' as const, index })),
  ...progress.map((content, index) => ({ content, dimension: 'progress' as const, index })),
].map(({ content, dimension, index }) => ({
  id: `many-${dimension}-${index}`,
  dimension,
  content,
  change: 'added',
  sessionId: MEMORY_REVIEW_SESSIONS[2].id,
  source: '本次会话 · 用户确认',
  updatedAt: '2026-11-13T02:24:00Z',
}))
