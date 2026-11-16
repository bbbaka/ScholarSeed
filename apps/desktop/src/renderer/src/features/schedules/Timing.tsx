import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock } from 'lucide-react'
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui'
import { DAY_HOURS, HOUR_MINUTES, MONTH_DAYS, type Schedule } from './model'

export function Timing({
  value,
  disabled,
  onChange,
}: {
  value: Schedule
  disabled: boolean
  onChange: (patch: Partial<Schedule>) => void
}): React.JSX.Element | null {
  const { t } = useTranslation('schedules')
  const [open, setOpen] = useState(false)
  const [monthOpen, setMonthOpen] = useState(false)
  const content = useRef<HTMLDivElement>(null)
  const [hour, minute] = value.time.split(':')
  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      content.current
        ?.querySelectorAll<HTMLElement>('[aria-pressed="true"]')
        .forEach((selected) => {
          selected.scrollIntoView({ block: 'center' })
        })
    })
    return () => cancelAnimationFrame(frame)
  }, [open])
  if (value.frequency === 'hourly')
    return (
      <div className="flex items-center gap-[var(--vds-space-2)]">
        <Select
          value={minute}
          onValueChange={(next) => onChange({ time: `00:${next}` })}
          disabled={disabled}
        >
          <SelectTrigger aria-label={t('hourMinute')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HOUR_MINUTES.map((entry) => (
              <SelectItem key={entry} value={String(entry).padStart(2, '0')}>
                {String(entry).padStart(2, '0')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[var(--vds-text-secondary)]">{t('minutes')}</span>
      </div>
    )
  if (
    !(['once', 'daily', 'weekly', 'monthly'] as Schedule['frequency'][]).includes(value.frequency)
  )
    return null
  return (
    <>
      {value.frequency === 'monthly' && (
        <Popover open={monthOpen} onOpenChange={setMonthOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" disabled={disabled} aria-label={t('monthDay')}>
              {t('monthlyOn', { day: value.month_day })}
            </Button>
          </PopoverTrigger>
          <PopoverContent aria-label={t('monthDay')} className="!w-auto">
            <div className="grid grid-cols-7 gap-[var(--vds-space-1)]">
              {MONTH_DAYS.map((day) => (
                <Button
                  key={day}
                  type="button"
                  variant={day === value.month_day ? 'primary' : 'ghost'}
                  aria-pressed={day === value.month_day}
                  onClick={() => {
                    onChange({ month_day: day })
                    setMonthOpen(false)
                  }}
                >
                  {day}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-label={t('time')}
            className="gap-[var(--vds-space-5)] tabular-nums"
            data-testid="schedule-time"
          >
            {value.time}
            <Clock aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent aria-label={t('time')} className="!w-auto">
          <div ref={content} className="grid grid-cols-2 gap-[var(--vds-space-3)]">
            {(
              [
                { label: t('timeHours'), entries: DAY_HOURS, selected: hour, part: 'hour' },
                {
                  label: t('timeMinutes'),
                  entries: HOUR_MINUTES,
                  selected: minute,
                  part: 'minute',
                },
              ] as const
            ).map((column) => (
              <div key={column.part} className="grid min-h-0 gap-[var(--vds-space-2)]">
                <span className="px-[var(--vds-space-3)] text-[var(--vds-text-tertiary)]">
                  {column.label}
                </span>
                <div
                  role="group"
                  aria-label={column.label}
                  className="max-h-[var(--vds-model-menu-list-max-height)] overflow-y-auto overscroll-contain"
                  onKeyDown={(event) => {
                    const controls = Array.from(event.currentTarget.querySelectorAll('button'))
                    const current = controls.indexOf(document.activeElement as HTMLButtonElement)
                    if (current < 0) return
                    const next =
                      event.key === 'ArrowDown'
                        ? Math.min(current + 1, controls.length - 1)
                        : event.key === 'ArrowUp'
                          ? Math.max(current - 1, 0)
                          : event.key === 'Home'
                            ? 0
                            : event.key === 'End'
                              ? controls.length - 1
                              : null
                    if (next === null) return
                    event.preventDefault()
                    controls[next]?.focus()
                    controls[next]?.click()
                  }}
                >
                  {column.entries.map((entry) => {
                    const number = String(entry).padStart(2, '0')
                    const selected = number === column.selected
                    return (
                      <Button
                        type="button"
                        key={entry}
                        variant="ghost"
                        aria-pressed={selected}
                        tabIndex={selected ? 0 : -1}
                        className={`w-full !justify-between gap-[var(--vds-space-5)] tabular-nums ${selected ? '!bg-[var(--vds-surface-hover)]' : ''}`}
                        onClick={() =>
                          onChange({
                            time:
                              column.part === 'hour' ? `${number}:${minute}` : `${hour}:${number}`,
                          })
                        }
                      >
                        {number}
                        <Check aria-hidden="true" className={selected ? '' : 'invisible'} />
                      </Button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
