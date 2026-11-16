import asyncio
import logging
import time
from collections.abc import Awaitable, Callable

from service.scheduling.model import POLL_SECONDS, RunState
from service.scheduling.store import ScheduleStore

logger = logging.getLogger(__name__)


class Scheduler:
    def __init__(self, store: ScheduleStore, execute: Callable[[dict], Awaitable[None]]) -> None:
        self.store = store
        self.execute = execute
        self.loop: asyncio.Task | None = None
        self.running: set[asyncio.Task] = set()
        self.recovered: set[str] = set()

    async def start(self) -> None:
        for project in self.store.content.projects():
            if project.available and project.archived_at is None:
                try:
                    self.recover(project.id)
                except Exception:
                    logger.exception("Scheduled task recovery failed project=%s", project.id)
        self.loop = asyncio.create_task(self.watch(), name="scheduled-tasks")

    def recover(self, project_id: str) -> None:
        if project_id not in self.recovered:
            self.store.recover(project_id)
            self.recovered.add(project_id)

    async def close(self) -> None:
        if self.loop is not None:
            self.loop.cancel()
            await asyncio.gather(self.loop, return_exceptions=True)
        for task in self.running:
            task.cancel()
        await asyncio.gather(*self.running, return_exceptions=True)

    def launch(self, run: dict | None) -> None:
        if run is None or run["status"] != RunState.RUNNING:
            return
        task = asyncio.create_task(self.perform(run), name="scheduled-task-run")
        self.running.add(task)
        task.add_done_callback(self.running.discard)

    async def perform(self, run: dict) -> None:
        try:
            await self.execute(run)
        except asyncio.CancelledError:
            self.store.finish(
                run["project_id"], run["run_id"], RunState.INTERRUPTED, "schedule_interrupted"
            )
            raise
        except Exception:
            logger.exception("Scheduled task execution failed run=%s", run["run_id"])
            self.store.finish(
                run["project_id"], run["run_id"], RunState.FAILED, "schedule_execution_failed"
            )

    async def watch(self) -> None:
        while True:
            try:
                projects = self.store.content.projects()
            except Exception:
                logger.exception("Scheduled task project scan failed")
                await asyncio.sleep(POLL_SECONDS)
                continue
            for project in projects:
                if not project.available or project.archived_at is not None:
                    continue
                try:
                    self.recover(project.id)
                    for identity in self.store.due(project.id, time.time()):
                        self.launch(self.store.claim(project.id, identity))
                except Exception:
                    logger.exception("Scheduled task scan failed project=%s", project.id)
            await asyncio.sleep(POLL_SECONDS)
