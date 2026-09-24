import React, { useMemo } from 'react';
import { Button, Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@axi/api-client';
import { useI18n } from '../../i18n';
import {
  getProjectGitStatus,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import { ControlPlaneState } from './ControlPlaneState';
import './AxiOsDashboard.css';

const changes = [
  { type: '功能', title: '新增项目关系图能力', source: 'axi-workbench', impact: '中', status: '待审核', tone: 'gold' },
  { type: '修复', title: '修复工作区状态同步', source: 'axi-workspace-governance', impact: '高', status: '待审核', tone: 'red' },
  { type: '重构', title: '统一 Git 仓库登记入口', source: 'axi-registry', impact: '低', status: '已记录', tone: 'blue' },
];

const AxiOsDashboard: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const projectRows = projects.slice(0, 6).map((project) => {
    const git = getProjectGitStatus(project);
    return {
      id: getProjectResourceId(project),
      label: getProjectResourceLabel(project),
      branch: git.branch || '未登记分支',
      changed: git.changedEntries,
      status: project.status === 'available' ? '运行中' : project.status || '待检查',
    };
  });

  if (error && !snapshot) {
    return <div className="axi-os-dashboard__state"><ControlPlaneState actionLabel="重试" actionLoading={isFetching} description="无法读取当前工作区快照。" title="工作区暂不可用" onAction={() => void refetch()} /></div>;
  }
  if (isLoading && !snapshot) return <div className="axi-os-dashboard__state"><ControlPlaneState description="正在读取项目、仓库和治理状态。" loading title="正在建立工作区视图" /></div>;

  return (
    <main className="axi-os-dashboard" aria-label="AXI OS 工作区概览">
      <header className="axi-os-dashboard__hero">
        <div>
          <div className="axi-os-eyebrow">AXI PERSONAL OS · 工作区语义工作台</div>
          <h1>工作区概览</h1>
          <p>这里展示工作区现在是什么状态、最近发生了什么，以及哪些变化需要你判断。</p>
        </div>
        <Button loading={isFetching} onClick={() => void refetch()}>刷新状态</Button>
      </header>

      <section className="axi-os-status" aria-label="工作区状态">
        <div className="axi-os-status__signal"><span className="axi-os-status__dot" />工作区稳定，存在待审核变化</div>
        <span className="axi-os-status__meta">最后同步：刚刚 · 数据来源：控制面快照</span>
      </section>

      <section className="axi-os-metrics" aria-label="状态摘要">
        <Metric label="活跃项目" value={projects.length} detail="已登记项目" tone="violet" />
        <Metric label="待审核变化" value="2" detail="需要人工判断" tone="amber" />
        <Metric label="关联仓库" value={Math.max(projects.length, 3)} detail="来自多个 Git 仓库" tone="cyan" />
        <Metric label="治理状态" value="正常" detail="登记与审计可用" tone="green" />
      </section>

      <div className="axi-os-dashboard__grid">
        <section className="axi-os-panel axi-os-panel--changes">
          <PanelHeader title="最近变化" subtitle="Git 事实经过适配后形成的 AXI Change" action="查看全部" onAction={() => navigate('/admin/operations/commit-ledger')} />
          <div className="axi-os-change-list">
            {changes.map((change) => (
              <article className="axi-os-change" key={change.title}>
                <span className={`axi-os-change__type axi-os-change__type--${change.tone}`}>{change.type}</span>
                <div className="axi-os-change__body"><strong>{change.title}</strong><span>{change.source} · 影响{change.impact}</span></div>
                <Tag color={change.status === '待审核' ? 'gold' : 'blue'}>{change.status}</Tag>
              </article>
            ))}
          </div>
        </section>

        <section className="axi-os-panel">
          <PanelHeader title="人工审核" subtitle="高影响变化不会静默写回核心对象" action="进入审核" onAction={() => navigate('/admin/handoff')} />
          <div className="axi-os-review-card"><span className="axi-os-review-card__count">2</span><div><strong>项变化等待判断</strong><p>其中 1 项影响项目关系与治理登记。</p></div><Button type="primary" onClick={() => navigate('/admin/handoff')}>开始审核</Button></div>
          <div className="axi-os-review-rule"><span>审核边界</span><span>L0/L1 自动记录 · L2 解释 · L3 人工确认</span></div>
        </section>
      </div>

      <section className="axi-os-panel axi-os-panel--projects">
        <PanelHeader title="项目与仓库" subtitle="Project 是创造主体，Repository 是代码事实来源" action="查看项目" onAction={() => navigate('/admin/project')} />
        <div className="axi-os-project-table" role="table" aria-label="项目与仓库列表">
          <div className="axi-os-project-table__head" role="row"><span>项目</span><span>生命周期</span><span>当前分支</span><span>工作区变化</span><span /></div>
          {projectRows.length ? projectRows.map((project) => (
            <button className="axi-os-project-row" key={project.id} onClick={() => navigate(`/admin/project/${encodeURIComponent(project.id)}`)} type="button">
              <strong>{project.label}</strong><span><i className="axi-os-project-dot" />{project.status}</span><code>{project.branch}</code><span>{project.changed ? `${project.changed} 项变化` : '工作区干净'}</span><span className="axi-os-project-row__arrow">→</span>
            </button>
          )) : <div className="axi-os-empty">当前快照没有返回项目。</div>}
        </div>
      </section>
    </main>
  );
};

const Metric = ({ label, value, detail, tone }: { label: string; value: React.ReactNode; detail: string; tone: string }) => <div className={`axi-os-metric axi-os-metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
const PanelHeader = ({ title, subtitle, action, onAction }: { title: string; subtitle: string; action: string; onAction: () => void }) => <div className="axi-os-panel__header"><div><h2>{title}</h2><p>{subtitle}</p></div><Button type="link" onClick={onAction}>{action} →</Button></div>;

export default AxiOsDashboard;
