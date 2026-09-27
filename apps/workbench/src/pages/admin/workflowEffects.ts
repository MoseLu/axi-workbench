import type {
  WorkflowEngineApproval,
  WorkflowEngineExecution,
  WorkflowEngineStep,
  WorkflowEngineWorkflow,
} from '@axi/workstation-contracts';

const boundedEffectStepTypes = new Set(['bounded_agent', 'approved_effect']);
const sensitiveDetailKey = /(?:api[-_]?key|authorization|password|secret|token)/i;

export type WorkflowEffectExecutionStep = Pick<WorkflowEngineStep, 'error' | 'id' | 'name' | 'result' | 'status' | 'step_type'>;

/** Keep the audit queue focused on workflows that can invoke the bounded Agent/effect path. */
export function isBoundedEffectWorkflow(workflow: WorkflowEngineWorkflow): boolean {
  return workflow.steps.some((step) => boundedEffectStepTypes.has(step.step_type));
}

/** The durable approval history can outlive `pendingApproval` after a decision. */
export function collectWorkflowEffectApprovals(
  approvals: WorkflowEngineApproval[],
  pendingApproval?: WorkflowEngineApproval | null,
): WorkflowEngineApproval[] {
  const records = new Map<string, WorkflowEngineApproval>();
  if (pendingApproval) records.set(pendingApproval.id, pendingApproval);
  approvals.forEach((approval) => records.set(approval.id, approval));
  return [...records.values()].sort((left, right) => {
    if (left.status === 'pending' && right.status !== 'pending') return -1;
    if (right.status === 'pending' && left.status !== 'pending') return 1;
    return right.requestedAt.getTime() - left.requestedAt.getTime();
  });
}

export function getWorkflowEffectExecutionSteps(execution?: WorkflowEngineExecution): WorkflowEffectExecutionStep[] {
  return execution?.steps.filter((step) => boundedEffectStepTypes.has(step.step_type)) ?? [];
}

/** Do not turn a review screen into a secret-exposure surface when results include arbitrary JSON. */
export function formatWorkflowEffectDetail(value: unknown): string {
  const formatted = JSON.stringify(value, (key, nestedValue) => (
    sensitiveDetailKey.test(key) ? '<REDACTED>' : nestedValue
  ), 2);
  return formatted ?? '';
}

export function getWorkflowEffectStatusKey(status: string): string {
  return `workspace.effects.status.${status}`;
}

export function getWorkflowEffectApprovalStatusKey(status: string): string {
  return `workspace.effects.approvalStatus.${status}`;
}
