from __future__ import annotations

import time
from pathlib import Path
from uuid import uuid4

from service.paths import PROJECT_DB_RELATIVE
from service.persistence.project import transaction
from service.platform.content import ContentPort
from service.scheduling.model import MISFIRE_SECONDS, NO_NEXT_RUN, RunState, Schedule

TASK_TABLE = "scheduled_tasks"
RUN_TABLE = "scheduled_runs"
CONVERSATION_TABLE = "scheduled_conversations"
HISTORY_LIMIT = 200


class ScheduleConflict(ValueError):
    pass


class ScheduleStore:
    def __init__(self, content: ContentPort) -> None:
        self.content = content

    def database(self, project_id: str):
        database = self.content.resolve(project_id, PROJECT_DB_RELATIVE)
        with transaction(database) as connection:
            connection.execute(f"""CREATE TABLE IF NOT EXISTS {TASK_TABLE} (
                id TEXT PRIMARY KEY, owner TEXT NOT NULL, actor TEXT NOT NULL,
                body TEXT NOT NULL, enabled INTEGER NOT NULL, next_at REAL NOT NULL,
                revision INTEGER NOT NULL, created_at REAL NOT NULL
            )""")
            connection.execute(f"""CREATE TABLE IF NOT EXISTS {RUN_TABLE} (
                id TEXT PRIMARY KEY, task_id TEXT NOT NULL, owner TEXT NOT NULL,
                name TEXT NOT NULL, started_at REAL NOT NULL, finished_at REAL,
                status TEXT NOT NULL, session_id TEXT, error TEXT
            )""")
            connection.execute(f"""CREATE TABLE IF NOT EXISTS {CONVERSATION_TABLE} (
                task_id TEXT PRIMARY KEY, owner TEXT NOT NULL, session_id TEXT NOT NULL
            )""")
            connection.execute(
                f"CREATE UNIQUE INDEX IF NOT EXISTS scheduled_single_run ON {RUN_TABLE}(task_id) WHERE status = '{RunState.RUNNING}'"
            )
        return database

    def exists(self, project_id: str) -> bool:
        database = self.content.resolve(project_id, PROJECT_DB_RELATIVE)
        if not Path(database).exists():
            return False
        with transaction(database) as connection:
            return (
                connection.execute(
                    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (TASK_TABLE,)
                ).fetchone()
                is not None
            )

    @staticmethod
    def task(row) -> dict:
        return {
            **Schedule.model_validate_json(row["body"]).model_dump(mode="json"),
            **{key: row[key] for key in ("id", "revision", "next_at", "created_at")},
            "enabled": bool(row["enabled"]),
        }

    def list(self, project_id: str, owner: str) -> dict:
        with transaction(self.database(project_id)) as connection:
            tasks = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE owner=? ORDER BY created_at DESC", (owner,)
            ).fetchall()
            runs = connection.execute(
                f"SELECT * FROM {RUN_TABLE} WHERE owner=? ORDER BY started_at DESC LIMIT ?",
                (owner, HISTORY_LIMIT),
            ).fetchall()
        return {"tasks": [self.task(row) for row in tasks], "runs": [dict(row) for row in runs]}

    def groups(self, project_id: str, owner: str) -> list[dict]:
        if not self.exists(project_id):
            return []
        with transaction(self.database(project_id)) as connection:
            tasks = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE owner=?", (owner,)
            ).fetchall()
            runs = connection.execute(
                f"SELECT task_id, name, session_id FROM {RUN_TABLE} WHERE owner=? AND session_id IS NOT NULL ORDER BY started_at DESC, id DESC",
                (owner,),
            ).fetchall()
            anchors = connection.execute(
                f"SELECT * FROM {CONVERSATION_TABLE} WHERE owner=?", (owner,)
            ).fetchall()
        names = {row["id"]: self.task(row)["name"] for row in tasks}
        groups: dict[str, dict] = {}
        for row in runs:
            identity = row["task_id"]
            group = groups.setdefault(
                identity,
                {
                    "id": identity,
                    "title": names.get(identity, row["name"]),
                    "entrySessionId": row["session_id"],
                    "sessionIds": [],
                },
            )
            if row["session_id"] not in group["sessionIds"]:
                group["sessionIds"].append(row["session_id"])
        for row in anchors:
            identity = row["task_id"]
            if identity not in names and identity not in groups:
                continue
            group = groups.setdefault(
                identity,
                {
                    "id": identity,
                    "title": names.get(identity, ""),
                    "entrySessionId": row["session_id"],
                    "sessionIds": [],
                },
            )
            if row["session_id"] not in group["sessionIds"]:
                group["sessionIds"].append(row["session_id"])
        return list(groups.values())

    def conversation(self, project_id: str, identity: str, owner: str) -> dict:
        with transaction(self.database(project_id)) as connection:
            task = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE id=? AND owner=?", (identity, owner)
            ).fetchone()
            runs = connection.execute(
                f"SELECT * FROM {RUN_TABLE} WHERE task_id=? AND owner=? ORDER BY started_at DESC, id DESC",
                (identity, owner),
            ).fetchall()
            anchor = connection.execute(
                f"SELECT session_id FROM {CONVERSATION_TABLE} WHERE task_id=? AND owner=?",
                (identity, owner),
            ).fetchone()
        if task is None and not runs:
            raise ScheduleConflict("schedule_not_found")
        session_id = next((row["session_id"] for row in runs if row["session_id"]), None)
        return {
            "task": self.task(task) if task else None,
            "runs": [dict(row) for row in runs],
            "session_id": session_id or (anchor["session_id"] if anchor else None),
            "initial_session_id": anchor["session_id"] if anchor else None,
        }

    def bind(
        self,
        project_id: str,
        identity: str,
        owner: str,
        session_id: str,
        previous_session_id: str | None = None,
    ) -> str:
        with transaction(self.database(project_id), immediate=True) as connection:
            if not connection.execute(
                f"SELECT 1 FROM {TASK_TABLE} WHERE id=? AND owner=?", (identity, owner)
            ).fetchone():
                raise ScheduleConflict("schedule_not_found")
            connection.execute(
                f"INSERT OR IGNORE INTO {CONVERSATION_TABLE} (task_id,owner,session_id) VALUES (?,?,?)",
                (identity, owner, session_id),
            )
            if previous_session_id:
                connection.execute(
                    f"UPDATE {CONVERSATION_TABLE} SET session_id=? WHERE task_id=? AND owner=? AND session_id=?",
                    (session_id, identity, owner, previous_session_id),
                )
            return connection.execute(
                f"SELECT session_id FROM {CONVERSATION_TABLE} WHERE task_id=? AND owner=?",
                (identity, owner),
            ).fetchone()["session_id"]

    def save(
        self,
        project_id: str,
        identity: str,
        owner: str,
        actor: str,
        schedule: Schedule,
        revision: int | None,
        enabled: bool,
    ) -> dict:
        now = time.time()
        body = schedule.model_dump_json()
        with transaction(self.database(project_id), immediate=True) as connection:
            row = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE id=?", (identity,)
            ).fetchone()
            if row is not None:
                if row["owner"] != owner:
                    raise ScheduleConflict("schedule_conflict")
                if revision is None and Schedule.model_validate_json(row["body"]) == schedule:
                    return self.task(row)
                if revision != row["revision"]:
                    raise ScheduleConflict("schedule_conflict")
                next_at = schedule.next_after(now)
                if enabled and next_at == NO_NEXT_RUN:
                    raise ValueError("schedule_time_unavailable")
                connection.execute(
                    f"UPDATE {TASK_TABLE} SET body=?, actor=?, enabled=?, next_at=?, revision=revision+1 WHERE id=?",
                    (body, actor, enabled, next_at, identity),
                )
            else:
                if revision is not None:
                    raise ScheduleConflict("schedule_not_found")
                next_at = schedule.next_after(now)
                if next_at == NO_NEXT_RUN:
                    raise ValueError("schedule_time_unavailable")
                connection.execute(
                    f"INSERT INTO {TASK_TABLE} VALUES (?,?,?,?,?,?,?,?)",
                    (identity, owner, actor, body, enabled, next_at, 1, now),
                )
            result = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE id=?", (identity,)
            ).fetchone()
            return self.task(result)

    def delete(self, project_id: str, identity: str, owner: str, revision: int) -> None:
        with transaction(self.database(project_id), immediate=True) as connection:
            if connection.execute(
                f"SELECT 1 FROM {RUN_TABLE} WHERE task_id=? AND status=?",
                (identity, RunState.RUNNING),
            ).fetchone():
                raise ScheduleConflict("schedule_running")
            cursor = connection.execute(
                f"DELETE FROM {TASK_TABLE} WHERE id=? AND owner=? AND revision=?",
                (identity, owner, revision),
            )
            if not cursor.rowcount:
                raise ScheduleConflict("schedule_conflict")

    def claim(
        self, project_id: str, identity: str, *, owner: str | None = None, now: float | None = None
    ) -> dict | None:
        now = time.time() if now is None else now
        with transaction(self.database(project_id), immediate=True) as connection:
            row = connection.execute(
                f"SELECT * FROM {TASK_TABLE} WHERE id=?", (identity,)
            ).fetchone()
            if row is None or (owner is not None and owner != row["owner"]):
                raise ScheduleConflict("schedule_not_found")
            manual = owner is not None
            if not manual and (not row["enabled"] or row["next_at"] > now):
                return None
            if connection.execute(
                f"SELECT 1 FROM {RUN_TABLE} WHERE task_id=? AND status=?",
                (identity, RunState.RUNNING),
            ).fetchone():
                if manual:
                    raise ScheduleConflict("schedule_running")
                return None
            schedule = Schedule.model_validate_json(row["body"])
            missed = not manual and now - row["next_at"] > MISFIRE_SECONDS
            status = RunState.MISSED if missed else RunState.RUNNING
            run_id = str(uuid4())
            connection.execute(
                f"INSERT INTO {RUN_TABLE} VALUES (?,?,?,?,?,?,?,?,?)",
                (
                    run_id,
                    identity,
                    row["owner"],
                    schedule.name,
                    now,
                    now if missed else None,
                    status,
                    None,
                    "schedule_missed" if missed else None,
                ),
            )
            if not manual:
                next_at = schedule.next_after(now, anchor=row["next_at"])
                enabled = next_at != NO_NEXT_RUN
                connection.execute(
                    f"UPDATE {TASK_TABLE} SET next_at=?, enabled=?, revision=revision+? WHERE id=?",
                    (next_at, enabled, int(not enabled), identity),
                )
            return {
                "run_id": run_id,
                "project_id": project_id,
                "owner": row["owner"],
                "actor": row["actor"],
                "schedule": schedule,
                "status": status,
            }

    def due(self, project_id: str, now: float) -> list[str]:
        if not self.exists(project_id):
            return []
        with transaction(self.database(project_id)) as connection:
            return [
                row["id"]
                for row in connection.execute(
                    f"SELECT id FROM {TASK_TABLE} WHERE enabled=1 AND next_at<=?", (now,)
                )
            ]

    def attach(self, project_id: str, run_id: str, session_id: str) -> None:
        with transaction(self.database(project_id)) as connection:
            connection.execute(
                f"UPDATE {RUN_TABLE} SET session_id=? WHERE id=?", (session_id, run_id)
            )

    def finish(
        self, project_id: str, run_id: str, status: RunState, error: str | None = None
    ) -> None:
        with transaction(self.database(project_id)) as connection:
            connection.execute(
                f"UPDATE {RUN_TABLE} SET status=?, error=?, finished_at=? WHERE id=?",
                (status, error, time.time(), run_id),
            )

    def recover(self, project_id: str) -> None:
        if not self.exists(project_id):
            return
        with transaction(self.database(project_id)) as connection:
            connection.execute(
                f"UPDATE {RUN_TABLE} SET status=?, error=?, finished_at=? WHERE status=?",
                (RunState.INTERRUPTED, "schedule_interrupted", time.time(), RunState.RUNNING),
            )
