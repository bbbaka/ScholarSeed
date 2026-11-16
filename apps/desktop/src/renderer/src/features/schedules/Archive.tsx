import React from 'react'
import { useTranslation } from 'react-i18next'

export function ExecutionDeleteDescription({ name }: { name: string }): React.JSX.Element {
  const { t } = useTranslation('schedules')
  return <>{t('deleteExecutionDescription', { name })}</>
}
