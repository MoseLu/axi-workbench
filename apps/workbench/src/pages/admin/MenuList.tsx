import React, { useMemo, useState } from 'react';
import { Input } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  AxiCrud,
  AxiCrudTable,
  AxiTableGroup,
  type AxiTableColumn,
  type AxiTableOpButton,
} from '@axi/crud';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { getRegisteredDesktopRoutes } from '../../lib/navigationRegistry';
import './MenuList.css';

/** 路由注册表的真实只读投影；它不是一套可在浏览器端伪造的菜单管理 API。 */
export type MenuRow = Record<string, unknown> & {
  group: string;
  id: string;
  label: string;
  path: string;
};

const menuColumns: AxiTableColumn<MenuRow>[] = [
  { alwaysVisible: true, title: '序号', type: 'index', width: 64 },
  { align: 'left', dataIndex: 'label', title: '菜单名称', width: 240 },
  { align: 'left', dataIndex: 'group', title: '所属分组', width: 180 },
  { align: 'left', dataIndex: 'path', title: '路由地址', width: 280 },
  { alwaysVisible: true, title: '操作', type: 'op', width: 88 },
];

export function buildMenuRows(): MenuRow[] {
  return getRegisteredDesktopRoutes().map((route) => ({
    group: route.groupLabel,
    id: route.path,
    label: route.label,
    path: route.path,
  }));
}

/** 只对已登记的桌面入口做本地视图检索，不创建或修改菜单记录。 */
export function filterMenuRows(rows: MenuRow[], keyword: string): MenuRow[] {
  const normalized = keyword.trim().toLocaleLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => [row.label, row.group, row.path].some((value) => value.toLocaleLowerCase().includes(normalized)));
}

const MenuList: React.FC = () => {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const rows = useMemo(buildMenuRows, []);
  const filteredRows = useMemo(() => filterMenuRows(rows, keyword), [keyword, rows]);
  const operationButtons = useMemo<AxiTableOpButton<MenuRow>[]>(
    () => [{
      key: 'open',
      label: '打开',
      tone: 'primary',
      type: 'link',
      onClick: ({ row }) => navigate(row.path),
    }],
    [navigate],
  );

  return (
    <AxiCrud dataSource={rows} permission={{ page: true }}>
      <DesktopCrudFrame
        ariaLabel="导航入口"
        className="menu-registry"
        search={(
          <Input
            allowClear
            aria-label="搜索菜单"
            placeholder="搜索菜单名称、分组或路由"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        )}
      >
        <AxiTableGroup
          description="入口来自已登记的桌面导航。当前没有权威菜单写接口，因此本页只提供检索、表格偏好和跳转。"
          title="导航入口"
        >
          <AxiCrudTable
            columns={menuColumns}
            data={filteredRows}
            operationButtons={operationButtons}
            pagination={false}
            rowKey="id"
            rowSelection={false}
            storageKey="axi-workbench:desktop-navigation"
            toolbar={{ layout: ['size', 'columns', 'style'], storageKey: 'axi-workbench:desktop-navigation', visible: true }}
            onRow={(row) => ({
              onClick: () => navigate(row.path),
              style: { cursor: 'pointer' },
            })}
          />
        </AxiTableGroup>
      </DesktopCrudFrame>
    </AxiCrud>
  );
};

export default MenuList;
