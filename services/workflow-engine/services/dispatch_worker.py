"""Durable event-to-workflow dispatch worker."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from services.executor import WorkflowExecutor
from services.repository import (
    WorkflowAlreadyRunning,
    WorkflowDispatch,
    WorkflowDispatchLost,
    WorkflowNotFound,
    WorkflowRepository,
)

logger = logging.getLogger(__name__)


class WorkflowDispatchWorker:
    """Claims leased event dispatches and persists their execution outcome."""

    def __init__(
        self,
        repository: WorkflowRepository,
        executor: WorkflowExecutor,
        *,
        worker_id: str | None = None,
        max_concurrency: int = 10,
        lease_seconds: int = 360,
        poll_interval_seconds: float = 1.0,
        max_attempts: int = 10,
        retry_base_seconds: int = 5,
        retry_max_seconds: int = 300,
    ) -> None:
        self.repository = repository
        self.executor = executor
        self.worker_id = worker_id or f"workflow-worker-{uuid4()}"
        self.max_concurrency = max(1, max_concurrency)
        self.lease_seconds = max(1, lease_seconds)
        self.poll_interval_seconds = max(0.05, poll_interval_seconds)
        self.max_attempts = max(1, max_attempts)
        self.retry_base_seconds = max(0, retry_base_seconds)
        self.retry_max_seconds = max(self.retry_base_seconds, retry_max_seconds)

    async def run(self, stop_event: asyncio.Event) -> None:
        """Poll until shutdown, draining already claimed work gracefully."""
        active: set[asyncio.Task[None]] = set()
        logger.info("Workflow dispatch worker %s started", self.worker_id)
        try:
            while not stop_event.is_set():
                self._discard_finished(active)
                capacity = self.max_concurrency - len(active)
                claimed = False
                for _ in range(max(0, capacity)):
                    dispatch = await self.repository.claim_event_dispatch(
                        self.worker_id, self.lease_seconds
                    )
                    if dispatch is None:
                        break
                    active.add(asyncio.create_task(self.process_dispatch(dispatch)))
                    claimed = True
                if claimed:
                    continue

                if active:
                    await self._wait_for_activity_or_stop(active, stop_event)
                else:
                    await self._wait_for_stop(stop_event)
        finally:
            if active:
                await asyncio.gather(*active, return_exceptions=True)
            logger.info("Workflow dispatch worker %s stopped", self.worker_id)

    async def process_dispatch(self, dispatch: WorkflowDispatch) -> None:
        """Process one leased dispatch; exposed for deterministic tests."""
        claimed_workflow = False
        heartbeat_stop = asyncio.Event()
        heartbeat_task = asyncio.create_task(self._renew_lease(dispatch, heartbeat_stop))
        try:
            workflow = await self.repository.claim_for_execution(
                dispatch.workflow_id, dispatch.owner_subject
            )
            claimed_workflow = True
            execution = await self.executor.execute_workflow(
                workflow, event_payload=dispatch.payload
            )
            await self.repository.complete_event_dispatch(
                dispatch, execution, self.worker_id
            )
            logger.info(
                "Completed workflow dispatch event=%s workflow=%s status=%s",
                dispatch.event_id,
                dispatch.workflow_id,
                execution.status.value,
            )
        except asyncio.CancelledError:
            raise
        except WorkflowAlreadyRunning as exc:
            await self._retry(
                dispatch,
                str(exc) or "workflow is already running",
                reset_workflow=False,
            )
        except WorkflowNotFound as exc:
            await self._fail_terminal(dispatch, str(exc) or "workflow not found")
        except WorkflowDispatchLost:
            logger.warning(
                "Lost workflow dispatch lease event=%s workflow=%s",
                dispatch.event_id,
                dispatch.workflow_id,
            )
        except Exception as exc:  # noqa: BLE001 - worker must preserve the lease contract
            logger.exception(
                "Workflow dispatch failed event=%s workflow=%s",
                dispatch.event_id,
                dispatch.workflow_id,
            )
            await self._retry(
                dispatch,
                str(exc) or "workflow dispatch failed",
                reset_workflow=claimed_workflow,
            )
        finally:
            heartbeat_stop.set()
            await asyncio.gather(heartbeat_task, return_exceptions=True)

    async def _retry(self, dispatch: WorkflowDispatch, error: str, *, reset_workflow: bool) -> None:
        exponent = max(0, dispatch.attempts - 1)
        delay = min(self.retry_base_seconds * (2**exponent), self.retry_max_seconds)
        retry_at = datetime.now(UTC) + timedelta(seconds=delay)
        try:
            await self.repository.fail_event_dispatch(
                dispatch,
                self.worker_id,
                error,
                retry_at,
                self.max_attempts,
                reset_workflow=reset_workflow,
            )
        except WorkflowDispatchLost:
            logger.warning(
                "Lost workflow dispatch lease while retrying event=%s workflow=%s",
                dispatch.event_id,
                dispatch.workflow_id,
            )

    async def _fail_terminal(self, dispatch: WorkflowDispatch, error: str) -> None:
        try:
            await self.repository.fail_event_dispatch(
                dispatch,
                self.worker_id,
                error,
                retry_at=None,
                max_attempts=self.max_attempts,
                retry=False,
            )
        except WorkflowDispatchLost:
            logger.warning(
                "Lost workflow dispatch lease while failing event=%s workflow=%s",
                dispatch.event_id,
                dispatch.workflow_id,
            )

    async def _renew_lease(self, dispatch: WorkflowDispatch, stop_event: asyncio.Event) -> None:
        interval = max(0.05, self.lease_seconds / 3)
        while True:
            try:
                await asyncio.wait_for(stop_event.wait(), timeout=interval)
                return
            except TimeoutError:
                try:
                    if not await self.repository.renew_event_dispatch(
                        dispatch, self.worker_id, self.lease_seconds
                    ):
                        logger.warning(
                            "Could not renew workflow dispatch lease event=%s workflow=%s",
                            dispatch.event_id,
                            dispatch.workflow_id,
                        )
                        return
                except asyncio.CancelledError:
                    raise
                except Exception:  # noqa: BLE001 - lease renewal must not kill execution
                    logger.exception(
                        "Workflow dispatch lease renewal failed event=%s workflow=%s",
                        dispatch.event_id,
                        dispatch.workflow_id,
                    )

    async def _wait_for_stop(self, stop_event: asyncio.Event) -> None:
        try:
            await asyncio.wait_for(stop_event.wait(), timeout=self.poll_interval_seconds)
        except TimeoutError:
            return

    async def _wait_for_activity_or_stop(
        self,
        active: set[asyncio.Task[None]],
        stop_event: asyncio.Event,
    ) -> None:
        stop_task = asyncio.create_task(stop_event.wait())
        try:
            await asyncio.wait(
                (*active, stop_task),
                timeout=self.poll_interval_seconds,
                return_when=asyncio.FIRST_COMPLETED,
            )
        finally:
            stop_task.cancel()
            await asyncio.gather(stop_task, return_exceptions=True)

    @staticmethod
    def _discard_finished(active: set[asyncio.Task[None]]) -> None:
        for task in list(active):
            if not task.done():
                continue
            active.remove(task)
            try:
                task.result()
            except asyncio.CancelledError:
                pass
            except Exception:  # noqa: BLE001 - process_dispatch logs and contains failures
                logger.exception("Unexpected workflow dispatch task failure")
