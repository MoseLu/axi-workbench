import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import type { GovernanceDocument, GovernanceEvidence, GovernanceImpact, GovernancePolicyDecisionRecord, GovernanceUnit, GovernanceViolation, GovernanceWaiver } from '@axi/workstation-contracts';
import { AuthProvider } from '../../contexts/AuthContext';
import { I18nProvider } from '../../i18n';
import { GovernanceInspector } from './GovernanceInspector';

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

const unit: GovernanceUnit = {
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
  path: '/workspace/projects/axi-workbench',
  kind: 'axi-workbench-monorepo',
  declarations: {
    graph: '/workspace/workspace.graph.json',
    registry: '/workspace/infra/axi-workspace-governance/workspace.json',
  },
  relationships: [],
  policyBindings: [],
  evidenceRefs: ['evidence:axi-workbench:registry', 'evidence:axi-workbench:completion'],
  documentRefs: ['document:axi-workbench:1', 'document:axi-workbench:2'],
};

const impact: GovernanceImpact = {
  subjectRef: 'axi-workbench',
  directUpstreamRefs: ['axi-registry'],
  directDownstreamRefs: ['axi-coder'],
  transitiveUpstreamRefs: ['axi-registry'],
  transitiveDownstreamRefs: ['axi-coder'],
};

const documents: GovernanceDocument[] = [
  {
    id: 'document:axi-workbench:1',
    subjectRef: 'axi-workbench',
    ownerRef: 'libu',
    entrypoint: 'README.md',
    path: '/workspace/README.md',
    required: true,
    requirement: 'required',
    requirementSource: 'workspace.graph.docs_entrypoints',
    status: 'present',
    source: 'workspace.graph.docs_entrypoints',
    evidenceRef: 'evidence:axi-workbench:document:1',
  },
  {
    id: 'document:axi-workbench:2',
    subjectRef: 'axi-workbench',
    ownerRef: 'libu',
    entrypoint: 'docs/MISSING.md',
    path: '/workspace/docs/MISSING.md',
    required: true,
    requirement: 'required',
    requirementSource: 'workspace.graph.docs_entrypoints',
    status: 'missing',
    source: 'workspace.graph.docs_entrypoints',
    evidenceRef: 'evidence:axi-workbench:document:2',
  },
];

const evidence: GovernanceEvidence[] = [
  {
    id: 'evidence:axi-workbench:registry',
    observationKey: 'registry:axi-workbench',
    source: 'workspace.registry',
    evidenceType: 'declaration',
    observedAt: new Date('2026-09-13T00:00:00Z'),
    observer: 'axi-workstation-control-plane',
    confidence: 'high',
    expiresAt: null,
    freshness: 'not_configured',
    status: 'declared',
    subjectRef: 'axi-workbench',
    artifactRef: '/workspace/infra/axi-workspace-governance/workspace.json',
  },
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
    artifactRef: '/workspace/projects/axi-workbench/VERIFICATION.md',
  },
];

const violations: GovernanceViolation[] = [{
  id: 'violation:axi-workbench:docs', subjectRef: 'axi-workbench', violationType: 'document_missing', severity: 'warning', status: 'waived', ownerRef: 'libu', reason: 'document missing: docs/MISSING.md', evidenceRefs: ['evidence:axi-workbench:document:2'], eventRefs: [], source: 'workspace.graph.docs_entrypoints', detectedAt: new Date('2026-09-13T00:00:00Z'), waiverRef: 'waiver:risk:docs',
}];
const waivers: GovernanceWaiver[] = [{
  id: 'waiver:risk:docs', subjectRef: 'axi-workbench', sourceRiskRef: 'risk:docs', ownerRef: 'libu', reason: 'Temporary exception', status: 'active', evidenceRefs: [], eventRefs: [], issuedAt: new Date('2026-09-13T00:00:00Z'), expiresAt: new Date('2026-09-20T00:00:00Z'), source: 'control-plane.test',
}];
const policyDecisions: GovernancePolicyDecisionRecord[] = [{
  id: 'policy-decision:project', subjectRef: 'user:alice', scopeRef: 'workspace', resourceRef: 'axi-workbench', action: 'read', decision: 'allow', reason: 'matched grant', matchedGrantRefs: ['grant:read'], policyVersion: 'workspace-rbac-v1', correlationId: 'corr-policy', createdAt: new Date('2026-09-13T00:00:00Z'), expiresAt: null, evidenceRefs: [], denyPrecedence: true, eventRefs: ['event:policy'],
}];

function renderInspector() {
  return render(
    <AuthProvider>
      <WorkbenchLocaleProvider>
        <I18nProvider>
          <GovernanceInspector documents={documents} evidence={evidence} impact={impact} locale="zh-CN" unit={unit} violations={violations} waivers={waivers} policyDecisions={policyDecisions} />
        </I18nProvider>
      </WorkbenchLocaleProvider>
    </AuthProvider>,
  );
}

describe('GovernanceInspector', () => {
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

  it('renders identity, source declarations and evidence freshness from the typed projection', () => {
    renderInspector();

    expect(screen.getByText('治理事实与证据')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('基础健康解释 · 需关注');
    expect(screen.getByRole('alert')).toHaveTextContent('支持状态的证据已过期');
    expect(screen.getByRole('alert')).toHaveTextContent('刷新核验/验证证据');
    expect(screen.getByText('必需文档覆盖')).toBeInTheDocument();
    expect(screen.getByText('README.md')).toBeInTheDocument();
    expect(screen.getByText('缺失')).toBeInTheDocument();
    expect(screen.getAllByText('axi-registry')).toHaveLength(2);
    expect(screen.getAllByText('axi-coder')).toHaveLength(2);
    expect(screen.getAllByText('libu')).toHaveLength(5);
    expect(screen.getByText('active-canonical')).toBeInTheDocument();
    expect(screen.getByText('evidence:axi-workbench:registry')).toBeInTheDocument();
    expect(screen.getByText('document_missing')).toBeInTheDocument();
    expect(screen.getByText('document missing: docs/MISSING.md')).toBeInTheDocument();
    expect(screen.getByText('豁免详情')).toBeInTheDocument();
    expect(screen.getByText('Temporary exception')).toBeInTheDocument();
    expect(screen.getAllByText('权限决策')).toHaveLength(1);
    expect(screen.getAllByText('matched grant')).toHaveLength(1);
    expect(screen.getAllByText('已过期')).toHaveLength(2);
    expect(screen.getAllByText('/workspace/infra/axi-workspace-governance/workspace.json').length).toBeGreaterThanOrEqual(3);
  });

  it('shows an explicit unavailable state when the snapshot has no governance unit', () => {
    render(
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <I18nProvider>
            <GovernanceInspector evidence={[]} locale="zh-CN" />
          </I18nProvider>
        </WorkbenchLocaleProvider>
      </AuthProvider>,
    );

    expect(screen.getByText('当前快照没有该对象的治理投影')).toBeInTheDocument();
  });
});
