import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Input, Modal, Popconfirm, Select, Space } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
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

  return (
    <DesktopCrudFrame
      ariaLabel="跨端续办"
      toolbar={<Space><Button size="small" disabled={loading || submitting} onClick={() => void load()}>{loading ? '同步中…' : '刷新'}</Button>{!id ? <Select aria-label="交接状态筛选" value={historyStatus || 'all'} onChange={(value) => setHistoryStatus(value === 'all' ? '' : value)} options={[{ value: 'all', label: '全部状态' }, { value: 'pending', label: '待处理' }, { value: 'opened', label: '已打开' }, { value: 'completed', label: '已完成' }, { value: 'rejected', label: '已拒绝' }, { value: 'expired', label: '已过期' }]} /> : null}{handoff && !['completed', 'rejected', 'expired'].includes(handoff.status) ? <><Popconfirm description="这会写入同一关联标识的最终 Web 动作。" okText="确认完成" cancelText="取消" title="标记续办已完成？" onConfirm={() => void complete()}><Button size="small" loading={submitting} type="primary">标记为已在 Web 完成</Button></Popconfirm><Button size="small" danger disabled={submitting} onClick={() => { setRejectionReason(''); setRejecting(true); }}>拒绝续办</Button></> : null}</Space>}
      top={<span className="wb-crud-page__context">跨端续办</span>}
    >
      {error ? <ControlPlaneState title="交接记录暂不可用" description="无法从控制面读取交接记录或当前对象状态；未显示静态替代数据。" /> : loading ? <ControlPlaneState loading title={id ? '正在恢复交接上下文' : '正在读取交接历史'} description="正在核验对象、状态和关联标识。" /> : id ? handoff ? <AxiTableGroup description="交接快照只提供上下文；当前对象状态已从 Control Plane 重新读取。" title="续办上下文"><Descriptions bordered column={1} size="small"><Descriptions.Item label="交接状态">{handoff.status}</Descriptions.Item><Descriptions.Item label="影响">{handoff.impact}</Descriptions.Item><Descriptions.Item label="风险">{handoff.riskLevel}</Descriptions.Item><Descriptions.Item label="项目">{handoff.object.projectId || '未关联项目'}</Descriptions.Item><Descriptions.Item label="动作">{handoff.object.actionType || handoff.object.actionId || '未提供'}</Descriptions.Item>{currentProject ? <><Descriptions.Item label="当前对象名称">{currentProject.name}</Descriptions.Item><Descriptions.Item label="当前服务端状态">{currentProject.status}</Descriptions.Item>{currentProject.summary ? <Descriptions.Item label="当前对象摘要">{currentProject.summary}</Descriptions.Item> : null}<Descriptions.Item label="当前状态读取时间">{formatTime(currentProject.observedAt)}</Descriptions.Item><Descriptions.Item label="当前对象入口"><Button type="link" size="small" onClick={() => navigate(`/admin/project/${encodeURIComponent(handoff.object.projectId || '')}`)}>打开项目详情</Button></Descriptions.Item></> : <Descriptions.Item label="当前对象状态">未提供可重新读取的项目标识</Descriptions.Item>}<Descriptions.Item label="关联标识">{handoff.handoffCorrelationId}</Descriptions.Item><Descriptions.Item label="来源 → 目标">{handoff.sourceSurface} → {handoff.targetSurface}</Descriptions.Item><Descriptions.Item label="创建时间">{formatTime(handoff.createdAt)}</Descriptions.Item>{handoff.expiresAt ? <Descriptions.Item label="截止时间">{formatTime(handoff.expiresAt)}</Descriptions.Item> : null}{handoff.finalAction ? <Descriptions.Item label="最终动作">{handoff.finalAction.outcome} · {formatTime(handoff.finalAction.occurredAt)}</Descriptions.Item> : null}{handoff.rejectionReason ? <><Descriptions.Item label="拒绝原因">{handoff.rejectionReason}</Descriptions.Item>{handoff.rejectedBy ? <Descriptions.Item label="拒绝主体">{handoff.rejectedBy}</Descriptions.Item> : null}{handoff.rejectedAt ? <Descriptions.Item label="拒绝时间">{formatTime(handoff.rejectedAt)}</Descriptions.Item> : null}</> : null}{handoff.expiredAt ? <Descriptions.Item label="过期时间">{formatTime(handoff.expiredAt)}</Descriptions.Item> : null}</Descriptions></AxiTableGroup> : <Alert message="未找到交接记录" type="warning" showIcon /> : <HandoffHistory records={history} onOpen={(handoffId) => navigate(`/admin/handoff/${encodeURIComponent(handoffId)}`)} />}
      <Modal open={rejecting} title="拒绝跨端续办" okText="确认拒绝" cancelText="取消" confirmLoading={submitting} okButtonProps={{ danger: true, disabled: !rejectionReason.trim() }} onCancel={() => setRejecting(false)} onOk={() => void reject()}>
        <Input.TextArea autoFocus value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="请说明拒绝原因" maxLength={500} showCount rows={4} />
      </Modal>
    </DesktopCrudFrame>
  );
}

function HandoffHistory({ records, onOpen }: { records: HandoffRecord[]; onOpen: (id: string) => void }) {
  const columns: AxiTableColumn<HandoffRecord>[] = [
    { dataIndex: 'status', title: '状态', width: 110 },
    { dataIndex: 'object', title: '项目', width: 180, render: (_value, row) => row.object.projectId || '未关联项目' },
    { dataIndex: 'object', title: '动作', width: 220, render: (_value, row) => row.object.actionType || row.object.actionId || '未提供' },
    { dataIndex: 'handoffCorrelationId', title: '关联标识', width: 220 },
    { dataIndex: 'createdAt', title: '创建时间', render: (value) => formatTime(String(value)) },
  ];
  return <AxiTableGroup description="来源端创建、Web 打开、完成/拒绝/过期均从同一 Control Plane 历史读取。" title="交接历史"><AxiTable columns={columns} data={records} pagination={false} rowKey="id" onRow={(row) => ({ onClick: () => onOpen(row.id), style: { cursor: 'pointer' } })} /></AxiTableGroup>;
}
