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
import { useI18n } from '../../i18n';
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
  const { t } = useI18n();
  const [keyword, setKeyword] = useState('');
  const rows = useMemo(buildMenuRows, []);
  const filteredRows = useMemo(() => filterMenuRows(rows, keyword), [keyword, rows]);
  const menuColumns: AxiTableColumn<MenuRow>[] = useMemo(() => [
    { alwaysVisible: true, title: t('projects.column.index'), type: 'index', width: 64 },
    { align: 'left', dataIndex: 'label', title: t('menuList.column.label'), width: 240 },
    { align: 'left', dataIndex: 'group', title: t('menuList.column.group'), width: 180 },
    { align: 'left', dataIndex: 'path', title: t('menuList.column.path'), width: 280 },
    { alwaysVisible: true, title: t('projects.column.actionHeader'), type: 'op', width: 88 },
  ], [t]);
  const operationButtons = useMemo<AxiTableOpButton<MenuRow>[]>(
    () => [{
      key: 'open',
      label: t('menuList.open'),
      tone: 'primary',
      type: 'link',
      onClick: ({ row }) => navigate(row.path),
    }],
    [navigate, t],
  );

  return (
    <AxiCrud dataSource={rows} permission={{ page: true }}>
      <DesktopCrudFrame
        ariaLabel={t('menuList.title')}
        className="menu-registry"
        search={(
          <div className="wb-crud-search-cluster">
            <Input
              allowClear
              aria-label={t('menuList.search.ariaLabel')}
              placeholder={t('menuList.search.placeholder')}
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onPressEnter={() => undefined}
            />
          </div>
        )}
        top={(
          <div className="wb-crud-action-cluster">
            <span className="wb-crud-page__readonly-hint">{t('menuList.readonlyHint')}</span>
          </div>
        )}
      >
        <AxiTableGroup
          description={t('menuList.count', `${filteredRows.length}/${rows.length}`)}
          title={t('menuList.title')}
        >
          <AxiCrudTable
            columns={menuColumns}
            data={filteredRows}
            operationButtons={operationButtons}
            pagination={{
              defaultPageSize: 20,
              hideOnSinglePage: false,
              pageSizeOptions: ['10', '20', '50'],
              showSizeChanger: true,
              showTotal: (total) => t('menuList.total', `${total}`),
            }}
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
