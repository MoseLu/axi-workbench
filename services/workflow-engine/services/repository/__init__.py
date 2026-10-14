"""Repository package — public entry point.

Preserves the historical `from services.repository import X` surface by
re-exporting every public name defined in `repository.index` (plus
`repository.memory`, which carries `MemoryWorkflowRepository`). The
implementation is split across `query.py` / `mutation.py` / `cache.py` /
`memory.py` so each segment stays focused and no file grows past
~450 lines.
"""

from .index import (
    PostgresWorkflowRepository,
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
)
from .memory import MemoryWorkflowRepository

__all__ = [
    "MemoryWorkflowRepository",
    "PostgresWorkflowRepository",
    "WorkflowAlreadyRunning",
    "WorkflowApprovalConflict",
    "WorkflowApprovalForbidden",
    "WorkflowApprovalNotFound",
    "WorkflowCancellationConflict",
    "WorkflowDispatch",
    "WorkflowDispatchLost",
    "WorkflowNotFound",
    "WorkflowRepository",
    "WorkflowWaitingApproval",
]
