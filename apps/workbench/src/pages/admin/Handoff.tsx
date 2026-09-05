import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Descriptions, Popconfirm, Space } from 'antd';
import { useParams } from 'react-router-dom';
import { resolveGatewayURL } from '@axi/workbench-foundation';
import { AxiTableGroup } from '@axi/crud';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { ControlPlaneState } from './ControlPlaneState';

type HandoffRecord = {
  id: string;
  handoffCorrelationId: string;
  sourceSurface: string;
  targetSurface: string;
  status: string;
  approvalId: string | null;
  object: { projectId: string | null; actionId: string | null; actionType: string | null };
  impact: string;
  riskLevel: string;
  createdAt: string;
  openedAt?: string;
  finalAction?: { outcome: string; performedBy: string; occurredAt: string };
};

function formatTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(Date.parse(value));
}

/** Desktop continuation for a server-created mobile handoff. */
export default function Handoff() {
  const { id = '' } = useParams();
  const [handoff, setHandoff] = useState<HandoffRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!id) { setError(true); setLoading(false); return; }
    setLoading(true); setError(false);
    try {
      const response = await fetch(resolveGatewayURL(`/api/v1/handoffs/${encodeURIComponent(id)}`), { credentials: 'include', headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('handoff unavailable');
      setHandoff(await response.json() as HandoffRecord);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [id]);

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
      setHandoff(await response.json() as HandoffRecord);
    } catch { setError(true); }
    finally { setSubmitting(false); }
  };

  return (
    <DesktopCrudFrame
      ariaLabel="跨端续办"
      toolbar={<Space><Button size="small" disabled={loading || submitting} onClick={() => void load()}>{loading ? '同步中…' : '刷新'}</Button>{handoff?.status !== 'completed' ? <Popconfirm description="这会写入同一关联标识的最终 Web 动作。" okText="确认完成" cancelText="取消" title="标记续办已完成？" onConfirm={() => void complete()}><Button size="small" loading={submitting} type="primary">标记为已在 Web 完成</Button></Popconfirm> : null}</Space>}
      top={<span className="wb-crud-page__context">跨端续办</span>}
    >
      {error ? <ControlPlaneState title="交接记录暂不可用" description="无法从控制面读取或写入该交接记录；未显示静态替代数据。" /> : loading ? <ControlPlaneState loading title="正在恢复交接上下文" description="正在核验对象、状态和关联标识。" /> : handoff ? <AxiTableGroup description="对象和动作由服务端扫码记录推导，Web 只恢复上下文。" title="续办上下文"><Descriptions bordered column={1} size="small"><Descriptions.Item label="交接状态">{handoff.status}</Descriptions.Item><Descriptions.Item label="影响">{handoff.impact}</Descriptions.Item><Descriptions.Item label="风险">{handoff.riskLevel}</Descriptions.Item><Descriptions.Item label="项目">{handoff.object.projectId || '未关联项目'}</Descriptions.Item><Descriptions.Item label="动作">{handoff.object.actionType || handoff.object.actionId || '未提供'}</Descriptions.Item><Descriptions.Item label="关联标识">{handoff.handoffCorrelationId}</Descriptions.Item><Descriptions.Item label="来源 → 目标">{handoff.sourceSurface} → {handoff.targetSurface}</Descriptions.Item><Descriptions.Item label="创建时间">{formatTime(handoff.createdAt)}</Descriptions.Item>{handoff.finalAction ? <Descriptions.Item label="最终动作">{handoff.finalAction.outcome} · {formatTime(handoff.finalAction.occurredAt)}</Descriptions.Item> : null}</Descriptions></AxiTableGroup> : <Alert message="未找到交接记录" type="warning" showIcon />}
    </DesktopCrudFrame>
  );
}
