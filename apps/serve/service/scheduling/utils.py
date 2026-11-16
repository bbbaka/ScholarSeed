import re
from datetime import date

CRON_LIMIT = 128
CRON_BOUNDS = ((0, 59), (0, 23), (1, 31), (1, 12), (0, 7))


def cron_fields(expression: str) -> tuple[list[set[int]], bool]:
    parts = expression.split()
    if len(expression) > CRON_LIMIT or len(parts) != len(CRON_BOUNDS):
        raise ValueError("invalid_cron")
    fields = []
    for part, (minimum, maximum) in zip(parts, CRON_BOUNDS):
        values = set()
        for entry in part.split(","):
            if not re.fullmatch(r"(?:\*|[0-9]+(?:-[0-9]+)?)(?:/[0-9]+)?", entry):
                raise ValueError("invalid_cron")
            base, separator, stride = entry.partition("/")
            step = int(stride) if separator else 1
            if base == "*":
                first, last = minimum, maximum
            elif "-" in base:
                first, last = map(int, base.split("-"))
            else:
                first = last = int(base)
                if separator:
                    raise ValueError("invalid_cron")
            if not minimum <= first <= last <= maximum or not 1 <= step <= maximum + 1:
                raise ValueError("invalid_cron")
            values.update(range(first, last + 1, step))
        fields.append(values)
    fields[-1] = {weekday % 7 for weekday in fields[-1]}
    return fields, not (parts[2].startswith("*") or parts[4].startswith("*"))


def cron_date_matches(day: date, fields: list[set[int]], either_day: bool) -> bool:
    month_day = day.day in fields[2]
    week_day = (day.weekday() + 1) % 7 in fields[4]
    return day.month in fields[3] and (
        (month_day or week_day) if either_day else (month_day and week_day)
    )
