import React from 'react';
import { useControlSnapshot } from '@epap/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { WorkbenchIcon } from '../../components/WorkbenchIcon';
import './RoleList.css';

const RoleList: React.FC = () => {
  const { user } = useAuth();
  const { error, isFetching, refetch } = useControlSnapshot();

  return (
    <main className="authority-status" aria-labelledby="authority-status-title">
      <h1 className="authority-status__visually-hidden" id="authority-status-title">角色权限</h1>
      <section className="authority-status__toolbar" aria-label="权限来源">
        <strong>权限来源</strong>
        <span>{user ? '当前会话已认证' : '会话状态待确认'}</span>
        <button disabled={isFetching} onClick={() => void refetch()} type="button">
          {isFetching ? '同步中…' : '刷新'}
        </button>
      </section>

      {error ? (
        <div className="authority-status__alert" role="status">
          <WorkbenchIcon name="notification" size={16} />
          权限状态暂时无法同步。
        </div>
      ) : null}

      <section className="authority-status__facts" aria-label="已接入的权限事实源">
        <dl>
          <SourceFact label="当前会话" value={user ? '由身份登录流程提供' : '尚未取得会话'} />
          <SourceFact label="命令审批" value="由控制面审批快照提供" />
          <SourceFact label="项目命令" value="仅由控制面调度，不在本页直接执行" />
        </dl>
      </section>

      <p className="authority-status__source-note">
        <WorkbenchIcon name="notification" size={16} />
        成员、角色和权限策略尚未接入权威身份源，页面不会显示样例角色。
      </p>
    </main>
  );
};

const SourceFact: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="authority-status__fact">
    <dt>{label}</dt>
    <dd>{value}</dd>
  </div>
);

export default RoleList;
