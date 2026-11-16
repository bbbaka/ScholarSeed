from datetime import date, datetime, timedelta
from enum import StrEnum
from typing import Any, Mapping
from zoneinfo import ZoneInfo

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from service.scheduling.utils import CRON_LIMIT, cron_date_matches, cron_fields

CARD_TYPE = "scheduled-task"
TITLE_LIMIT = 200
PROMPT_LIMIT = 20000
WEEK_DAYS = 7
SEARCH_DAYS = 366 * 8
MINUTES_PER_HOUR = 60
HOURS_PER_DAY = 24
INTERVAL_LIMIT = 525600
NO_NEXT_RUN = 0
POLL_SECONDS = 5
MISFIRE_SECONDS = 300


class Frequency(StrEnum):
    ONCE = "once"
    INTERVAL = "interval"
    HOURLY = "hourly"
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    CUSTOM = "custom"


class RunState(StrEnum):
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    INTERRUPTED = "interrupted"
    MISSED = "missed"


class Schedule(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=TITLE_LIMIT)
    prompt: str = Field(min_length=1, max_length=PROMPT_LIMIT)
    frequency: Frequency = Frequency.WEEKLY
    time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone: str = Field(min_length=1, max_length=100)
    weekdays: list[int] = Field(default_factory=lambda: [0], max_length=WEEK_DAYS)
    month_day: int = Field(default=1, ge=1, le=31)
    once_date: str = Field(default="", max_length=10)
    interval_minutes: int = Field(default=30, ge=1, le=INTERVAL_LIMIT)
    cron: str = Field(default="", max_length=CRON_LIMIT)

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (KeyError, ValueError) as error:
            raise ValueError("invalid_timezone") from error
        return value

    @model_validator(mode="after")
    def valid_weekdays(self) -> "Schedule":
        if any(day not in range(WEEK_DAYS) for day in self.weekdays):
            raise ValueError("invalid_weekdays")
        self.weekdays = sorted(set(self.weekdays))
        if self.frequency == Frequency.WEEKLY and not self.weekdays:
            raise ValueError("weekdays_required")
        if self.frequency == Frequency.ONCE:
            if date.fromisoformat(self.once_date).isoformat() != self.once_date:
                raise ValueError("invalid_once_date")
        if self.frequency == Frequency.CUSTOM:
            cron_fields(self.cron)
        return self

    def next_after(self, timestamp: float, *, anchor: float | None = None) -> float:
        zone = ZoneInfo(self.timezone)
        if self.frequency == Frequency.INTERVAL:
            interval = self.interval_minutes * MINUTES_PER_HOUR
            start = timestamp if anchor is None else anchor
            return start + (max(0, (timestamp - start) // interval) + 1) * interval
        start = datetime.fromtimestamp(timestamp, zone).date()
        hour, minute = map(int, self.time.split(":"))
        if self.frequency == Frequency.ONCE:
            candidate = datetime.combine(
                date.fromisoformat(self.once_date), datetime.min.time(), zone
            ).replace(hour=hour, minute=minute)
            instant = candidate.timestamp()
            if datetime.fromtimestamp(instant, zone).replace(tzinfo=None) != candidate.replace(
                tzinfo=None
            ):
                raise ValueError("schedule_time_unavailable")
            return instant if instant > timestamp else NO_NEXT_RUN
        fields, either_day = (
            cron_fields(self.cron) if self.frequency == Frequency.CUSTOM else (None, False)
        )
        hours = (
            sorted(fields[1])
            if fields
            else range(HOURS_PER_DAY) if self.frequency == Frequency.HOURLY else [hour]
        )
        minutes = sorted(fields[0]) if fields else [minute]
        for offset in range(SEARCH_DAYS):
            day = start + timedelta(days=offset)
            if self.frequency == Frequency.WEEKLY and day.weekday() not in self.weekdays:
                continue
            if self.frequency == Frequency.MONTHLY and day.day != self.month_day:
                continue
            if fields and not cron_date_matches(day, fields, either_day):
                continue
            for clock_hour in hours:
                for clock_minute in minutes:
                    candidate = datetime(
                        day.year, day.month, day.day, clock_hour, clock_minute, tzinfo=zone
                    )
                    instant = candidate.timestamp()
                    if datetime.fromtimestamp(instant, zone).replace(
                        tzinfo=None
                    ) != candidate.replace(tzinfo=None):
                        continue
                    if instant > timestamp:
                        return instant
        raise ValueError("schedule_time_unavailable")


def validate_card(value: Mapping[str, Any]) -> dict[str, Any]:
    return Schedule.model_validate(value).model_dump(mode="json")
