from collections.abc import Awaitable, Callable
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field

from service.identity.utils import request_owner_id, request_user_id
from service.scheduling.model import Schedule
from service.scheduling.service import Scheduler
from service.scheduling.store import ScheduleConflict, ScheduleStore

API_ROOT = "/api/serve/projects/{project_id}/schedules"


class SaveSchedule(BaseModel):
    model_config = ConfigDict(extra="forbid")
    schedule: Schedule
    enabled: bool = True
    revision: int | None = Field(default=None, ge=1)


def mount_schedules(
    app: FastAPI,
    store: ScheduleStore,
    scheduler: Scheduler,
    open_conversation: Callable[[str, str, str, str], Awaitable[str]],
) -> None:
    previous = app.router.lifespan_context

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        async with previous(application):
            await scheduler.start()
            try:
                yield
            finally:
                await scheduler.close()

    app.router.lifespan_context = lifespan

    def check(project_id: str) -> None:
        project = next((item for item in store.content.projects() if item.id == project_id), None)
        if project is None:
            raise HTTPException(404, "schedule_project_unavailable")
        if not project.available or project.archived_at is not None:
            raise HTTPException(409, "schedule_project_unavailable")

    @app.get(API_ROOT)
    def list_schedules(project_id: str, request: Request):
        check(project_id)
        return store.list(project_id, request_owner_id(request))

    @app.put(API_ROOT + "/{identity}")
    def save_schedule(project_id: str, identity: str, body: SaveSchedule, request: Request):
        check(project_id)
        if not identity or len(identity) > 200:
            raise HTTPException(422, "schedule_identity_invalid")
        try:
            return store.save(
                project_id,
                identity,
                request_owner_id(request),
                request_user_id(request),
                body.schedule,
                body.revision,
                body.enabled,
            )
        except ScheduleConflict as error:
            raise HTTPException(409, str(error)) from error
        except ValueError as error:
            raise HTTPException(422, str(error)) from error

    @app.get(API_ROOT + "/groups")
    def conversation_groups(project_id: str, request: Request):
        check(project_id)
        return store.groups(project_id, request_owner_id(request))

    @app.get(API_ROOT + "/{identity}/conversation")
    def conversation_history(project_id: str, identity: str, request: Request):
        check(project_id)
        try:
            return store.conversation(project_id, identity, request_owner_id(request))
        except ScheduleConflict as error:
            raise HTTPException(404, str(error)) from error

    @app.post(API_ROOT + "/{identity}/conversation")
    async def open_task_conversation(project_id: str, identity: str, request: Request):
        check(project_id)
        try:
            session_id = await open_conversation(
                project_id, identity, request_owner_id(request), request_user_id(request)
            )
            return {"session_id": session_id}
        except ScheduleConflict as error:
            raise HTTPException(404, str(error)) from error
        except RuntimeError as error:
            raise HTTPException(503, "schedule_session_unavailable") from error

    @app.delete(API_ROOT + "/{identity}")
    def delete_schedule(project_id: str, identity: str, revision: int, request: Request):
        check(project_id)
        try:
            store.delete(project_id, identity, request_owner_id(request), revision)
            return {"ok": True}
        except ScheduleConflict as error:
            raise HTTPException(409, str(error)) from error

    @app.post(API_ROOT + "/{identity}/run")
    async def run_schedule(project_id: str, identity: str, request: Request):
        check(project_id)
        actor = request_user_id(request)
        try:
            scheduler.recover(project_id)
            run = store.claim(project_id, identity, owner=request_owner_id(request))
        except ScheduleConflict as error:
            raise HTTPException(409, str(error)) from error
        run["actor"] = actor
        scheduler.launch(run)
        return {"ok": True, "run_id": run["run_id"]}
