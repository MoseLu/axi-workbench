import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useControlSnapshot } from '@epap/api-client';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import {
  getProjectCollaborationLinks,
  getProjectConsumerSummary,
  getProjectResourceId,
  getProjectResourceLabel,
  getProjectResources,
} from '../workspaceRegistry';
import './Team.css';

const Team: React.FC = () => {
  const navigate = useNavigate();
  const { data: snapshot, error, isFetching, isLoading, refetch } = useControlSnapshot();
  const projects = useMemo(
    () => getProjectResources(snapshot?.resources ?? [], snapshot?.axiResources?.project),
    [snapshot],
  );
  const collaborationLinks = useMemo(() => getProjectCollaborationLinks(projects), [projects]);
  const errorMessage = error instanceof Error ? error.message : '控制面暂时无法同步。';

  return (
    <main className="team-live" aria-label="团队">
      <h1 className="team-live__visually-hidden">团队</h1>
      <section className="team-live__toolbar" aria-label="团队工具">
        <strong>项目协作</strong>
        <span>{collaborationLinks.length} 个关联项目</span>
        <div>
          <button className="team-live__directory" onClick={() => navigate('/admin/project')} type="button">项目目录</button>
          <button disabled={isFetching} onClick={() => void refetch()} type="button">{isFetching ? '同步中…' : '刷新'}</button>
        </div>
      </section>

      {error ? <div className="team-live__alert" role="status"><WorkbenchIcon name="notification" size={16} />{errorMessage}</div> : null}

      {isLoading ? <TeamSkeleton /> : (
        <section className="team-live__relationships" aria-label="已登记协作关系">
          {collaborationLinks.length > 0 ? (
            <div className="team-live__relationship-list">
              {collaborationLinks.map((link) => {
                const projectId = getProjectResourceId(link.project);
                const projectLabel = getProjectResourceLabel(link.project);
                return (
                  <button
                    className="team-live__relationship"
                    key={projectId}
                    onClick={() => navigate(`/admin/project/${encodeURIComponent(projectId)}`)}
                    type="button"
                  >
                    <span className="team-live__relationship-mark"><WorkbenchIcon name="project" size={16} /></span>
                    <span className="team-live__relationship-copy"><strong>{projectLabel}</strong><small>{getProjectConsumerSummary(link.consumers.length)}</small></span>
                    <WorkbenchIcon aria-label={`${projectLabel} 详情`} name="forward" size={14} />
                  </button>
                );
              })}
            </div>
          ) : <EmptyPanel icon="team" text="当前图谱中还没有声明项目协作关系。" />}
          <p className="team-live__source-note"><WorkbenchIcon name="notification" size={16} />成员目录尚未接入控制面，因此这里只显示已登记项目之间的协作关系。</p>
        </section>
      )}
    </main>
  );
};

const EmptyPanel: React.FC<{ icon: 'team'; text: string }> = ({ icon, text }) => (
  <div className="team-live__empty"><WorkbenchIcon name={icon} size={18} /><span>{text}</span></div>
);

const TeamSkeleton: React.FC = () => (
  <section className="team-live__relationship-list" aria-label="正在加载协作关系">
    {[0, 1, 2, 3, 4].map((index) => <div className="team-live__skeleton" key={index} />)}
  </section>
);

export default Team;
