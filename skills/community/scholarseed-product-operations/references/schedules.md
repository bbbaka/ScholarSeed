# Scheduled tasks

Create schedules only when the user explicitly delegates future one-time or recurring work.
Do not execute the requested future work while setting up its schedule. Use the
current conversation's project; without a project, ask the user to select one.
Never write schedule databases, configuration, cron files or operating-system jobs.

Clarify missing task instructions, frequency, clock time and timezone. Reuse an
explicit timezone from current context; otherwise ask rather than guessing. For
weekly schedules confirm the weekdays. Monthly schedules support days 1–31;
months without the chosen day are skipped. Do not silently change dates. Preserve the user's exact scope and
permissions. Default to a concise task name if none is given.

Once these details are clear, describe the `display-card/publish` contract using
`scholarseed_bridge`, then publish a built-in `scheduled-task` card. The tool
arguments are:

```json
{
  "capability": "display-card",
  "operation": "publish",
  "request": {
    "type": "scheduled-task",
    "content": {
      "data": {
        "name": "Research digest",
        "prompt": "Find new papers on the user's specified topic and summarize them.",
        "frequency": "weekly",
        "time": "09:00",
        "timezone": "Asia/Shanghai",
        "weekdays": [0, 1, 2, 3, 4],
        "month_day": 1
      }
    }
  }
}
```

Replace the example with the agreed instructions and schedule. `frequency` is
`once`, `interval`, `hourly`, `daily`, `weekly`, `monthly` or `custom`; `time` is 24-hour `HH:MM`; `timezone` is an IANA
identifier. Weekdays use Monday=0 through Sunday=6. Include `weekdays` and
`month_day` even when they are not used by the chosen frequency. Name and prompt
must be nonempty, at most 200 and 20000 characters respectively.

Additional fields depend on the frequency:

- `once`: `once_date` is a future local `YYYY-MM-DD` combined with `time` and `timezone`.
- `interval`: `interval_minutes` is an integer from 1 to 525600, starting from save time; include `time: "00:00"` even though the clock is unused.
- `hourly`: use the minute in `time`, for example `00:15` means minute 15 of each hour.
- `custom`: `cron` is a numeric five-field expression (minute, hour, day, month, weekday), at most 128 characters; include `time: "00:00"` though it is unused. Supports lists, ranges, `*`, and steps on stars or ranges. Sunday is 0 or 7; when day and weekday are both restricted, either may match. No names, macros, seconds or commands. Example `0 9 * * 1-5` means weekdays at 09:00, not Monday through Friday indices used by `weekdays`.

Use only the agreed schedule. Do not convert a local date to UTC or guess a Cron expression if the intent is unclear. Calendar schedules skip nonexistent DST times and use only the first occurrence of repeated local times. An expression with no occurrence in the next eight years cannot be saved.

Publishing proposes a schedule, not an active task. Ask the user to review the
card and click **确认创建** (Confirm creation); they can edit its form first.
Never claim that publishing alone saved, enabled or executed it. If publication
fails, explain the error instead of presenting a plain-text imitation as success.

The saved task belongs to this project. Execution uses the configured model and
current permission policy, not elevated permissions. The app must be running and
the computer awake; runs missed by more than five minutes are recorded as missed,
not silently replayed. One-time tasks are disabled after their automatic occurrence, including a missed occurrence. Manual runs do not consume or shift the planned occurrence. Results and failures appear in Scheduled tasks → Run
history; actual run conversations can require user approval. To edit, pause,
delete or run a saved task now, direct the user to that page; this card is only
for creation, not a management API.
