import type { TFunction } from 'i18next'
import type { Schedule, ScheduledRun } from './model'

export function scheduleLabels(translate: TFunction<'schedules'>) {
  return {
    days: [
      translate('days.0'),
      translate('days.1'),
      translate('days.2'),
      translate('days.3'),
      translate('days.4'),
      translate('days.5'),
      translate('days.6'),
    ],
    frequencies: {
      once: translate('frequencyLabels.once'),
      interval: translate('frequencyLabels.interval'),
      hourly: translate('frequencyLabels.hourly'),
      daily: translate('frequencyLabels.daily'),
      weekly: translate('frequencyLabels.weekly'),
      monthly: translate('frequencyLabels.monthly'),
      custom: translate('frequencyLabels.custom'),
    },
    statuses: {
      running: translate('statuses.running'),
      completed: translate('statuses.completed'),
      failed: translate('statuses.failed'),
      interrupted: translate('statuses.interrupted'),
      missed: translate('statuses.missed'),
    } satisfies Record<ScheduledRun['status'], string>,
    examples: {
      papers: {
        name: translate('examples.papers.name'),
        prompt: translate('examples.papers.prompt'),
        description: translate('examples.papers.description'),
        cadence: translate('examples.papers.cadence'),
      },
      report: {
        name: translate('examples.report.name'),
        prompt: translate('examples.report.prompt'),
        description: translate('examples.report.description'),
        cadence: translate('examples.report.cadence'),
      },
      files: {
        name: translate('examples.files.name'),
        prompt: translate('examples.files.prompt'),
        description: translate('examples.files.description'),
        cadence: translate('examples.files.cadence'),
      },
    },
  }
}

export function scheduleCadence(value: Schedule, translate: TFunction<'schedules'>): string {
  const labels = scheduleLabels(translate)
  if (value.frequency === 'once') return `${value.once_date} ${value.time}`
  if (value.frequency === 'interval')
    return translate('everyMinutes', { minutes: value.interval_minutes ?? 30 })
  if (value.frequency === 'hourly')
    return translate('hourlyAt', { minute: value.time.split(':')[1] })
  if (value.frequency === 'custom') return value.cron ?? ''
  const frequency =
    value.frequency === 'weekly' && Array.isArray(value.weekdays)
      ? value.weekdays.map((day) => labels.days[day]).join(' / ')
      : value.frequency === 'monthly'
        ? translate('monthlyOn', { day: value.month_day })
        : labels.frequencies.daily
  return `${frequency} ${value.time}`
}
