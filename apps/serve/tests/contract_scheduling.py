import asyncio
import tempfile
import unittest
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch

from service.chat.service.scheduling import ScheduledConversations, ScheduledExecution
from service.chat.service.sessions import SessionService
from service.persistence.project import transaction
from service.scheduling.model import RunState, Schedule
from service.scheduling.service import Scheduler
from service.scheduling.store import ScheduleConflict, ScheduleStore


class Content:
    def __init__(self, root: Path) -> None:
        self.root = root

    def resolve(self, project: str, path: str):
        return str(self.root / project / "project.sqlite3")


class ConversationContract(unittest.IsolatedAsyncioTestCase):
    async def test_deleted_plan_with_no_available_batches_does_not_create_a_session(self):
        store = Mock()
        store.conversation.return_value = {"task": None, "runs": [{"session_id": "deleted"}]}
        sessions = SimpleNamespace(status=Mock(return_value={"sessions": []}), open=AsyncMock())
        with self.assertRaises(ScheduleConflict):
            await ScheduledConversations(store, sessions).open("project", "task", "owner", "actor")
        sessions.open.assert_not_awaited()

    async def test_open_reuses_history_without_creating_a_session(self):
        store = Mock()
        store.conversation.return_value = {
            "runs": [
                {"session_id": "deleted"},
                {"session_id": "archived"},
                {"session_id": "history"},
            ]
        }
        sessions = SimpleNamespace(
            open=AsyncMock(),
            rename=AsyncMock(),
            status=Mock(
                return_value={
                    "sessions": [
                        {"session_id": "archived", "archived": True},
                        {"session_id": "history"},
                    ]
                }
            ),
        )
        conversations = ScheduledConversations(store, sessions)
        self.assertEqual(await conversations.open("project", "task", "owner", "actor"), "history")
        sessions.open.assert_not_awaited()
        store.bind.assert_not_called()

    async def test_concurrent_empty_opens_create_one_session_without_a_turn(self):
        store = Mock()
        store.conversation.side_effect = [
            {"runs": [], "initial_session_id": "old", "task": {"name": "Scheduled task"}},
            {"runs": [], "initial_session_id": "empty"},
        ]
        store.content.project.return_value = SimpleNamespace(root="/project")
        store.bind.return_value = "empty"
        sessions = SimpleNamespace(
            open=AsyncMock(return_value=({"session_id": "empty"}, 200)),
            rename=AsyncMock(),
            status=Mock(
                side_effect=[
                    {"sessions": [{"session_id": "old", "archived": True}]},
                    {"sessions": [{"session_id": "empty"}]},
                ]
            ),
        )
        conversations = ScheduledConversations(store, sessions)
        results = await asyncio.gather(
            *[conversations.open("project", "task", "owner", "actor") for _ in range(2)]
        )
        self.assertEqual(results, ["empty", "empty"])
        sessions.open.assert_awaited_once()
        sessions.rename.assert_awaited_once()
        store.bind.assert_called_once_with("project", "task", "owner", "empty", "old")


class SchedulingContract(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.store = ScheduleStore(Content(Path(self.temporary.name)))
        self.schedule = Schedule(
            name="Research",
            prompt="Summarize papers",
            frequency="weekly",
            time="09:00",
            timezone="Asia/Shanghai",
            weekdays=[0],
        )

    def test_recurrence_and_validation(self):
        after = datetime(2026, 11, 6, tzinfo=UTC).timestamp()
        self.assertEqual(
            self.schedule.next_after(after), datetime(2026, 11, 9, 1, tzinfo=UTC).timestamp()
        )
        with self.assertRaises(ValueError):
            self.schedule.model_validate({**self.schedule.model_dump(), "weekdays": []})

    def test_conversation_groups_preserve_batches_and_owner(self):
        self.store.save("project", "task", "owner", "actor", self.schedule, None, True)
        first = self.store.claim("project", "task", owner="owner")
        self.store.attach("project", first["run_id"], "first-session")
        self.store.finish("project", first["run_id"], RunState.COMPLETED)
        second = self.store.claim("project", "task", owner="owner")
        self.store.attach("project", second["run_id"], "second-session")
        self.store.finish("project", second["run_id"], RunState.COMPLETED)
        groups = self.store.groups("project", "owner")
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0]["entrySessionId"], "second-session")
        self.assertEqual(set(groups[0]["sessionIds"]), {"first-session", "second-session"})
        self.assertEqual(self.store.groups("project", "other"), [])
        with self.assertRaises(ScheduleConflict):
            self.store.conversation("project", "task", "other")
        self.store.delete("project", "task", "owner", 1)
        history = self.store.conversation("project", "task", "owner")
        self.assertIsNone(history["task"])
        self.assertEqual(len(history["runs"]), 2)
        self.assertEqual(len(self.store.groups("project", "owner")), 1)

    def test_empty_conversation_anchor_is_idempotent(self):
        self.store.save("project", "task", "owner", "actor", self.schedule, None, True)
        self.assertIsNone(self.store.conversation("project", "task", "owner")["session_id"])
        self.assertEqual(self.store.bind("project", "task", "owner", "empty"), "empty")
        self.assertEqual(self.store.bind("project", "task", "owner", "duplicate"), "empty")
        self.assertEqual(self.store.groups("project", "owner")[0]["sessionIds"], ["empty"])
        self.assertEqual(
            self.store.bind("project", "task", "owner", "replacement", "empty"), "replacement"
        )
        self.assertEqual(
            self.store.bind("project", "task", "owner", "stale", "empty"), "replacement"
        )
        self.assertEqual(
            self.store.conversation("project", "task", "owner")["initial_session_id"], "replacement"
        )

    def test_extended_frequencies(self):
        after = datetime(2026, 11, 6, 1, 10, tzinfo=UTC).timestamp()
        for patch, expected in [
            (
                {"frequency": "once", "once_date": "2026-11-07"},
                datetime(2026, 11, 7, 1, tzinfo=UTC).timestamp(),
            ),
            ({"frequency": "interval", "interval_minutes": 30}, after + 1800),
            ({"frequency": "hourly", "time": "00:15"}, after + 300),
            (
                {"frequency": "custom", "cron": "0 9 * * 1-5"},
                datetime(2026, 11, 9, 1, tzinfo=UTC).timestamp(),
            ),
            (
                {"frequency": "monthly", "month_day": 31},
                datetime(2026, 12, 31, 1, tzinfo=UTC).timestamp(),
            ),
        ]:
            schedule = Schedule.model_validate({**self.schedule.model_dump(), **patch})
            self.assertEqual(schedule.next_after(after), expected)
        for patch in [
            {"frequency": "interval", "interval_minutes": 0},
            {"frequency": "once", "once_date": "2026-02-30"},
            {"frequency": "custom", "cron": "60 9 * * *"},
            {"frequency": "custom", "cron": "*/0 * * * *"},
            {"frequency": "custom", "cron": "0 9 * * * command"},
        ]:
            with self.assertRaises(ValueError):
                Schedule.model_validate({**self.schedule.model_dump(), **patch})

    def test_cron_calendar_and_dst(self):
        schedule = Schedule.model_validate(
            {**self.schedule.model_dump(), "frequency": "custom", "cron": "0 9 29 2 *"}
        )
        self.assertEqual(
            schedule.next_after(datetime(2026, 11, 6, tzinfo=UTC).timestamp()),
            datetime(2028, 2, 29, 1, tzinfo=UTC).timestamp(),
        )
        sunday = Schedule.model_validate({**schedule.model_dump(), "cron": "0 9 * * 7"})
        self.assertEqual(
            sunday.next_after(datetime(2026, 11, 6, tzinfo=UTC).timestamp()),
            datetime(2026, 11, 8, 1, tzinfo=UTC).timestamp(),
        )
        impossible = Schedule.model_validate({**schedule.model_dump(), "cron": "0 9 31 2 *"})
        with self.assertRaises(ValueError):
            impossible.next_after(datetime(2026, 11, 6, tzinfo=UTC).timestamp())

    def test_once_consumed_atomically_and_past_date_rejected(self):
        now = datetime(2026, 11, 6, tzinfo=UTC).timestamp()
        schedule = Schedule.model_validate(
            {**self.schedule.model_dump(), "frequency": "once", "once_date": "2026-11-07"}
        )
        with patch("service.scheduling.store.time.time", return_value=now):
            task = self.store.save("project", "once", "owner", "actor", schedule, None, True)
        run = self.store.claim("project", "once", now=task["next_at"])
        self.assertEqual(run["status"], RunState.RUNNING)
        saved = self.store.list("project", "owner")["tasks"][0]
        self.assertFalse(saved["enabled"])
        self.assertEqual(saved["revision"], task["revision"] + 1)
        self.assertEqual(self.store.due("project", task["next_at"] + 1), [])
        with patch("service.scheduling.store.time.time", return_value=task["next_at"] + 1):
            with self.assertRaises(ValueError):
                self.store.save(
                    "project", "once", "owner", "actor", schedule, saved["revision"], True
                )

    def test_interval_preserves_anchor_and_manual_run_does_not_shift_it(self):
        schedule = Schedule.model_validate(
            {**self.schedule.model_dump(), "frequency": "interval", "interval_minutes": 30}
        )
        task = self.store.save("project", "interval", "owner", "actor", schedule, None, True)
        run = self.store.claim("project", "interval", owner="owner")
        self.assertEqual(
            self.store.list("project", "owner")["tasks"][0]["next_at"], task["next_at"]
        )
        self.store.finish("project", run["run_id"], RunState.COMPLETED)
        self.store.claim("project", "interval", now=task["next_at"] + 7)
        self.assertEqual(
            self.store.list("project", "owner")["tasks"][0]["next_at"], task["next_at"] + 1800
        )

    def test_dst_nonexistent_time_is_skipped(self):
        schedule = Schedule(
            name="DST", prompt="Check", frequency="daily", time="02:30", timezone="America/New_York"
        )
        after = datetime(2026, 3, 8, 5, tzinfo=UTC).timestamp()
        self.assertEqual(
            schedule.next_after(after), datetime(2026, 3, 9, 6, 30, tzinfo=UTC).timestamp()
        )

    def test_cron_lists_steps_and_day_union(self):
        schedule = Schedule.model_validate(
            {**self.schedule.model_dump(), "frequency": "custom", "cron": "*/15 9-10 * * 1,5"}
        )
        self.assertEqual(
            schedule.next_after(datetime(2026, 11, 6, 1, 16, tzinfo=UTC).timestamp()),
            datetime(2026, 11, 6, 1, 30, tzinfo=UTC).timestamp(),
        )
        schedule.cron = "0 9 1 * 1"
        self.assertEqual(
            schedule.next_after(datetime(2026, 11, 6, tzinfo=UTC).timestamp()),
            datetime(2026, 11, 9, 1, tzinfo=UTC).timestamp(),
        )

    def test_custom_dst_skips_missing_and_second_occurrence(self):
        schedule = Schedule.model_validate(
            {
                **self.schedule.model_dump(),
                "frequency": "custom",
                "cron": "30 2 * * *",
                "timezone": "America/New_York",
            }
        )
        self.assertEqual(
            schedule.next_after(datetime(2026, 3, 8, 5, tzinfo=UTC).timestamp()),
            datetime(2026, 3, 9, 6, 30, tzinfo=UTC).timestamp(),
        )
        schedule.cron = "30 1 * * *"
        self.assertEqual(
            schedule.next_after(datetime(2026, 11, 1, 5, 30, tzinfo=UTC).timestamp()),
            datetime(2026, 11, 2, 6, 30, tzinfo=UTC).timestamp(),
        )

    def test_legacy_payload_reads_and_retries_without_migration(self):
        task = self.store.save("project", "legacy", "owner", "actor", self.schedule, None, True)
        legacy = self.schedule.model_dump_json(exclude={"once_date", "interval_minutes", "cron"})
        with transaction(self.store.database("project")) as connection:
            connection.execute("UPDATE scheduled_tasks SET body=? WHERE id=?", (legacy, "legacy"))
        retried = self.store.save("project", "legacy", "owner", "actor", self.schedule, None, True)
        self.assertEqual(retried, task)

    def test_idempotency_revision_and_owner(self):
        first = self.store.save("project", "one", "owner", "actor", self.schedule, None, True)
        self.assertEqual(
            first, self.store.save("project", "one", "owner", "actor", self.schedule, None, True)
        )
        with self.assertRaises(ScheduleConflict):
            self.store.save("project", "one", "other", "actor", self.schedule, None, True)
        self.assertEqual(self.store.list("project", "other")["tasks"], [])
        self.store.save("project", "one", "owner", "actor", self.schedule, 1, False)
        with self.assertRaises(ScheduleConflict):
            self.store.save("project", "one", "owner", "actor", self.schedule, 1, True)

    def test_no_overlap_and_history_retained(self):
        self.store.save("project", "one", "owner", "actor", self.schedule, None, True)
        run = self.store.claim("project", "one", owner="owner")
        with self.assertRaises(ScheduleConflict):
            self.store.claim("project", "one", owner="owner")
        with self.assertRaises(ScheduleConflict):
            self.store.delete("project", "one", "owner", 1)
        self.store.finish("project", run["run_id"], RunState.COMPLETED)
        self.store.delete("project", "one", "owner", 1)
        result = self.store.list("project", "owner")
        self.assertEqual(len(result["runs"]), 1)
        self.assertEqual(result["tasks"], [])

    def test_missed_run_is_not_silently_executed(self):
        task = self.store.save("project", "one", "owner", "actor", self.schedule, None, True)
        run = self.store.claim("project", "one", now=task["next_at"] + 3600)
        self.assertEqual(run["status"], RunState.MISSED)
        self.assertIsNone(self.store.claim("project", "one", now=task["next_at"] + 3600))

    def test_paused_and_future_tasks_do_not_run(self):
        task = self.store.save("project", "one", "owner", "actor", self.schedule, None, False)
        self.assertIsNone(self.store.claim("project", "one", now=task["next_at"] + 1))
        self.assertEqual(self.store.due("project", task["next_at"] + 1), [])
        self.assertIsNone(self.store.claim("project", "one", now=task["next_at"] - 1))

    def test_scan_does_not_create_databases_for_untouched_projects(self):
        self.assertEqual(self.store.due("unused", 0), [])
        self.store.recover("unused")
        self.assertFalse(Path(self.store.content.resolve("unused", "")).exists())

    def test_recovery_is_once_per_project(self):
        scheduler = Scheduler(self.store, AsyncMock())
        scheduler.recover("project")
        self.store.save("project", "one", "owner", "actor", self.schedule, None, True)
        self.store.claim("project", "one", owner="owner")
        scheduler.recover("project")
        self.assertEqual(self.store.list("project", "owner")["runs"][0]["status"], RunState.RUNNING)
        Scheduler(self.store, AsyncMock()).recover("project")
        self.assertEqual(
            self.store.list("project", "owner")["runs"][0]["status"], RunState.INTERRUPTED
        )


class ExecutionContract(unittest.IsolatedAsyncioTestCase):
    def test_status_exposes_confirmed_interruption_even_before_a_turn_exists(self):
        service = Mock()
        service._sessions = {
            "session": SimpleNamespace(interrupting=False, last_interrupt_succeeded=True)
        }
        service._access.pending_turn_settlement.return_value = None
        service._access.pending_hil.return_value = []
        service._access.uncertainties.return_value = []
        service._access.queued_messages.return_value = []
        service._list_row.return_value = {"last_turn_status": None, "recovery_blocked": False}
        snapshot = SessionService.status(service, ["session"], Mock(), {})["sessions"][0]
        self.assertIs(snapshot["last_interrupt_succeeded"], True)
        service._sessions.clear()
        snapshot = SessionService.status(service, ["session"], Mock(), {})["sessions"][0]
        self.assertIsNone(snapshot["last_interrupt_succeeded"])

    async def test_execution_uses_session_admission_and_terminal_turn_outcome(self):
        store = Mock()
        store.content.project.return_value = SimpleNamespace(id="project", root="/project")
        sessions = Mock()
        sessions.open = AsyncMock(return_value=({"session_id": "session"}, 200))
        sessions.rename = AsyncMock()
        sessions.model.return_value = {"model_id": "configured"}
        sessions.status.return_value = {
            "sessions": [{"running": False, "last_turn_status": "completed"}]
        }
        admitted = []

        @asynccontextmanager
        async def admission(session_id, principal, *, actor_id, model_id, service_instance_id):
            admitted.append(
                {
                    "actor_id": actor_id,
                    "model_id": model_id,
                    "service_instance_id": service_instance_id,
                }
            )
            yield

        sessions.turn_admission = admission
        turns = Mock(post=AsyncMock(return_value=({"ok": True, "turn_id": "turn"}, 202)))
        schedule = Schedule(
            name="Check", prompt="Reply once", time="09:00", timezone="Asia/Shanghai"
        )
        run = {
            "project_id": "project",
            "owner": "owner",
            "actor": "actor",
            "schedule": schedule,
            "run_id": "run",
        }
        with patch("service.chat.service.scheduling.asyncio.sleep", new=AsyncMock()):
            await ScheduledExecution(store, sessions, turns)(run)
        self.assertEqual(admitted[0]["actor_id"], "actor")
        self.assertEqual(admitted[0]["model_id"], "configured")
        self.assertEqual(
            turns.post.call_args.args[1]["input"], [{"type": "text", "text": "Reply once"}]
        )
        self.assertTrue(turns.post.call_args.kwargs["prepared_activity"])
        store.finish.assert_called_once_with("project", "run", RunState.COMPLETED, None)
        for outcome, confirmed, expected in (
            (None, True, RunState.INTERRUPTED),
            (None, False, RunState.FAILED),
            (None, None, RunState.FAILED),
            ("interrupted", None, RunState.INTERRUPTED),
            ("failed", True, RunState.FAILED),
            ("completed", True, RunState.COMPLETED),
        ):
            with self.subTest(outcome=outcome, confirmed=confirmed):
                store.finish.reset_mock()
                sessions.status.side_effect = [
                    {"sessions": [{"running": False, "interrupting": True}]},
                    {
                        "sessions": [
                            {
                                "running": False,
                                "last_turn_status": outcome,
                                "last_interrupt_succeeded": confirmed,
                            }
                        ]
                    },
                ]
                with patch("service.chat.service.scheduling.asyncio.sleep", new=AsyncMock()):
                    await ScheduledExecution(store, sessions, turns)(run)
                store.finish.assert_called_once_with(
                    "project",
                    "run",
                    expected,
                    None if expected == RunState.COMPLETED else "schedule_execution_failed",
                )

    async def test_execution_failure_is_recorded_not_reported_as_success(self):
        store = Mock()
        scheduler = Scheduler(store, AsyncMock(side_effect=RuntimeError("unavailable")))
        with self.assertLogs("service.scheduling.service", level="ERROR"):
            await scheduler.perform({"project_id": "project", "run_id": "run"})
        store.finish.assert_called_once_with(
            "project", "run", RunState.FAILED, "schedule_execution_failed"
        )


if __name__ == "__main__":
    unittest.main()
