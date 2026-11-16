import asyncio

from service.chat.constants import PRODUCT_TURN_OUTCOME_COMPLETED, PRODUCT_TURN_OUTCOME_INTERRUPTED
from service.chat.persistence.catalog import SessionPrincipal
from service.chat.service.sessions import SessionService
from service.chat.service.turns import HTTP_ACCEPTED, HTTP_OK, TurnService
from service.scheduling.model import POLL_SECONDS, RunState
from service.scheduling.store import ScheduleConflict, ScheduleStore


class ScheduledConversations:
    def __init__(self, store: ScheduleStore, sessions: SessionService) -> None:
        self.store = store
        self.sessions = sessions
        self.lock = asyncio.Lock()

    async def open(self, project_id: str, identity: str, owner: str, actor: str) -> str:
        async with self.lock:
            conversation = self.store.conversation(project_id, identity, owner)
            principal = SessionPrincipal(owner)
            candidates = [run["session_id"] for run in conversation["runs"] if run["session_id"]]
            anchor = conversation.get("initial_session_id")
            if anchor:
                candidates.append(anchor)
            rows = self.sessions.status(candidates, principal, {})["sessions"]
            available = {row["session_id"] for row in rows if not row.get("archived")}
            for session_id in candidates:
                if session_id in available:
                    return session_id
            if conversation["task"] is None:
                raise ScheduleConflict("schedule_not_found")
            project = self.store.content.project(project_id)
            opened, status = await self.sessions.open(
                {"project_path": project.root}, principal, actor_id=actor
            )
            if status != HTTP_OK:
                raise RuntimeError("schedule_session_unavailable")
            session_id = opened["session_id"]
            await self.sessions.rename(session_id, conversation["task"]["name"], principal)
            return self.store.bind(project_id, identity, owner, session_id, anchor)


class ScheduledExecution:
    def __init__(self, store: ScheduleStore, sessions: SessionService, turns: TurnService) -> None:
        self.store = store
        self.sessions = sessions
        self.turns = turns

    async def __call__(self, run: dict) -> None:
        project = self.store.content.project(run["project_id"])
        principal = SessionPrincipal(run["owner"])
        schedule = run["schedule"]
        opened, status = await self.sessions.open(
            {"project_path": project.root}, principal, actor_id=run["actor"]
        )
        if status != HTTP_OK:
            raise RuntimeError("schedule_session_unavailable")
        session_id = opened["session_id"]
        self.store.attach(project.id, run["run_id"], session_id)
        await self.sessions.rename(session_id, schedule.name, principal)
        model_id = self.sessions.model(session_id)["model_id"]
        async with self.sessions.turn_admission(
            session_id,
            principal,
            actor_id=run["actor"],
            model_id=model_id,
            service_instance_id=None,
        ):
            result, status = await self.turns.post(
                session_id,
                {
                    "input": [{"type": "text", "text": schedule.prompt}],
                    "client_user_message_id": run["run_id"],
                    "wait": False,
                },
                side=False,
                expected_model_id=model_id,
                prepared_activity=True,
            )
        if status not in {HTTP_OK, HTTP_ACCEPTED} or not result.get("ok", True):
            raise RuntimeError("schedule_turn_unavailable")
        while True:
            await asyncio.sleep(POLL_SECONDS)
            rows = self.sessions.status([session_id], principal, {})["sessions"]
            if not rows:
                raise RuntimeError("schedule_session_unavailable")
            snapshot = rows[0]
            if (
                snapshot.get("running")
                or snapshot.get("queued_messages")
                or snapshot.get("interrupting")
            ):
                continue
            outcome = snapshot.get("last_turn_status")
            cancelled_before_turn = (
                outcome is None and snapshot.get("last_interrupt_succeeded") is True
            )
            state = (
                RunState.COMPLETED
                if outcome == PRODUCT_TURN_OUTCOME_COMPLETED
                else (
                    RunState.INTERRUPTED
                    if outcome == PRODUCT_TURN_OUTCOME_INTERRUPTED or cancelled_before_turn
                    else RunState.FAILED
                )
            )
            self.store.finish(
                project.id,
                run["run_id"],
                state,
                None if state == RunState.COMPLETED else "schedule_execution_failed",
            )
            return
