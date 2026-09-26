import React, { useMemo } from 'react';
import { Alert, Descriptions, Empty } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import type { GovernanceDocument, GovernanceEvidence, GovernanceImpact, GovernancePolicyDecisionRecord, GovernanceUnit, GovernanceViolation, GovernanceWaiver } from '@axi/workstation-contracts';
import { useI18n } from '../../i18n';

type GovernanceEvidenceRow = {
  artifactRef: string;
  evidenceType: string;
  expiresAt: Date | string | null;
  freshness: string;
  id: string;
  observedAt: Date | string;
  source: string;
  status: string;
};

type GovernanceDocumentRow = {
  entrypoint: string;
  id: string;
  owner: string;
  path: string;
  requirement: string;
  source: string;
  status: string;
};

const healthAlertTypes: Record<GovernanceUnit['health']['status'], 'success' | 'warning' | 'error' | 'info'> = {
  healthy: 'success',
  warning: 'warning',
  critical: 'error',
  unknown: 'info',
};

export type GovernanceInspectorProps = {
  documents?: GovernanceDocument[];
  evidence: GovernanceEvidence[];
  locale: string;
  impact?: GovernanceImpact;
  policyDecisions?: GovernancePolicyDecisionRecord[];
  violations?: GovernanceViolation[];
  waivers?: GovernanceWaiver[];
  unit?: GovernanceUnit;
};

export function GovernanceInspector({ documents = [], evidence, impact, locale, unit, violations = [], waivers = [], policyDecisions = [] }: GovernanceInspectorProps) {
  const { t } = useI18n();
  const rows = useMemo<GovernanceEvidenceRow[]>(
    () => evidence.map((item) => ({
      artifactRef: item.artifactRef || t('projectDetail.governance.unknown'),
      evidenceType: t(`projectDetail.governance.evidenceType.${item.evidenceType}`, item.evidenceType),
      expiresAt: item.expiresAt,
      freshness: t(`projectDetail.governance.freshness.${item.freshness}`, item.freshness),
      id: item.id,
      observedAt: item.observedAt,
      source: item.source,
      status: item.status,
    })),
    [evidence, t],
  );
  const columns: AxiTableColumn<GovernanceEvidenceRow>[] = [
    { dataIndex: 'evidenceType', title: t('projectDetail.governance.column.type'), width: 100 },
    { dataIndex: 'source', title: t('projectDetail.governance.column.source'), width: 190 },
    { dataIndex: 'status', title: t('projectDetail.governance.column.status'), width: 120 },
    { dataIndex: 'freshness', title: t('projectDetail.governance.column.freshness'), width: 120 },
    { dataIndex: 'observedAt', render: (value) => formatTime(value, locale, t('projectDetail.governance.unknown')), title: t('projectDetail.governance.column.observedAt'), width: 150 },
    { dataIndex: 'expiresAt', render: (value) => value ? formatTime(value, locale, t('projectDetail.governance.unknown')) : t('projectDetail.governance.notConfigured'), title: t('projectDetail.governance.column.expiresAt'), width: 150 },
    { dataIndex: 'artifactRef', render: (value) => <code className="governance-inspector__artifact">{value}</code>, title: t('projectDetail.governance.column.artifact') },
  ];
  const documentRows = useMemo<GovernanceDocumentRow[]>(
    () => documents.map((item) => ({
      entrypoint: item.entrypoint,
      id: item.id,
      owner: item.ownerRef,
      path: item.path || t('projectDetail.governance.unknown'),
      requirement: item.requirement,
      source: item.source,
      status: t(`projectDetail.governance.documentStatus.${item.status}`, item.status),
    })),
    [documents, t],
  );
  const documentColumns: AxiTableColumn<GovernanceDocumentRow>[] = [
    { dataIndex: 'entrypoint', title: t('projectDetail.governance.documents.column.entrypoint'), width: 180 },
    { dataIndex: 'requirement', title: t('projectDetail.governance.documents.column.requirement'), width: 110 },
    { dataIndex: 'status', title: t('projectDetail.governance.documents.column.status'), width: 100 },
    { dataIndex: 'owner', title: t('projectDetail.governance.documents.column.owner'), width: 130 },
    { dataIndex: 'source', title: t('projectDetail.governance.documents.column.source'), width: 190 },
    { dataIndex: 'path', render: (value) => <code className="governance-inspector__artifact">{value}</code>, title: t('projectDetail.governance.documents.column.path') },
  ];

  return (
    <AxiTableGroup
      className="governance-inspector"
      description={unit ? `${rows.length}${t('projectDetail.governance.evidenceCount')}` : t('projectDetail.governance.unavailableDescription')}
      title={t('projectDetail.governance.title')}
    >
      {!unit ? (
        <Empty description={t('projectDetail.governance.unavailable')} />
      ) : (
        <>
          <Descriptions column={2} colon={false} size="small">
            <Descriptions.Item label={t('projectDetail.governance.objectType')}>{unit.objectType}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.owner')}>{unit.ownerRef}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.ownerEvidence')}>{unit.ownerEvidenceRef || t('projectDetail.governance.none')}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.ownerStatus')}>{t(`projectDetail.governance.ownerStatus.${unit.ownerStatus}`, unit.ownerStatus)}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.lifecycle')}>{unit.lifecycle}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.identity')}>{t(`projectDetail.governance.identity.${unit.identityStatus}`, unit.identityStatus)}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.status')}>{unit.status}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.freshness')}>{t(`projectDetail.governance.freshness.${unit.freshness}`, unit.freshness)}</Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.sourceOfTruth')} span={2}><code className="governance-inspector__artifact">{unit.sourceOfTruth}</code></Descriptions.Item>
            <Descriptions.Item label={t('projectDetail.governance.declarations')} span={2}>
              <div className="governance-inspector__declarations">
                {Object.entries(unit.declarations).map(([source, reference]) => <span key={source}><strong>{source}</strong><code className="governance-inspector__artifact">{reference}</code></span>)}
              </div>
            </Descriptions.Item>
            {impact ? (
              <>
                <Descriptions.Item label={t('projectDetail.governance.impact.directUpstream')}>{formatRefs(impact.directUpstreamRefs, t('projectDetail.governance.none'))}</Descriptions.Item>
                <Descriptions.Item label={t('projectDetail.governance.impact.directDownstream')}>{formatRefs(impact.directDownstreamRefs, t('projectDetail.governance.none'))}</Descriptions.Item>
                <Descriptions.Item label={t('projectDetail.governance.impact.transitiveUpstream')} span={2}>{formatRefs(impact.transitiveUpstreamRefs, t('projectDetail.governance.none'))}</Descriptions.Item>
                <Descriptions.Item label={t('projectDetail.governance.impact.transitiveDownstream')} span={2}>{formatRefs(impact.transitiveDownstreamRefs, t('projectDetail.governance.none'))}</Descriptions.Item>
              </>
            ) : null}
          </Descriptions>
          {documentRows.length ? (
            <div className="governance-inspector__documents">
              <h4>{t('projectDetail.governance.documents.title')}</h4>
              <AxiTable columns={documentColumns} data={documentRows} pagination={false} rowKey="id" />
            </div>
          ) : null}
          {violations.length ? (
            <div className="governance-inspector__compliance">
              <h4>{t('projectDetail.governance.compliance.title')}</h4>
              <table aria-label={t('projectDetail.governance.compliance.title')}>
                <thead><tr><th>{t('projectDetail.governance.compliance.type')}</th><th>{t('projectDetail.governance.compliance.status')}</th><th>{t('projectDetail.governance.compliance.owner')}</th><th>{t('projectDetail.governance.compliance.reason')}</th><th>{t('projectDetail.governance.compliance.evidence')}</th><th>{t('projectDetail.governance.compliance.events')}</th><th>{t('projectDetail.governance.compliance.waiver')}</th></tr></thead>
                <tbody>{violations.map((violation) => <tr key={violation.id}><td>{violation.violationType}</td><td>{violation.status}</td><td>{violation.ownerRef}</td><td>{violation.reason}</td><td>{violation.evidenceRefs.join(', ') || t('projectDetail.governance.none')}</td><td>{violation.eventRefs.join(', ') || t('projectDetail.governance.none')}</td><td>{violation.waiverRef || t('projectDetail.governance.none')}</td></tr>)}</tbody>
              </table>
              {waivers.length ? <p>{t('projectDetail.governance.compliance.activeWaivers')}: {waivers.filter((waiver) => waiver.status === 'active').length}</p> : null}
            </div>
          ) : null}
          {waivers.length ? (
            <div className="governance-inspector__waivers">
              <h4>{t('projectDetail.governance.waivers.title')}</h4>
              <table aria-label={t('projectDetail.governance.waivers.title')}>
                <thead><tr><th>{t('projectDetail.governance.waivers.status')}</th><th>{t('projectDetail.governance.waivers.owner')}</th><th>{t('projectDetail.governance.waivers.reason')}</th><th>{t('projectDetail.governance.waivers.expiresAt')}</th><th>{t('projectDetail.governance.waivers.sourceRisk')}</th></tr></thead>
                <tbody>{waivers.map((waiver) => <tr key={waiver.id}><td>{waiver.status}</td><td>{waiver.ownerRef}</td><td>{waiver.reason}</td><td>{waiver.expiresAt ? formatTime(waiver.expiresAt, locale, t('projectDetail.governance.unknown')) : t('projectDetail.governance.notConfigured')}</td><td>{waiver.sourceRiskRef}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
          {policyDecisions.length ? (
            <div className="governance-inspector__policies">
              <h4>{t('projectDetail.governance.policy.title')}</h4>
              <table aria-label={t('projectDetail.governance.policy.title')}>
                <thead><tr><th>{t('projectDetail.governance.policy.subject')}</th><th>{t('projectDetail.governance.policy.scope')}</th><th>{t('projectDetail.governance.policy.action')}</th><th>{t('projectDetail.governance.policy.decision')}</th><th>{t('projectDetail.governance.policy.reason')}</th><th>{t('projectDetail.governance.policy.grants')}</th><th>{t('projectDetail.governance.policy.version')}</th><th>{t('projectDetail.governance.policy.events')}</th></tr></thead>
                <tbody>{policyDecisions.map((decision) => <tr key={decision.id}><td>{decision.subjectRef}</td><td>{decision.scopeRef}</td><td>{decision.action}</td><td>{decision.decision}</td><td>{decision.reason}</td><td>{decision.matchedGrantRefs.join(', ') || t('projectDetail.governance.none')}</td><td>{decision.policyVersion}</td><td>{decision.eventRefs?.join(', ') || t('projectDetail.governance.none')}</td></tr>)}</tbody>
              </table>
            </div>
          ) : null}
          <Alert
            className="governance-inspector__health"
            description={(
              <div className="governance-inspector__health-details">
                <span><strong>{t('projectDetail.governance.health.reason')}</strong>{t(`projectDetail.governance.health.reason.${unit.health.reason}`, unit.health.reason)}</span>
                <span><strong>{t('projectDetail.governance.health.action')}</strong>{t(`projectDetail.governance.health.action.${unit.health.recommendedAction}`, unit.health.recommendedAction)}</span>
                <span><strong>{t('projectDetail.governance.health.evidence')}</strong>{unit.health.evidenceRefs.length}{t('projectDetail.governance.evidenceCount')}</span>
              </div>
            )}
            showIcon
            title={`${t('projectDetail.governance.health.title')} · ${t(`projectDetail.governance.health.status.${unit.health.status}`, unit.health.status)}`}
            type={healthAlertTypes[unit.health.status]}
          />
          <div className="governance-inspector__evidence">
            <AxiTable columns={columns} data={rows} pagination={false} rowKey="id" />
          </div>
        </>
      )}
    </AxiTableGroup>
  );
}

function formatRefs(refs: string[], emptyText: string): string {
  return refs.length ? refs.join(', ') : emptyText;
}

function formatTime(value: Date | string | undefined, locale: string, unknownText: string): string {
  if (!value) return unknownText;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return unknownText;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
  }).format(date);
}
