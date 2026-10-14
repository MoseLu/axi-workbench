"""Public entry point for the `services.repository` package.

Hosts the durable `PostgresWorkflowRepository` composition
(multi-inherited from the `_PostgresQueryMixin`, `_PostgresMutationMixin`,
and `_PostgresCacheMixin` segments in this package). The exception
types, the abstract `WorkflowRepository` interface, the
`WorkflowDispatch` dataclass, and the row/value helpers all live in
`helpers.py` so every segment can import them without forming a cycle
through this module. `__init__.py` re-exports the public names below
so the historical `from services.repository import X` surface still
works after the split.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from psycopg_pool import AsyncConnectionPool

from .helpers import (  # noqa: F401  (re-export)
    WorkflowAlreadyRunning,
    WorkflowApprovalConflict,
    WorkflowApprovalForbidden,
    WorkflowApprovalNotFound,
    WorkflowCancellationConflict,
    WorkflowDispatch,
    WorkflowDispatchLost,
    WorkflowNotFound,
    WorkflowRepository,
    WorkflowWaitingApproval,
    _approval_from_row,
    _approval_values,
    _execution_from_row,
    _json_steps,
    _json_value,
    _workflow_from_row,
    _workflow_values,
)
from .cache import _PostgresCacheMixin  # noqa: E402  (mixin segment)
from .mutation import _PostgresMutationMixin  # noqa: E402  (mixin segment)
from .query import _PostgresQueryMixin  # noqa: E402  (mixin segment)


class PostgresWorkflowRepository(
    _PostgresQueryMixin,
    _PostgresMutationMixin,
    _PostgresCacheMixin,
    WorkflowRepository,
):
    """PostgreSQL repository with atomic execution claims.

    The three mixins above supply the concrete implementations of every
    abstract method declared by `WorkflowRepository`, so the composed
    class stays instantiable while preserving the historical
    `issubclass(PostgresWorkflowRepository, WorkflowRepository)` contract
    (the pre-split class declared `WorkflowRepository` as its sole base).
    """

    # The migration file lives next to the `services/` package. The
    # path is computed from this index module — `parents[2]` walks up
    # `repository/` then `services/` and lands on `workflow-engine/`,
    # where `migrations/001_workflows.sql` lives. The `_PostgresCacheMixin`
    # `connect` and `apply_migrations` helpers read this attribute.
    _migration_path = Path(__file__).resolve().parents[2] / "migrations" / "001_workflows.sql"

    def __init__(self, pool: AsyncConnectionPool[Any]) -> None:
        self.pool = pool
