import { describe, expect, it } from 'vitest';
import type { WorkflowEngineApproval, WorkflowEngineExecution, WorkflowEngineWorkflow } from '@axi/workstation-contracts';

import {
  collectWorkflowEffectApprovals,
  formatWorkflowEffectDetail,
  getWorkflowEffectExecutionSteps,
  isBoundedEffectWorkflow,
} from './workflowEffects';

const workflow: WorkflowEngineWorkflow = {
  created_at: new Date('2026-08-11T00:00:00Z'),
  description: null,
  executed_at: new Date('2026-08-11T00:03:00Z'),
  id: '00000000-0000-4000-8000-000000000001',
  name: '发布文档变更',
  result: null,
  status: 'waiting_approval',
  steps: [
    {
      config: {},
      id: '00000000-0000-4000-8000-000000000002',
      name: '受限只读检查',
      result: null,
      status: 'completed',
      step_type: 'bounded_agent',
    },
    {
      config: {},
      id: '00000000-0000-4000-8000-000000000003',
      name: '写入文档',
      result: null,
      status: 'waiting',
      step_type: 'approved_effect',
    },
  ],
  triggerTopic: null,
  updated_at: new Date('2026-08-11T00:03:00Z'),
};

const approval: WorkflowEngineApproval = {
  actionDigest: 'a'.repeat(64),
  approvers: ['alice'],
  decidedAt: null,
  decidedBy: null,
  decisionComment: null,
  effectAction: { kind: 'document_write', target: 'docs/HANDOFF.md' },
  grantPermissions: ['documents.write'],
  id: '00000000-0000-4000-8000-000000000004',
  prompt: '批准该精确文档写入。',
  requestedAt: new Date('2026-08-11T00:02:00Z'),
  status: 'pending',
  stepId: '00000000-0000-4000-8000-000000000003',
  stepName: '写入文档',
  workflowId: workflow.id,
};

describe('bounded effect presentation', () => {
  it('保留当前审核、持久化 effect 明细和已执行步骤', () => {
    const execution: WorkflowEngineExecution = {
      completed_at: null,
      error: null,
      lifecycleEvents: [],
      pendingApproval: approval,
      result: null,
      routingDecisions: {},
      started_at: new Date('2026-08-11T00:01:00Z'),
      status: 'waiting_approval',
      steps: workflow.steps,
      workflow_id: workflow.id,
    };

    expect(isBoundedEffectWorkflow(workflow)).toBe(true);
    expect(collectWorkflowEffectApprovals([approval], execution.pendingApproval)).toEqual([approval]);
    expect(getWorkflowEffectExecutionSteps(execution).map((step) => step.step_type)).toEqual(['bounded_agent', 'approved_effect']);
  });

  it('脱敏任意执行结果中的凭据字段', () => {
    expect(formatWorkflowEffectDetail({ nested: { accessToken: 'secret-value' }, status: 'succeeded' }))
      .toContain('"accessToken": "<REDACTED>"');
  });
});
