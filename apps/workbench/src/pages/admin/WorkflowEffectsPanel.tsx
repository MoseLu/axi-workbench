import React, { useMemo, useState } from 'react';
import { Alert, Button, Descriptions, Empty, Popconfirm, Space, Spin, Tag } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import {
  useDecideWorkflowEngineApproval,
  useWorkflowEngineApprovals,
  useWorkflowEngineExecution,
} from '@epap/api-client';
import type { WorkflowEngineApproval, WorkflowEngineWorkflow } from '@axi/workstation-contracts';
import { useI18n } from '../../i18n';
import {
  collectWorkflowEffectApprovals,
  formatWorkflowEffectDetail,
  getWorkflowEffectApprovalStatusKey,
  getWorkflowEffectExecutionSteps,
  getWorkflowEffectStatusKey,
  isBoundedEffectWorkflow,
} from './workflowEffects';

type WorkflowEffectsPanelProps = {
  error: unknown;
  isLoading: boolean;
  workflows: WorkflowEngineWorkflow[];
};

type WorkflowEffectRow = {
  id: string;
  name: string;
  status: string;
  updatedAt: Date;
};

/**
 * Web-only audit surface for the workflow-engine's bounded Agent/effect path.
 * It renders server-owned records and sends decisions only through the gateway.
 */
export function WorkflowEffectsPanel({ error, isLoading, workflows }: WorkflowEffectsPanelProps) {
  const { locale, t } = useI18n();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const effectWorkflows = useMemo(
    () => workflows.filter(isBoundedEffectWorkflow),
    [workflows],
  );
  const selectedWorkflow = effectWorkflows.find((workflow) => workflow.id === selectedWorkflowId) ?? effectWorkflows[0];
  const executionId = selectedWorkflow?.status === 'pending' ? '' : selectedWorkflow?.id ?? '';
  const executionQuery = useWorkflowEngineExecution(executionId);
  const approvalsQuery = useWorkflowEngineApprovals(selectedWorkflow?.id ?? '');
  const decideApproval = useDecideWorkflowEngineApproval();
  const rows = useMemo<WorkflowEffectRow[]>(
    () => effectWorkflows.map((workflow) => ({
      id: workflow.id,
      name: workflow.name,
      status: workflow.status,
      updatedAt: workflow.updated_at,
    })),
    [effectWorkflows],
  );
  const approvals = useMemo(
    () => collectWorkflowEffectApprovals(approvalsQuery.data ?? [], executionQuery.data?.pendingApproval),
    [approvalsQuery.data, executionQuery.data?.pendingApproval],
  );
  const effectSteps = useMemo(
    () => getWorkflowEffectExecutionSteps(executionQuery.data),
    [executionQuery.data],
  );
  const columns: AxiTableColumn<WorkflowEffectRow>[] = [
    { dataIndex: 'name', title: t('workspace.effects.column.workflow') },
    {
      dataIndex: 'status',
      render: (value) => <StatusTag label={t(getWorkflowEffectStatusKey(String(value)))} status={String(value)} />,
      title: t('workspace.effects.column.status'),
      width: 130,
    },
    {
      dataIndex: 'updatedAt',
      render: (value) => formatTime(value as Date, locale, t('workspace.time.unknown')),
      title: t('workspace.effects.column.updatedAt'),
      width: 170,
    },
    {
      dataIndex: 'id',
      render: (_value, row) => (
        <Button size="small" type="link" onClick={() => setSelectedWorkflowId(row.id)}>
          {t('workspace.effects.open')}
        </Button>
      ),
      title: t('workspace.effects.column.action'),
      width: 100,
    },
  ];

  return (
    <AxiTableGroup
      className="workspace-crud__effects"
      description={`${rows.length}${t('workspace.effects.count')}`}
      title={t('workspace.effects.title')}
    >
      {error ? <Alert description={t('workspace.effects.error.description')} showIcon title={t('workspace.effects.error.title')} type="warning" /> : null}
      {isLoading ? (
        <div aria-live="polite" className="workflow-effects__state">
          <Spin size="small" />
          <span>{t('workspace.effects.loading')}</span>
        </div>
      ) : rows.length === 0 ? (
        <Empty description={t('workspace.effects.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <AxiTable columns={columns} data={rows} pagination={false} rowKey="id" />
      )}

      {selectedWorkflow ? (
        <section aria-live="polite" className="workflow-effects__detail">
          <div className="workflow-effects__detail-heading">
            <div>
              <h3>{t('workspace.effects.detail.title')}</h3>
              <p>{selectedWorkflow.name}</p>
            </div>
            <StatusTag label={t(getWorkflowEffectStatusKey(executionQuery.data?.status ?? selectedWorkflow.status))} status={executionQuery.data?.status ?? selectedWorkflow.status} />
          </div>

          {executionQuery.isLoading || approvalsQuery.isLoading ? (
            <div className="workflow-effects__state"><Spin size="small" /><span>{t('workspace.effects.detail.loading')}</span></div>
          ) : null}
          {executionQuery.error || approvalsQuery.error ? (
            <Alert description={t('workspace.effects.detail.error.description')} showIcon title={t('workspace.effects.detail.error.title')} type="warning" />
          ) : null}

          <section className="workflow-effects__section">
            <h4>{t('workspace.effects.approvals.title')}</h4>
            {approvals.length === 0 ? <Empty description={t('workspace.effects.approvals.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : approvals.map((approval) => (
              <ApprovalDetail
                approval={approval}
                isDeciding={decideApproval.isPending}
                key={approval.id}
                locale={locale}
                onDecision={(decision) => selectedWorkflow && decideApproval.mutate({
                  approvalId: approval.id,
                  decision,
                  workflowId: selectedWorkflow.id,
                })}
                t={t}
              />
            ))}
            {decideApproval.isError ? <Alert description={t('workspace.effects.approvals.decisionError')} showIcon type="error" /> : null}
          </section>

          <section className="workflow-effects__section">
            <h4>{t('workspace.effects.execution.title')}</h4>
            {!executionQuery.data && !executionQuery.isLoading ? <Empty description={t('workspace.effects.execution.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
            {executionQuery.data ? (
              <>
                <Descriptions bordered column={1} size="small">
                  <Descriptions.Item label={t('workspace.effects.execution.status')}>
                    <StatusTag label={t(getWorkflowEffectStatusKey(executionQuery.data.status))} status={executionQuery.data.status} />
                  </Descriptions.Item>
                  <Descriptions.Item label={t('workspace.effects.execution.startedAt')}>
                    {formatTime(executionQuery.data.started_at, locale, t('workspace.time.unknown'))}
                  </Descriptions.Item>
                  <Descriptions.Item label={t('workspace.effects.execution.completedAt')}>
                    {formatTime(executionQuery.data.completed_at, locale, t('workspace.time.unknown'))}
                  </Descriptions.Item>
                  {executionQuery.data.error ? (
                    <Descriptions.Item label={t('workspace.effects.execution.error')}>{executionQuery.data.error}</Descriptions.Item>
                  ) : null}
                </Descriptions>
                <div className="workflow-effects__steps">
                  {effectSteps.length === 0 ? <Empty description={t('workspace.effects.execution.noEffectSteps')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : effectSteps.map((step) => (
                    <article className="workflow-effects__record" key={step.id}>
                      <div className="workflow-effects__record-heading">
                        <strong>{step.name}</strong>
                        <Space size={6} wrap>
                          <Tag>{t(`workspace.effects.step.${step.step_type}`)}</Tag>
                          <StatusTag label={t(getWorkflowEffectStatusKey(step.status))} status={step.status} />
                        </Space>
                      </div>
                      {step.error ? <Alert description={step.error} showIcon type="error" /> : null}
                      {step.result ? <JsonDetail value={step.result} /> : <p className="workflow-effects__muted">{t('workspace.effects.execution.noResult')}</p>}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </section>
        </section>
      ) : null}
    </AxiTableGroup>
  );
}

function ApprovalDetail({
  approval,
  isDeciding,
  locale,
  onDecision,
  t,
}: {
  approval: WorkflowEngineApproval;
  isDeciding: boolean;
  locale: string;
  onDecision: (decision: 'approved' | 'rejected') => void;
  t: (key: string) => string;
}) {
  return (
    <article className="workflow-effects__record">
      <div className="workflow-effects__record-heading">
        <strong>{approval.stepName}</strong>
        <StatusTag label={t(getWorkflowEffectApprovalStatusKey(approval.status))} status={approval.status} />
      </div>
      <p>{approval.prompt}</p>
      <Descriptions bordered column={1} size="small">
        <Descriptions.Item label={t('workspace.effects.approvals.requestedAt')}>
          {formatTime(approval.requestedAt, locale, t('workspace.time.unknown'))}
        </Descriptions.Item>
        <Descriptions.Item label={t('workspace.effects.approvals.permissions')}>
          {approval.grantPermissions.length ? approval.grantPermissions.join(', ') : t('workspace.effects.approvals.noPermissions')}
        </Descriptions.Item>
        <Descriptions.Item label={t('workspace.effects.approvals.digest')}>
          {approval.actionDigest ?? t('workspace.effects.approvals.noDigest')}
        </Descriptions.Item>
        {approval.decidedAt ? (
          <Descriptions.Item label={t('workspace.effects.approvals.decidedAt')}>
            {formatTime(approval.decidedAt, locale, t('workspace.time.unknown'))}
          </Descriptions.Item>
        ) : null}
        {approval.decidedBy ? (
          <Descriptions.Item label={t('workspace.effects.approvals.decidedBy')}>
            {approval.decidedBy}
          </Descriptions.Item>
        ) : null}
        {approval.decisionComment ? (
          <Descriptions.Item label={t('workspace.effects.approvals.comment')}>
            {approval.decisionComment}
          </Descriptions.Item>
        ) : null}
      </Descriptions>
      <h5>{t('workspace.effects.approvals.action')}</h5>
      {approval.effectAction ? <JsonDetail value={approval.effectAction} /> : <p className="workflow-effects__muted">{t('workspace.effects.approvals.noAction')}</p>}
      {approval.status === 'pending' ? (
        <Space className="workflow-effects__actions" size={8} wrap>
          <Popconfirm
            cancelText={t('workspace.effects.approvals.cancel')}
            description={t('workspace.effects.approvals.approveDescription')}
            okText={t('workspace.effects.approvals.approve')}
            onConfirm={() => onDecision('approved')}
            title={t('workspace.effects.approvals.approveTitle')}
          >
            <Button loading={isDeciding} size="small" type="primary">{t('workspace.effects.approvals.approve')}</Button>
          </Popconfirm>
          <Popconfirm
            cancelText={t('workspace.effects.approvals.cancel')}
            description={t('workspace.effects.approvals.rejectDescription')}
            okText={t('workspace.effects.approvals.reject')}
            onConfirm={() => onDecision('rejected')}
            title={t('workspace.effects.approvals.rejectTitle')}
          >
            <Button danger loading={isDeciding} size="small">{t('workspace.effects.approvals.reject')}</Button>
          </Popconfirm>
        </Space>
      ) : null}
    </article>
  );
}

function JsonDetail({ value }: { value: unknown }) {
  return <pre className="workflow-effects__json">{formatWorkflowEffectDetail(value)}</pre>;
}

function StatusTag({ label, status }: { label: string; status: string }) {
  const color = status === 'completed' || status === 'approved'
    ? 'success'
    : status === 'failed' || status === 'rejected' || status === 'cancelled'
      ? 'error'
      : status === 'waiting_approval' || status === 'waiting' || status === 'pending'
        ? 'warning'
        : 'processing';
  return <Tag color={color}>{label}</Tag>;
}

function formatTime(value: Date | string | null | undefined, locale: string, unknownText: string): string {
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
