import React, { useMemo, useState } from 'react';
import { Button, Empty } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import type { GovernanceSnapshot } from '@axi/workstation-contracts';
import { useI18n } from '../../i18n';

type GovernanceSummaryRow = {
  freshness: string;
  health: string;
  id: string;
  identity: string;
  name: string;
  objectType: string;
  owner: string;
  ownerEvidenceRef: string;
  ownerStatus: string;
};

export type GovernanceSummaryProps = {
  governance?: GovernanceSnapshot;
  onAutomationRun?: (automationId: string) => Promise<void>;
  automationRunPending?: boolean;
  onRiskTransition?: (input: { riskId: string; status: 'acknowledged' | 'resolved' | 'waived'; reason?: string }) => Promise<void>;
  riskTransitionPending?: boolean;
};

/** 根 PRD Phase 1 的只读治理态势摘要；详情仍通过项目 Inspector 查看。 */
export function GovernanceSummary({ governance, onAutomationRun, automationRunPending = false, onRiskTransition, riskTransitionPending = false }: GovernanceSummaryProps) {
  const { t } = useI18n();
  const units = governance?.units ?? [];
  const events = governance?.events ?? [];
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [surfaceFilter, setSurfaceFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [runFilter, setRunFilter] = useState('');
  const [riskReasons, setRiskReasons] = useState<Record<string, string>>({});
  const [riskTransitionError, setRiskTransitionError] = useState('');
  const rows = useMemo<GovernanceSummaryRow[]>(
    () => units.map((unit) => ({
      freshness: t(`projectDetail.governance.freshness.${unit.freshness}`, unit.freshness),
      health: t(`projectDetail.governance.health.status.${unit.health.status}`, unit.health.status),
      id: unit.id,
      identity: t(`projectDetail.governance.identity.${unit.identityStatus}`, unit.identityStatus),
      name: unit.name,
      objectType: t(`dashboard.governance.type.${unit.objectType}`, unit.objectType),
      owner: unit.ownerRef,
      ownerEvidenceRef: unit.ownerEvidenceRef || t('dashboard.governance.ownerEvidence.none'),
      ownerStatus: t(`dashboard.governance.ownerStatus.${unit.ownerStatus}`, unit.ownerStatus),
    })),
    [t, units],
  );
  const healthCounts = useMemo(
    () => units.reduce<Record<string, number>>((counts, unit) => {
      counts[unit.health.status] = (counts[unit.health.status] || 0) + 1;
      return counts;
    }, {}),
    [units],
  );
  const missingDocuments = governance?.documents.filter((document) => document.status === 'missing').length ?? 0;
  const openRisks = governance?.risks.filter((risk) => risk.status === 'open').length ?? 0;
  const openIncidents = governance?.incidents.filter((incident) => incident.status === 'open').length ?? 0;
  const openViolations = governance?.violations.filter((violation) => violation.status === 'open').length ?? 0;
  const activeWaivers = governance?.waivers.filter((waiver) => waiver.status === 'active').length ?? 0;
  const eventTypes = useMemo(
    () => [...new Set(events.map((event) => event.eventType))].sort(),
    [events],
  );
  const eventSurfaces = useMemo(
    () => [...new Set(events.map((event) => event.surfaceRef).filter((value): value is string => Boolean(value)))].sort(),
    [events],
  );
  const eventProjects = useMemo(
    () => [...new Set(events.map((event) => event.projectRef).filter((value): value is string => Boolean(value)))].sort(),
    [events],
  );
  const eventServices = useMemo(
    () => [...new Set(events.map((event) => event.serviceRef).filter((value): value is string => Boolean(value)))].sort(),
    [events],
  );
  const eventRuns = useMemo(
    () => [...new Set(events.map((event) => event.runRef).filter((value): value is string => Boolean(value)))].sort(),
    [events],
  );
  const visibleEvents = useMemo(
    () => events
      .filter((event) => !eventTypeFilter || event.eventType === eventTypeFilter)
      .filter((event) => !surfaceFilter || event.surfaceRef === surfaceFilter)
      .filter((event) => !projectFilter || event.projectRef === projectFilter)
      .filter((event) => !serviceFilter || event.serviceRef === serviceFilter)
      .filter((event) => !runFilter || event.runRef === runFilter)
      .slice(-20)
      .reverse(),
    [eventTypeFilter, events, projectFilter, runFilter, serviceFilter, surfaceFilter],
  );
  const transitionRisk = async (riskId: string, status: 'acknowledged' | 'resolved' | 'waived') => {
    if (!onRiskTransition) return;
    const reason = riskReasons[riskId]?.trim();
    if (status !== 'acknowledged' && !reason) return;
    setRiskTransitionError('');
    try {
      await onRiskTransition({ riskId, status, ...(reason ? { reason } : {}) });
      setRiskReasons((current) => ({ ...current, [riskId]: '' }));
    } catch {
      setRiskTransitionError(t('dashboard.governance.riskCenter.transitionError'));
    }
  };
  const columns: AxiTableColumn<GovernanceSummaryRow>[] = [
    { dataIndex: 'name', title: t('dashboard.governance.column.name'), width: 260 },
    { dataIndex: 'objectType', title: t('dashboard.governance.column.type'), width: 150 },
    { dataIndex: 'owner', title: t('dashboard.governance.column.owner'), width: 140 },
    { dataIndex: 'ownerEvidenceRef', title: t('dashboard.governance.column.ownerEvidence'), width: 220 },
    { dataIndex: 'ownerStatus', title: t('dashboard.governance.column.ownerStatus'), width: 120 },
    { dataIndex: 'identity', title: t('dashboard.governance.column.identity'), width: 120 },
    { dataIndex: 'health', title: t('dashboard.governance.column.health'), width: 120 },
    { dataIndex: 'freshness', title: t('dashboard.governance.column.freshness'), width: 130 },
  ];

  return (
    <AxiTableGroup
      className="dashboard-crud__governance"
      description={governance
        ? `${t('dashboard.governance.description')} · ${units.length}${t('dashboard.governance.unitCount')} · ${governance.evidence.length}${t('dashboard.governance.evidenceCount')} · ${governance.documents.length}${t('dashboard.governance.documentCount')} · ${governance.rules.length}${t('dashboard.governance.ruleCount')} · ${governance.risks.length}${t('dashboard.governance.riskCount')} · ${governance.incidents.length}${t('dashboard.governance.incidentCount')} · ${governance.violations.length}${t('dashboard.governance.violationCount')} · ${governance.waivers.length}${t('dashboard.governance.waiverCount')} · ${events.length}${t('dashboard.governance.eventCount')}`
        : t('dashboard.governance.unavailableDescription')}
      title={t('dashboard.governance.title')}
    >
      {!governance ? (
        <Empty description={t('dashboard.governance.unavailable')} />
      ) : (
        <>
          <div aria-label={t('dashboard.governance.healthSummary')} className="dashboard-crud__governance-stats">
            <span><strong>{t('dashboard.governance.total')}</strong>{units.length}</span>
            <span><strong>{t('dashboard.governance.warning')}</strong>{healthCounts.warning || 0}</span>
            <span><strong>{t('dashboard.governance.unknown')}</strong>{healthCounts.unknown || 0}</span>
            <span><strong>{t('dashboard.governance.conflict')}</strong>{governance.conflicts.length}</span>
            <span><strong>{t('dashboard.governance.missingDocuments')}</strong>{missingDocuments}</span>
            <span><strong>{t('dashboard.governance.openRisks')}</strong>{openRisks}</span>
            <span><strong>{t('dashboard.governance.openIncidents')}</strong>{openIncidents}</span>
            <span><strong>{t('dashboard.governance.openViolations')}</strong>{openViolations}</span>
            <span><strong>{t('dashboard.governance.activeWaivers')}</strong>{activeWaivers}</span>
            <span><strong>{t('dashboard.governance.ownerCoverage')}</strong>{governance.coverage.ownerResolvedCount}/{governance.coverage.unitCount}</span>
            <span><strong>{t('dashboard.governance.externalOwnerCount')}</strong>{governance.coverage.ownerExternalCount}</span>
            <span><strong>{t('dashboard.governance.partialIdentity')}</strong>{governance.coverage.identityPartialCount}</span>
            <span><strong>{t('dashboard.governance.executionCoverage')}</strong>{governance.executionCoverage ? `${governance.executionCoverage.healthDeclaredCount}/${governance.executionCoverage.declaredProjectCount} · ${governance.executionCoverage.verifyDeclaredCount}/${governance.executionCoverage.declaredProjectCount} · ${governance.executionCoverage.remediationDeclaredCount}/${governance.executionCoverage.declaredProjectCount}` : '-'}</span>
            <span><strong>{t('dashboard.governance.relationshipMetadataCoverage')}</strong>{governance.relationshipMetadataCoverage ? `${governance.relationshipMetadataCoverage.scopeDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount} · ${governance.relationshipMetadataCoverage.requirednessDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount} · ${governance.relationshipMetadataCoverage.dependencyPhaseDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount} · ${governance.relationshipMetadataCoverage.environmentDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount} · ${governance.relationshipMetadataCoverage.versionConstraintDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount} · ${governance.relationshipMetadataCoverage.validityWindowDeclaredCount}/${governance.relationshipMetadataCoverage.dependencyEdgeCount}` : '-'}</span>
            <span><strong>{t('dashboard.governance.relationshipMetadataGaps')}</strong>{governance.relationshipMetadataGaps?.length ?? 0}</span>
            <span><strong>{t('dashboard.governance.eventCoverage')}</strong>{governance.eventCoverage ? `${governance.eventCoverage.eventCount} / ${governance.eventCoverage.loadedSourceCount}/${governance.eventCoverage.declaredSourceCount} · ${governance.eventCoverage.surfaceCount}/${governance.eventCoverage.projectCount}/${governance.eventCoverage.serviceCount}` : '-'}</span>
          </div>
          <div className="dashboard-crud__governance-sources">
            <strong>{t('dashboard.governance.sources')}</strong>
            {Object.entries(governance.sources).map(([source, reference]) => (
              <span key={source}><b>{source}</b><code>{reference}</code></span>
            ))}
            {governance.authorization && (
              <span aria-label={t('dashboard.governance.authorization.title')}>
                <b>{t('dashboard.governance.authorization.title')}</b>
                <code>{t(`dashboard.governance.authorization.status.${governance.authorization.status}`, governance.authorization.status)}</code>
                <code>{governance.authorization.source || t('dashboard.governance.authorization.none')}</code>
                <em>{governance.authorization.grantCount}{t('dashboard.governance.authorization.grantCount')}</em>
              </span>
            )}
          </div>
          <section aria-label={t('dashboard.governance.riskCenter.title')} className="dashboard-crud__governance-risks">
            <h3>{t('dashboard.governance.riskCenter.title')}</h3>
            {governance.risks.length ? (
              <table aria-label={t('dashboard.governance.riskCenter.title')}>
                <thead>
                  <tr>
                    <th>{t('dashboard.governance.riskCenter.target')}</th>
                    <th>{t('dashboard.governance.riskCenter.severity')}</th>
                    <th>{t('dashboard.governance.riskCenter.status')}</th>
                    <th>{t('dashboard.governance.riskCenter.owner')}</th>
                    <th>{t('dashboard.governance.riskCenter.reason')}</th>
                    <th>{t('dashboard.governance.riskCenter.evidence')}</th>
                    <th>{t('dashboard.governance.riskCenter.policy')}</th>
                    {onRiskTransition ? <th>{t('dashboard.governance.riskCenter.actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {governance.risks.map((risk) => (
                    <tr key={risk.id}>
                      <td>{risk.targetRef}</td>
                      <td>{risk.severity}</td>
                      <td>{risk.status}</td>
                      <td>{risk.ownerRef}</td>
                      <td>{risk.reason}</td>
                      <td>{risk.evidenceRefs.join(', ') || t('dashboard.governance.activity.detail.none')}</td>
                      <td>{risk.policyDecisionRef || t('dashboard.governance.activity.detail.none')}</td>
                      {onRiskTransition ? (
                        <td>
                          {risk.status === 'open' ? <Button disabled={riskTransitionPending} size="small" onClick={() => void transitionRisk(risk.id, 'acknowledged')}>{t('dashboard.governance.riskCenter.acknowledge')}</Button> : null}
                          {['open', 'acknowledged'].includes(risk.status) ? (
                            <>
                              <input
                                aria-label={`${t('dashboard.governance.riskCenter.reasonForTransition')} ${risk.id}`}
                                disabled={riskTransitionPending}
                                value={riskReasons[risk.id] || ''}
                                onChange={(event) => setRiskReasons((current) => ({ ...current, [risk.id]: event.target.value }))}
                              />
                              <Button disabled={riskTransitionPending || !(riskReasons[risk.id] || '').trim()} size="small" onClick={() => void transitionRisk(risk.id, 'resolved')}>{t('dashboard.governance.riskCenter.resolve')}</Button>
                              <Button disabled={riskTransitionPending || !(riskReasons[risk.id] || '').trim()} size="small" onClick={() => void transitionRisk(risk.id, 'waived')}>{t('dashboard.governance.riskCenter.waive')}</Button>
                            </>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>{t('dashboard.governance.riskCenter.empty')}</p>}
            {riskTransitionError ? <p role="alert">{riskTransitionError}</p> : null}
          </section>
          <section aria-label={t('dashboard.governance.compliance.title')} className="dashboard-crud__governance-compliance">
            <h3>{t('dashboard.governance.compliance.title')}</h3>
            {governance.violations.length ? (
              <table aria-label={t('dashboard.governance.compliance.title')}>
                <thead>
                  <tr>
                    <th>{t('dashboard.governance.compliance.subject')}</th>
                    <th>{t('dashboard.governance.compliance.type')}</th>
                    <th>{t('dashboard.governance.compliance.status')}</th>
                    <th>{t('dashboard.governance.compliance.owner')}</th>
                    <th>{t('dashboard.governance.compliance.reason')}</th>
                    <th>{t('dashboard.governance.compliance.evidence')}</th>
                    <th>{t('dashboard.governance.compliance.events')}</th>
                    <th>{t('dashboard.governance.compliance.waiver')}</th>
                  </tr>
                </thead>
                <tbody>
                  {governance.violations.map((violation) => (
                    <tr key={violation.id}>
                      <td>{violation.subjectRef}</td>
                      <td>{violation.violationType}</td>
                      <td>{violation.status}</td>
                      <td>{violation.ownerRef}</td>
                      <td>{violation.reason}</td>
                      <td>{violation.evidenceRefs.join(', ') || t('dashboard.governance.activity.detail.none')}</td>
                      <td>{violation.eventRefs.join(', ') || t('dashboard.governance.activity.detail.none')}</td>
                      <td>{violation.waiverRef || t('dashboard.governance.activity.detail.none')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>{t('dashboard.governance.compliance.empty')}</p>}
          </section>
          {governance.policyDecisions.length ? (
            <section aria-label={t('dashboard.governance.policy.title')} className="dashboard-crud__governance-policies">
              <h3>{t('dashboard.governance.policy.title')}</h3>
              <table aria-label={t('dashboard.governance.policy.title')}>
                <thead><tr><th>{t('dashboard.governance.policy.subject')}</th><th>{t('dashboard.governance.policy.scope')}</th><th>{t('dashboard.governance.policy.resource')}</th><th>{t('dashboard.governance.policy.action')}</th><th>{t('dashboard.governance.policy.decision')}</th><th>{t('dashboard.governance.policy.reason')}</th><th>{t('dashboard.governance.policy.grants')}</th><th>{t('dashboard.governance.policy.version')}</th><th>{t('dashboard.governance.policy.events')}</th></tr></thead>
                <tbody>{governance.policyDecisions.map((decision) => <tr key={decision.id}><td>{decision.subjectRef}</td><td>{decision.scopeRef}</td><td>{decision.resourceRef}</td><td>{decision.action}</td><td>{decision.decision}</td><td>{decision.reason}</td><td>{decision.matchedGrantRefs.join(', ') || t('dashboard.governance.activity.detail.none')}</td><td>{decision.policyVersion}</td><td>{decision.eventRefs?.join(', ') || t('dashboard.governance.activity.detail.none')}</td></tr>)}</tbody>
              </table>
            </section>
          ) : null}
          {governance.automations.length ? (
            <section aria-label={t('dashboard.governance.automation.title')} className="dashboard-crud__governance-automations">
              <h3>{t('dashboard.governance.automation.title')}</h3>
              <table aria-label={t('dashboard.governance.automation.title')}>
                <thead>
                  <tr>
                    <th>{t('dashboard.governance.automation.id')}</th>
                    <th>{t('dashboard.governance.automation.target')}</th>
                    <th>{t('dashboard.governance.automation.owner')}</th>
                    <th>{t('dashboard.governance.automation.trigger')}</th>
                    <th>{t('dashboard.governance.automation.status')}</th>
                    <th>{t('dashboard.governance.automation.command')}</th>
                    <th>{t('dashboard.governance.automation.lastRun')}</th>
                    {onAutomationRun ? <th>{t('dashboard.governance.automation.actions')}</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {governance.automations.map((automation) => (
                    <tr key={automation.id}>
                      <td>{automation.id}</td>
                      <td>{automation.targetRef}</td>
                      <td>{automation.ownerRef}</td>
                      <td>{automation.trigger}{automation.intervalSeconds ? ` (${automation.intervalSeconds}s)` : ''}</td>
                      <td>{automation.status}</td>
                      <td>{automation.commandId}</td>
                      <td>{automation.lastRunAt ? new Date(automation.lastRunAt).toLocaleString() : t('dashboard.governance.activity.detail.none')}</td>
                      {onAutomationRun ? (
                        <td><Button disabled={automationRunPending || automation.status !== 'enabled'} size="small" onClick={() => void onAutomationRun(automation.id)}>{t('dashboard.governance.automation.run')}</Button></td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}
          <AxiTable columns={columns} data={rows} pagination={false} rowKey="id" />
          <section aria-label={t('dashboard.governance.activity.title')} className="dashboard-crud__governance-activity">
            <h3>{t('dashboard.governance.activity.title')}</h3>
            <label>
              {t('dashboard.governance.activity.filter.eventType')}
              <select aria-label={t('dashboard.governance.activity.filter.eventType')} value={eventTypeFilter} onChange={(event) => setEventTypeFilter(event.target.value)}>
                <option value="">{t('dashboard.governance.activity.filter.all')}</option>
                {eventTypes.map((eventType) => <option key={eventType} value={eventType}>{eventType}</option>)}
              </select>
            </label>
            <label>
              {t('dashboard.governance.activity.filter.surface')}
              <select aria-label={t('dashboard.governance.activity.filter.surface')} value={surfaceFilter} onChange={(event) => setSurfaceFilter(event.target.value)}>
                <option value="">{t('dashboard.governance.activity.filter.all')}</option>
                {eventSurfaces.map((surface) => <option key={surface} value={surface}>{surface}</option>)}
              </select>
            </label>
            <label>
              {t('dashboard.governance.activity.filter.project')}
              <select aria-label={t('dashboard.governance.activity.filter.project')} value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
                <option value="">{t('dashboard.governance.activity.filter.all')}</option>
                {eventProjects.map((project) => <option key={project} value={project}>{project}</option>)}
              </select>
            </label>
            <label>
              {t('dashboard.governance.activity.filter.service')}
              <select aria-label={t('dashboard.governance.activity.filter.service')} value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
                <option value="">{t('dashboard.governance.activity.filter.all')}</option>
                {eventServices.map((service) => <option key={service} value={service}>{service}</option>)}
              </select>
            </label>
            <label>
              {t('dashboard.governance.activity.filter.run')}
              <select aria-label={t('dashboard.governance.activity.filter.run')} value={runFilter} onChange={(event) => setRunFilter(event.target.value)}>
                <option value="">{t('dashboard.governance.activity.filter.all')}</option>
                {eventRuns.map((run) => <option key={run} value={run}>{run}</option>)}
              </select>
            </label>
            {visibleEvents.length ? (
              <table aria-label={t('dashboard.governance.activity.title')}>
                <thead>
                  <tr>
                    <th>{t('dashboard.governance.activity.column.eventType')}</th>
                    <th>{t('dashboard.governance.activity.column.surface')}</th>
                    <th>{t('dashboard.governance.activity.column.project')}</th>
                    <th>{t('dashboard.governance.activity.column.actor')}</th>
                    <th>{t('dashboard.governance.activity.column.object')}</th>
                    <th>{t('dashboard.governance.activity.column.result')}</th>
                    <th>{t('dashboard.governance.activity.column.occurredAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleEvents.map((event) => (
                    <tr key={event.eventId}>
                      <td>
                        <details>
                          <summary>{event.eventType}</summary>
                          <dl>
                            <dt>{t('dashboard.governance.activity.detail.eventId')}</dt><dd>{event.eventId}</dd>
                            <dt>{t('dashboard.governance.activity.detail.surface')}</dt><dd>{event.surfaceRef || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.project')}</dt><dd>{event.projectRef || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.service')}</dt><dd>{event.serviceRef || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.run')}</dt><dd>{event.runRef || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.correlationId')}</dt><dd>{event.correlationId}</dd>
                            <dt>{t('dashboard.governance.activity.detail.policyDecisionRef')}</dt><dd>{event.policyDecisionRef || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.evidenceRefs')}</dt><dd>{event.evidenceRefs.join(', ') || t('dashboard.governance.activity.detail.none')}</dd>
                            <dt>{t('dashboard.governance.activity.detail.integrity')}</dt><dd>{event.integrity.status}</dd>
                          </dl>
                        </details>
                      </td>
                      <td>{event.surfaceRef || t('dashboard.governance.activity.detail.none')}</td>
                      <td>{event.projectRef || t('dashboard.governance.activity.detail.none')}</td>
                      <td>{event.actorRef}</td>
                      <td>{event.objectRef}</td>
                      <td>{event.result}</td>
                      <td>{new Date(event.occurredAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <p>{t('dashboard.governance.activity.empty')}</p>}
          </section>
        </>
      )}
    </AxiTableGroup>
  );
}

export default GovernanceSummary;
