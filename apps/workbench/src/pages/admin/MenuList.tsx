import React, { useMemo, useState } from 'react';
import { Button, Input } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useNavigate } from 'react-router-dom';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { getRegisteredDesktopRoutes } from '../../lib/navigationRegistry';
import './MenuList.css';

type MenuRow = {
  group: string;
  key: string;
  label: string;
  path: string;
};

const MenuList: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const rows = useMemo<MenuRow[]>(
    () => getRegisteredDesktopRoutes().map((route) => ({
      group: route.groupLabel,
      key: route.path,
      label: route.label,
      path: route.path,
    })),
    [],
  );
  const normalizedKeyword = keyword.trim().toLocaleLowerCase();
  const filteredRows = normalizedKeyword
    ? rows.filter((row) => [row.label, row.group].some((value) => value.toLocaleLowerCase().includes(normalizedKeyword)))
    : rows;
  const columns: AxiTableColumn<MenuRow>[] = [
    { align: 'left', dataIndex: 'label', title: '菜单名称', width: 220 },
    { align: 'left', dataIndex: 'group', title: '所属分组', width: 180 },
    {
      align: 'right',
      key: 'action',
      render: (_, row) => <Button size="small" type="link" onClick={() => navigate(row.path)}>打开</Button>,
      title: '操作',
      width: 90,
    },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="菜单配置"
      className="menu-registry"
      search={(
        <Input
          allowClear
          aria-label="搜索菜单"
          placeholder="搜索菜单名称或分组"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      )}
      top={<span className="wb-crud-page__context">菜单配置</span>}
    >
      <AxiTableGroup description={`共 ${rows.length} 个已登记入口`} title="导航入口">
        <AxiTable
          columns={columns}
          data={filteredRows}
          pagination={false}
          rowKey="key"
          onRow={(row) => ({ onClick: () => navigate(row.path), style: { cursor: 'pointer' } })}
        />
      </AxiTableGroup>
    </DesktopCrudFrame>
  );
};

export default MenuList;
