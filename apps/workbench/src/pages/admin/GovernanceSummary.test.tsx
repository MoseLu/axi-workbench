import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import type { GovernanceSnapshot } from '@axi/workstation-contracts';
import { AuthProvider } from '../../contexts/AuthContext';
import { I18nProvider } from '../../i18n';
import { GovernanceSummary } from './GovernanceSummary';

vi.mock('@axi/crud', () => ({
  AxiTableGroup: ({ children, className, description, title }: { children?: React.ReactNode; className?: string; description?: string; title?: string }) => (
    <section className={className}>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
  AxiTable: ({ columns, data }: { columns: Array<{ dataIndex: string; render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode }>; data: Array<Record<string, unknown>> }) => (
    <table>
      <tbody>
        {data.map((row) => (
          <tr key={String(row.id)}>
            {columns.map((column) => <td key={column.dataIndex}>{column.render ? column.render(row[column.dataIndex], row) : String(row[column.dataIndex] ?? '')}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  ),
}));

const governance: GovernanceSnapshot = {
  contractVersion: 1,
  generatedAt: new Date('2026-09-13T00:00:00Z'),
  sources: {
    graph: '/workspace/workspace.graph.json',
    registry: '/workspace/infra/axi-workspace-governance/workspace.json',
  },
  authorization: {
    status: 'unconfigured',
    source: null,
    ownerRef: 'unknown',
    policyVersion: 'workspace-rbac-v1',
    grantCount: 0,
    warnings: ['workspace_rbac_grants_unconfigured'],
  },
  units: [
    {
      id: 'axi-workbench',
      objectType: 'project',
      name: 'Axi Workbench',
      scope: 'workspace',
      ownerRef: 'libu',
      ownerEvidenceRef: 'evidence:axi-workbench:registry',
      ownerStatus: 'resolved',
      lifecycle: 'active-canonical',
      status: 'available',
      identityStatus: 'aligned',
      freshness: 'stale',
      health: {
      status: 'warning',
      reason: 'evidence_stale',
      evidenceRefs: ['evidence:axi-workbench:completion'],
        affectedObjectRefs: ['axi-workbench'],
        ownerRef: 'libu',
        recommendedAction: 'refresh_verification_evidence',
      },
      sourceOfTruth: '/workspace/infra/axi-workspace-governance/workspace.json',
      declarations: {
        graph: '/workspace/workspace.graph.json',
        registry: '/workspace/infra/axi-workspace-governance/workspace.json',
      },
      relationships: [],
      policyBindings: [],
      evidenceRefs: ['evidence:axi-workbench:completion'],
      documentRefs: [],
    },
    {
      id: 'graph-only',
      objectType: 'capability',
      name: 'Graph-only capability',
      scope: 'workspace',
      ownerRef: 'unknown',
      ownerStatus: 'unknown',
      lifecycle: 'unknown',
      status: 'unknown',
      identityStatus: 'partial',
      freshness: 'unknown',
      health: {
      status: 'unknown',
      reason: 'owner_unresolved',
      evidenceRefs: [],
        affectedObjectRefs: ['graph-only'],
        ownerRef: 'unknown',
        recommendedAction: 'resolve_owner_mapping',
      },
      sourceOfTruth: '/workspace/workspace.graph.json',
      declarations: { graph: '/workspace/workspace.graph.json' },
      relationships: [],
      policyBindings: [],
      evidenceRefs: [],
      documentRefs: [],
    },
  ],
  evidence: [
    {
      id: 'evidence:axi-workbench:completion',
      observationKey: 'completion:axi-workbench',
      source: 'workspace.graph.completion',
      evidenceType: 'declaration',
      observedAt: new Date('2026-05-30T00:00:00Z'),
      observer: 'axi-workstation-control-plane',
      confidence: 'medium',
      expiresAt: new Date('2026-06-29T00:00:00Z'),
      freshness: 'stale',
      status: 'building',
      subjectRef: 'axi-workbench',
      artifactRef: '/workspace/VERIFICATION.md',
    },
  ],
  relationships: [],
  impact: [],
  coverage: {
    unitCount: 2,
    ownerResolvedCount: 1,
    ownerUnknownCount: 1,
    ownerExternalCount: 0,
    identityAlignedCount: 1,
    identityPartialCount: 1,
    identityConflictCount: 0,
  },
  executionCoverage: {
    declaredProjectCount: 2,
    healthDeclaredCount: 2,
    verifyDeclaredCount: 1,
    remediationDeclaredCount: 0,
  },
  relationshipMetadataCoverage: {
    dependencyEdgeCount: 0,
    scopeDeclaredCount: 0,
    requirednessDeclaredCount: 0,
    dependencyPhaseDeclaredCount: 0,
    environmentDeclaredCount: 0,
    versionConstraintDeclaredCount: 0,
    validityWindowDeclaredCount: 0,
  },
  relationshipMetadataGaps: [],
  eventCoverage: {
    declaredSourceCount: 1,
    loadedSourceCount: 1,
    eventCount: 1,
    surfaceCount: 1,
    projectCount: 1,
    serviceCount: 1,
  },
  documents: [],
  rules: [],
  violations: [{
    id: 'violation:graph-only:owner',
    subjectRef: 'graph-only',
    violationType: 'declaration_conflict',
    severity: 'warning',
    status: 'open',
    ownerRef: 'unknown',
    reason: 'conflicting declaration: ownerRef',
    evidenceRefs: ['evidence:graph-only:conflict'],
    eventRefs: [],
    source: 'control-plane.conflict-projection',
    detectedAt: new Date('2026-09-13T00:00:00Z'),
  }],
  waivers: [],
  risks: [{
    id: 'risk:job-1',
    targetRef: 'axi-workbench',
    riskType: 'execution_failure',
    severity: 'critical',
    likelihood: 'likely',
    status: 'open',
    ownerRef: 'unknown',
    reason: 'Agent runtime unavailable',
    sourceAssessmentRef: 'job-1',
    policyDecisionRef: 'policy-decision:1',
    evidenceRefs: ['evidence:execution:1'],
    correlationId: 'corr-risk-1',
    detectedAt: new Date('2026-09-13T02:00:00Z'),
    dueAt: null,
    resolvedAt: null,
    source: 'control-plane.execution',
    incidentRef: 'incident:job-1',
  }],
  incidents: [{
    id: 'incident:job-1',
    riskRef: 'risk:job-1',
    targetRef: 'axi-workbench',
    severity: 'critical',
    status: 'open',
    ownerRef: 'unknown',
    summary: 'Agent runtime unavailable',
    evidenceRefs: ['evidence:execution:1'],
    correlationId: 'corr-risk-1',
    createdAt: new Date('2026-09-13T02:00:00Z'),
    resolvedAt: null,
    source: 'control-plane.execution',
  }],
  automations: [{
    id: 'automation:health',
    targetRef: 'axi-workbench',
    ownerRef: 'libu',
    source: 'workspace.graph',
    commandId: 'axi-workbench:run_health:0',
    policyAction: 'execute',
    trigger: 'interval',
    intervalSeconds: 3600,
    status: 'enabled',
    enabled: true,
    evidenceRefs: ['evidence:axi-workbench:completion'],
    lastRunAt: new Date('2026-09-13T01:00:00Z'),
  }],
  policyDecisions: [{
    id: 'policy-decision:1', subjectRef: 'user:alice', scopeRef: 'workspace', resourceRef: 'axi-workbench', action: 'read', decision: 'allow', reason: 'matched grant', matchedGrantRefs: ['grant:read'], policyVersion: 'workspace-rbac-v1', correlationId: 'corr-policy-1', createdAt: new Date('2026-09-13T00:00:00Z'), expiresAt: null, evidenceRefs: ['evidence:policy:1'], denyPrecedence: true, eventRefs: ['event:policy:1'],
  }],
  events: [{
    eventId: 'event-1',
    eventType: 'job.completed',
    occurredAt: new Date('2026-09-13T02:00:00Z'),
    recordedAt: new Date('2026-09-13T02:00:01Z'),
    actorRef: 'agent:worker',
    surfaceRef: 'devsvc',
    projectRef: 'axi-workbench',
    serviceRef: 'axi-workbench-api-gateway',
    runRef: 'run-1',
    scopeRef: 'workspace',
    objectRef: 'axi-workbench',
    action: 'completed',
    correlationId: 'corr-1',
    evidenceRefs: [],
    result: 'completed',
    source: 'control-plane.audit.jsonl',
    retentionClass: 'default',
    immutable: true,
    integrity: {
      status: 'verified',
      hash: 'hash-1',
      previousHash: null,
    },
  }],
  conflicts: [{ subjectRef: 'graph-only', field: 'ownerRef', values: [{ source: 'workspace.graph', value: 'unknown' }, { source: 'workspace.registry', value: 'owner' }] }],
  warnings: ['evidence_stale:axi-workbench:completion'],
  governanceDocuments: [],
};

function renderSummary(value: GovernanceSnapshot | undefined, props: { onAutomationRun?: (automationId: string) => Promise<void>; automationRunPending?: boolean; onRiskTransition?: (input: { riskId: string; status: 'acknowledged' | 'resolved' | 'waived'; reason?: string }) => Promise<void>; riskTransitionPending?: boolean } = {}) {
  return render(
    <AuthProvider>
      <WorkbenchLocaleProvider>
        <I18nProvider>
          <GovernanceSummary governance={value} {...props} />
        </I18nProvider>
      </WorkbenchLocaleProvider>
    </AuthProvider>,
  );
}

describe('GovernanceSummary', () => {
  beforeAll(() => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      addEventListener: vi.fn(),
      addListener: vi.fn(),
      dispatchEvent: vi.fn(),
      matches: false,
      media: query,
      onchange: null,
      removeEventListener: vi.fn(),
      removeListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  });

  afterEach(() => cleanup());

  it('renders the workspace-level governance counts, sources and health states', () => {
    renderSummary(governance);

    expect(screen.getByText('治理态势')).toBeInTheDocument();
    expect(screen.getByText(/2 个治理单元 · 1 条证据/)).toBeInTheDocument();
    expect(screen.getByText(/1 条工作区事件/)).toBeInTheDocument();
    expect(screen.getByText(/1 个风险 · 1 个事件单/)).toBeInTheDocument();
    expect(screen.getByText('风险与事件单')).toBeInTheDocument();
    expect(screen.getByText('合规问题')).toBeInTheDocument();
    expect(screen.getByText('权限决策')).toBeInTheDocument();
    expect(screen.getByText('matched grant')).toBeInTheDocument();
    expect(screen.getByText('conflicting declaration: ownerRef')).toBeInTheDocument();
    expect(screen.getByText(/Owner 覆盖：/)).toBeInTheDocument();
    expect(screen.getByText('evidence:axi-workbench:registry')).toBeInTheDocument();
    expect(screen.getByText(/执行覆盖（health \/ verify \/ remediation）：/)).toBeInTheDocument();
    expect(screen.getByText(/关系元数据（scope \/ requiredness \/ phase \/ environment \/ version \/ 有效期）：/)).toBeInTheDocument();
    expect(screen.getByText(/事件覆盖（事件 \/ 已加载源 \/ 声明源；surface \/ 项目 \/ 服务）：/)).toBeInTheDocument();
    expect(screen.getByText('注册自动化')).toBeInTheDocument();
    expect(screen.getByText('automation:health')).toBeInTheDocument();
    expect(screen.getByText('axi-workbench:run_health:0')).toBeInTheDocument();
    expect(screen.getByText('Agent runtime unavailable')).toBeInTheDocument();
    expect(screen.getByText('policy-decision:1')).toBeInTheDocument();
    expect(screen.getByText('evidence:execution:1')).toBeInTheDocument();
    expect(screen.getByText('Axi Workbench')).toBeInTheDocument();
    expect(screen.getByText('需关注')).toBeInTheDocument();
    expect(screen.getAllByText('未知')).toHaveLength(3);
    expect(screen.getByText('/workspace/workspace.graph.json')).toBeInTheDocument();
    expect(screen.getByText('未配置')).toBeInTheDocument();
    expect(screen.getByText('未登记')).toBeInTheDocument();
    expect(screen.getAllByText('job.completed')).toHaveLength(2);
    expect(screen.getByText('agent:worker')).toBeInTheDocument();
    expect(screen.getByText('corr-1')).toBeInTheDocument();
    expect(screen.getByText('verified')).toBeInTheDocument();
    expect(screen.getByLabelText('Surface')).toBeInTheDocument();
    expect(screen.getByLabelText('项目')).toBeInTheDocument();
    expect(screen.getByLabelText('服务')).toBeInTheDocument();
    expect(screen.getByLabelText('Run')).toBeInTheDocument();
    expect(screen.getAllByText('devsvc').length).toBeGreaterThan(0);
    expect(screen.getAllByText('axi-workbench-api-gateway').length).toBeGreaterThan(0);
    expect(screen.getAllByText('run-1').length).toBeGreaterThan(0);
  });

  it('keeps an absent governance projection explicit', () => {
    renderSummary(undefined);

    expect(screen.getByText('当前快照没有治理投影')).toBeInTheDocument();
  });

  it('submits risk lifecycle changes through the supplied authenticated callback', async () => {
    const onRiskTransition = vi.fn().mockResolvedValue(undefined);
    renderSummary(governance, { onRiskTransition });

    fireEvent.click(screen.getByRole('button', { name: '确认关注' }));
    await waitFor(() => expect(onRiskTransition).toHaveBeenCalledWith({ riskId: 'risk:job-1', status: 'acknowledged' }));

    fireEvent.change(screen.getByLabelText('状态变更理由 risk:job-1'), { target: { value: '运行时已恢复' } });
    fireEvent.click(screen.getByRole('button', { name: /解\s*决/ }));
    await waitFor(() => expect(onRiskTransition).toHaveBeenCalledWith({ riskId: 'risk:job-1', status: 'resolved', reason: '运行时已恢复' }));
  });

  it('submits enabled automation runs through the supplied authenticated callback', async () => {
    const onAutomationRun = vi.fn().mockResolvedValue(undefined);
    renderSummary(governance, { onAutomationRun });

    fireEvent.click(screen.getByRole('button', { name: /运\s*行/ }));
    await waitFor(() => expect(onAutomationRun).toHaveBeenCalledWith('automation:health'));
  });
});
