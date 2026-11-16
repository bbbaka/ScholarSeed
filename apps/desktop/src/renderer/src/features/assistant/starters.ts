import {
  LITERATURE_REVIEW_TASK_TYPE,
  PRECISE_SEARCH_TASK_TYPE,
  RESEARCH_IDEA_TASK_TYPE,
  type ProductTaskType,
} from '../../api.ts'
export {
  resolveTaskStarterSkill,
  type TaskStarterSkillFailure,
  type TaskStarterSkillReference,
} from '../../skill.ts'

export const TASK_STARTER_FIELD = '[[topic]]'

export const AI_TASK_STARTERS = Object.freeze([
  {
    titleKey: 'panel.searchTitle',
    descriptionKey: 'panel.searchDescription',
    promptKey: 'panel.searchPrompt',
    fieldLabelKey: 'panel.searchField',
    fieldPlaceholderKey: 'panel.searchExample',
    skillName: 'precise-literature-search',
    taskType: PRECISE_SEARCH_TASK_TYPE,
  },
  {
    titleKey: 'panel.reviewTitle',
    descriptionKey: 'panel.reviewDescription',
    promptKey: 'panel.reviewPrompt',
    fieldLabelKey: 'panel.directionField',
    fieldPlaceholderKey: 'panel.reviewExample',
    skillName: 'literature-review',
    taskType: LITERATURE_REVIEW_TASK_TYPE,
  },
  {
    titleKey: 'panel.ideasTitle',
    descriptionKey: 'panel.ideasDescription',
    promptKey: 'panel.ideasPrompt',
    fieldLabelKey: 'panel.directionField',
    fieldPlaceholderKey: 'panel.ideasExample',
    skillName: 'research-idea-partner',
    taskType: RESEARCH_IDEA_TASK_TYPE,
  },
] as const satisfies ReadonlyArray<{
  titleKey: string
  descriptionKey: string
  promptKey: string
  fieldLabelKey: string
  fieldPlaceholderKey: string
  skillName: string
  taskType?: ProductTaskType
}>)

export const AI_TASK_STARTER_SKILL_NAMES: ReadonlySet<string> = new Set(
  AI_TASK_STARTERS.map((starter) => starter.skillName)
)
