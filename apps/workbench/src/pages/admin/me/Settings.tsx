import React from 'react';
import { Button } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useNavigate } from 'react-router-dom';
import { DesktopSettingsPage } from './DesktopSettingsPage';

type SettingsEntry = {
  description: string;
  key: string;
  label: string;
  path: string;
};

const entries: SettingsEntry[] = [
  { key: 'account', label: '账号资料', description: '更新头像、昵称和联系方式', path: '/admin/me/account' },
  { key: 'notifications', label: '通知中心', description: '查看工作台通知并标记已读', path: '/admin/me/notifications' },
  { key: 'theme', label: '主题外观', description: '调整界面显示偏好', path: '/admin/me/theme' },
];

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const columns: AxiTableColumn<SettingsEntry>[] = [
    { align: 'left', dataIndex: 'label', title: '设置项', width: 180 },
    { align: 'left', dataIndex: 'description', title: '说明' },
    {
      align: 'right',
      key: 'action',
      render: (_, entry) => <Button size="small" type="link" onClick={() => navigate(entry.path)}>打开</Button>,
      title: '操作',
      width: 90,
    },
  ];

  return (
    <DesktopSettingsPage activeKey="/admin/me/settings" title="设置入口">
      <AxiTableGroup title="可管理项目">
        <AxiTable
          columns={columns}
          data={entries}
          pagination={false}
          rowKey="key"
          onRow={(entry) => ({ onClick: () => navigate(entry.path), style: { cursor: 'pointer' } })}
        />
      </AxiTableGroup>
    </DesktopSettingsPage>
  );
};

export default Settings;
