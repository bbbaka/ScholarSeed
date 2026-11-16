import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DAY_HOURS,
  EDITOR_FREQUENCIES,
  HOUR_MINUTES,
  newSchedule,
  schedulePayload,
  scheduleValid,
  validCron,
  validDate,
  type Schedule,
} from './model.ts'

test('form frequencies omit custom plans and time choices cover each minute', () => {
  assert.deepEqual(EDITOR_FREQUENCIES, ['once', 'interval', 'hourly', 'daily', 'weekly', 'monthly'])
  assert.deepEqual(
    DAY_HOURS,
    Array.from({ length: 24 }, (_, index) => index)
  )
  assert.deepEqual(
    HOUR_MINUTES,
    Array.from({ length: 60 }, (_, index) => index)
  )
  assert.equal(newSchedule().timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
})

test('task configuration survives serialization without sharing references or permission settings', () => {
  const value: Schedule = {
    ...newSchedule(),
    name: 'Plan',
    prompt: 'Mock',
    execution: {
      model_key: 'model-a',
      reasoning_effort: 'medium',
      references: [{ type: 'skill', id: 'review', path: '/mock/review', title: 'Review' }],
      contexts: [{ kind: 'literature', source_id: 'paper', label: 'Paper', origin: 'explicit' }],
    },
  }
  assert.equal(scheduleValid(value), true)
  const payload = schedulePayload({
    ...value,
    execution: { ...value.execution!, permission: 'auto' },
  } as Schedule)
  assert.deepEqual(payload.execution, value.execution)
  payload.execution!.references[0].title = 'Changed'
  assert.equal(value.execution!.references[0].title, 'Review')
  for (const execution of [
    null,
    {},
    { ...value.execution, references: null },
    { ...value.execution, model_key: '' },
  ]) {
    assert.equal(scheduleValid({ ...value, execution } as Schedule), false)
  }
})

test('schedule validation requires instructions and valid calendar fields', () => {
  const empty = newSchedule()
  assert.equal(scheduleValid(empty), false)
  const valid = { ...empty, name: 'Check', prompt: 'Reply once', timezone: 'Asia/Shanghai' }
  assert.equal(scheduleValid(valid), true)
  for (const patch of [
    { weekdays: [] },
    { weekdays: [7] },
    { time: '24:00' },
    { month_day: 32 },
    { month_day: 1.5 },
    { timezone: 'invalid' },
    { prompt: ' ' },
  ]) {
    assert.equal(scheduleValid({ ...valid, ...patch }), false)
  }
  assert.equal(scheduleValid({ ...valid, frequency: 'daily', weekdays: [] }), true)
})

test('extended schedule fields validate and survive the payload', () => {
  const base = { ...newSchedule(), name: 'Check', prompt: 'Reply once' }
  for (const frequency of [
    'once',
    'interval',
    'hourly',
    'daily',
    'weekly',
    'monthly',
    'custom',
  ] as const) {
    const schedule = {
      ...base,
      frequency,
      once_date: '2026-11-07',
      interval_minutes: 30,
      cron: '0 9 * * 1-5',
      month_day: 31,
    }
    assert.equal(scheduleValid(schedule), true)
    assert.deepEqual(schedulePayload(schedule), schedule)
  }
  assert.equal(scheduleValid({ ...base, frequency: 'interval', interval_minutes: 0 }), false)
  assert.equal(scheduleValid({ ...base, frequency: 'interval', interval_minutes: 1.5 }), false)
  assert.equal(validDate('2026-02-30'), false)
  assert.equal(validDate('2028-02-29'), true)
  for (const cron of ['0 9 * * 1-5', '*/30 * * * *', '0 0 1,15 * 0,7', '0-59/5 9-17 * * *'])
    assert.equal(validCron(cron), true)
  for (const cron of [
    '60 9 * * *',
    '*/0 * * * *',
    '0 9 * * * command',
    '0 9 32 * *',
    '0 9 * * 8',
    '0 9 * *',
    '0/2 * * * *',
  ])
    assert.equal(validCron(cron), false)
})

test('schedule payload strips server metadata and trims user text', () => {
  const input = { ...newSchedule(), name: ' Check ', prompt: ' Reply ', id: 'task', revision: 3 }
  const payload = schedulePayload(input)
  assert.equal(payload.name, 'Check')
  assert.equal(payload.prompt, 'Reply')
  assert.equal('id' in payload, false)
  assert.equal('revision' in payload, false)
})
