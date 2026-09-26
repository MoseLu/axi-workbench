import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { AxiDialog, AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { AxiBanner, AxiRow } from '@axi/widgets';
import { AxiDescriptions, type AxiDescriptionsItem } from '@axi/core';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';

type HandoffRecord = {
  id: string;
  handoffCorrelationId: string;
  sourceSurface: string;
  targetSurface: string;
  status: string;
  approvalId: string | null;
  sourceActorRef?: string | null;
  object: { projectId: string | null; actionId: string | null; actionType: string | null };
  impact: string;
  riskLevel: string;
  createdAt: string;
  expiresAt?: string;
  expiredAt?: string;
  openedAt?: string;
  openedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  finalAction?: { outcome: string; performedBy: string; occurredAt: string };
};

type CurrentProjectState = {
  name: string;
  status: string;
  summary?: string;
  observedAt: string;
};

type ControlPlaneSnapshot = {
  generatedAt: string;
  resources?: Array<{ id: string; name: string; status?: string }>;
  axiResources?: { project?: Array<{ id: string; resourceId?: string; label: string; status?: string; summary?: string }> };
};

function formatTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(value));
}

async function fetchCurrentProjectState(projectId: string): Promise<CurrentProjectState> {
  const response = await fetch(resolveGatewayURL('/api/v1/control-plane/snapshot'), {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('current project state unavailable');
  const snapshot = await response.json() as ControlPlaneSnapshot;
  const current = snapshot.axiResources?.project?.find((resource) => resource.resourceId === projectId || resource.id === projectId)
    || snapshot.resources?.find((resource) => resource.id === projectId);
  if (!current) throw new Error('current project not found');
  return {
    name: 'label' in current ? current.label : current.name,
    status: current.status || 'unknown',
    summary: 'summary' in current ? current.summary : undefined,
    observedAt: snapshot.generatedAt,
  };
}

/** Desktop continuation for a server-created mobile handoff. */
export default function Handoff() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [handoff, setHandoff] = useState<HandoffRecord | null>(null);
  const [currentProject, setCurrentProject] = useState<CurrentProjectState | null>(null);
  const [history, setHistory] = useState<HandoffRecord[]>([]);
  const [historyStatus, setHistoryStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    try {
      const endpoint = id
        ? `/api/v1/handoffs/${encodeURIComponent(id)}`
        : `/api/v1/handoffs${historyStatus ? `?status=${encodeURIComponent(historyStatus)}` : ''}`;
      const response = await fetch(resolveGatewayURL(endpoint), { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('handoff unavailable');
      const payload = await response.json() as HandoffRecord | { handoffs?: HandoffRecord[] };
      if (id) {
        const nextHandoff = payload as HandoffRecord;
        const nextProject = nextHandoff.object.projectId ? await fetchCurrentProjectState(nextHandoff.object.projectId) : null;
        setHandoff(nextHandoff);
        setCurrentProject(nextProject);
      } else {
        setHistory(Array.isArray((payload as { handoffs?: HandoffRecord[] }).handoffs) ? (payload as { handoffs: HandoffRecord[] }).handoffs : []);
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [historyStatus, id]);

  useEffect(() => { void load(); }, [load]);

  const complete = async () => {
    if (!handoff) return;
    setSubmitting(true);
    try {
      const response = await fetch(resolveGatewayURL(`/api/v1/handoffs/${encodeURIComponent(handoff.id)}`), {
        method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome: 'completed_in_web_control_center' }),
      });
      if (!response.ok) throw new Error('completion failed');
      const nextHandoff = await response.json() as HandoffRecord;
      const nextProject = nextHandoff.object.projectId ? await fetchCurrentProjectState(nextHandoff.object.projectId) : null;
      setHandoff(nextHandoff);
      setCurrentProject(nextProject);
      setConfirming(false);
    } catch { setError(true); }
    finally { setSubmitting(false); }
  };

  const reject = async () => {
    if (!handoff || !rejectionReason.trim()) return;
    setSubmitting(true);
    try {
      const response = await fetch(resolveGatewayURL(`/api/v1/handoffs/${encodeURIComponent(handoff.id)}`), {
        method: 'POST', credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', reason: rejectionReason.trim() }),
      });
      if (!response.ok) throw new Error('rejection failed');
      const nextHandoff = await response.json() as HandoffRecord;
      const nextProject = nextHandoff.object.projectId ? await fetchCurrentProjectState(nextHandoff.object.projectId) : null;
      setHandoff(nextHandoff);
      setCurrentProject(nextProject);
      setRejecting(false);
    } catch { setError(true); }
    finally { setSubmitting(false); }
  };

  const isOpenHandoff = handoff && !['completed', 'rejected', 'expired'].includes(handoff.status);
  const showConfirm = confirming && Boolean(isOpenHandoff);

  return (
    <DesktopCrudFrame
      ariaLabel="跨端续办"
      toolbar={
        <AxiRow>
          <button
            type="button"
            className="axi-button axi-button--small"
            aria-disabled={loading || submitting}
            disabled={loading || submitting}
            onClick={() => void load()}
          >
            {loading ? '同步中…' : '刷新'}
          </button>
          {!id ? (
            <label className="axi-row axi-row--inline">
              <span className="axi-filter-label">交接状态</span>
              <select
                aria-label="交接状态筛选"
                className="axi-select"
                value={historyStatus || 'all'}
                onChange={(event) => setHistoryStatus(event.target.value === 'all' ? '' : event.target.value)}
              >
                <option value="all">全部状态</option>
                <option value="pending">待处理</option>
                <option value="opened">已打开</option>
                <option value="completed">已完成</option>
                <option value="rejected">已拒绝</option>
                <option value="expired">已过期</option>
              </select>
            </label>
          ) : null}
          {isOpenHandoff ? (
            <>
              <button
                type="button"
                className="axi-button axi-button--primary axi-button--small"
                disabled={submitting}
                onClick={() => setConfirming(true)}
              >
                标记为已在 Web 完成
              </button>
              <button
                type="button"
                className="axi-button axi-button--danger axi-button--small"
                disabled={submitting}
                onClick={() => { setRejectionReason(''); setRejecting(true); }}
              >
                拒绝续办
              </button>
            </>
          ) : null}
        </AxiRow>
      }
      top={<span className="wb-crud-page__context">跨端续办</span>}
    >
      {error ? (
        <ControlPlaneState title="交接记录暂不可用" description="无法从控制面读取交接记录或当前对象状态；未显示静态替代数据。" />
      ) : loading ? (
        <ControlPlaneState loading title={id ? '正在恢复交接上下文' : '正在读取交接历史'} description="正在核验对象、状态和关联标识。" />
      ) : id ? (
        handoff ? (
          <AxiTableGroup description="交接快照只提供上下文；当前对象状态已从 Control Plane 重新读取。" title="续办上下文">
            <HandoffDetail handoff={handoff} currentProject={currentProject} onOpenProject={() => navigate(`/admin/project/${encodeURIComponent(handoff.object.projectId || '')}`)} />
          </AxiTableGroup>
        ) : (
          <AxiBanner message="未找到交接记录" tone="warning" />
        )
      ) : (
        <HandoffHistory records={history} onOpen={(handoffId) => navigate(`/admin/handoff/${encodeURIComponent(handoffId)}`)} />
      )}
      <AxiDialog
        open={rejecting}
        title="拒绝跨端续办"
        onOpenChange={(open) => { if (!open) setRejecting(false); }}
        onClose={() => setRejecting(false)}
        footer={
          <AxiRow>
            <button
              type="button"
              className="axi-button"
              disabled={submitting}
              onClick={() => setRejecting(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="axi-button axi-button--danger"
              disabled={submitting || !rejectionReason.trim()}
              onClick={() => void reject()}
            >
              {submitting ? '提交中…' : '确认拒绝'}
            </button>
          </AxiRow>
        }
      >
        <label className="axi-row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '8px' }}>
          <span className="axi-filter-label">拒绝原因</span>
          <textarea
            autoFocus
            className="axi-textarea"
            maxLength={500}
            placeholder="请说明拒绝原因"
            rows={4}
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
          />
          <small className="axi-textarea__count">{rejectionReason.length}/500</small>
        </label>
      </AxiDialog>
      <AxiDialog
        open={showConfirm}
        title="标记续办已完成？"
        onOpenChange={(open) => { if (!open) setConfirming(false); }}
        onClose={() => setConfirming(false)}
        footer={
          <AxiRow>
            <button
              type="button"
              className="axi-button"
              disabled={submitting}
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
            <button
              type="button"
              className="axi-button axi-button--primary"
              disabled={submitting}
              onClick={() => void complete()}
            >
              {submitting ? '提交中…' : '确认完成'}
            </button>
          </AxiRow>
        }
      >
        <p style={{ margin: 0 }}>这会写入同一关联标识的最终 Web 动作。</p>
      </AxiDialog>
    </DesktopCrudFrame>
  );
}

function HandoffDetail({
  handoff,
  currentProject,
  onOpenProject,
}: {
  handoff: HandoffRecord;
  currentProject: CurrentProjectState | null;
  onOpenProject: () => void;
}) {
  const items: AxiDescriptionsItem[] = [
    { key: 'status', label: '交接状态', value: handoff.status },
    { key: 'impact', label: '影响', value: handoff.impact },
    { key: 'risk', label: '风险', value: handoff.riskLevel },
    { key: 'project', label: '项目', value: handoff.object.projectId || '未关联项目' },
    { key: 'action', label: '动作', value: handoff.object.actionType || handoff.object.actionId || '未提供' },
  ];
  if (currentProject) {
    items.push({ key: 'current-name', label: '当前对象名称', value: currentProject.name });
    items.push({ key: 'current-status', label: '当前服务端状态', value: currentProject.status });
    if (currentProject.summary) {
      items.push({ key: 'current-summary', label: '当前对象摘要', value: currentProject.summary });
    }
    items.push({ key: 'current-observed', label: '当前状态读取时间', value: formatTime(currentProject.observedAt) });
    items.push({
      key: 'current-entry',
      label: '当前对象入口',
      value: (
        <button type="button" className="axi-button axi-button--link axi-button--small" onClick={onOpenProject}>
          打开项目详情
        </button>
      ),
    });
  } else {
    items.push({ key: 'current-missing', label: '当前对象状态', value: '未提供可重新读取的项目标识' });
  }
  items.push({ key: 'correlation', label: '关联标识', value: handoff.handoffCorrelationId });
  items.push({ key: 'surface', label: '来源 → 目标', value: `${handoff.sourceSurface} → ${handoff.targetSurface}` });
  items.push({ key: 'created', label: '创建时间', value: formatTime(handoff.createdAt) });
  if (handoff.expiresAt) {
    items.push({ key: 'expires', label: '截止时间', value: formatTime(handoff.expiresAt) });
  }
  if (handoff.finalAction) {
    items.push({
      key: 'final',
      label: '最终动作',
      value: `${handoff.finalAction.outcome} · ${formatTime(handoff.finalAction.occurredAt)}`,
    });
  }
  if (handoff.rejectionReason) {
    items.push({ key: 'rejection-reason', label: '拒绝原因', value: handoff.rejectionReason });
    if (handoff.rejectedBy) {
      items.push({ key: 'rejected-by', label: '拒绝主体', value: handoff.rejectedBy });
    }
    if (handoff.rejectedAt) {
      items.push({ key: 'rejected-at', label: '拒绝时间', value: formatTime(handoff.rejectedAt) });
    }
  }
  if (handoff.expiredAt) {
    items.push({ key: 'expired', label: '过期时间', value: formatTime(handoff.expiredAt) });
  }
  return <AxiDescriptions columns={1} items={items} />;
}

function HandoffHistory({ records, onOpen }: { records: HandoffRecord[]; onOpen: (id: string) => void }) {
  const columns: AxiTableColumn<HandoffRecord>[] = [
    { dataIndex: 'status', title: '状态', width: 110 },
    { dataIndex: 'object', title: '项目', width: 180, render: (_value, row) => row.object.projectId || '未关联项目' },
    { dataIndex: 'object', title: '动作', width: 220, render: (_value, row) => row.object.actionType || row.object.actionId || '未提供' },
    { dataIndex: 'handoffCorrelationId', title: '关联标识', width: 220 },
    { dataIndex: 'createdAt', title: '创建时间', render: (value) => formatTime(String(value)) },
  ];
  return (
    <AxiTableGroup description="来源端创建、Web 打开、完成/拒绝/过期均从同一 Control Plane 历史读取。" title="交接历史">
      <AxiTable columns={columns} data={records} pagination={false} rowKey="id" onRow={(row) => ({ onClick: () => onOpen(row.id), style: { cursor: 'pointer' } })} />
    </AxiTableGroup>
  );
}
