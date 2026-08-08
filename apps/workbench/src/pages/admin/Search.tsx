import React, { useMemo, useState } from 'react';
import { Empty, Input } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useNavigate } from 'react-router-dom';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { filterSearchCorpus, type SearchHit } from '../../lib/search-data';
import './Search.css';

/** 桌面端全局搜索：只检索已登记的真实工作台入口。 */
const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterSearchCorpus(query), [query]);
  const columns: AxiTableColumn<SearchHit>[] = [
    {
      dataIndex: 'kind',
      render: (kind) => kind === 'navigation' ? '页面' : '工具',
      title: '类别',
      width: 90,
    },
    { align: 'left', dataIndex: 'title', title: '名称', width: 230 },
    { align: 'left', dataIndex: 'subtitle', title: '说明' },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel="快速搜索"
      className="wb-search"
      search={(
        <Input.Search
          allowClear
          autoFocus
          aria-label="搜索工作台"
          placeholder="搜索页面和工具"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      top={<span className="wb-crud-page__context">快速搜索</span>}
    >
      <AxiTableGroup
        description={query.trim() ? `找到 ${results.length} 个匹配项` : '输入关键词后检索已登记的工作台入口'}
        title="搜索结果"
      >
        {!query.trim() ? <Empty description="等待输入关键词" image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
        {query.trim() && results.length === 0 ? <Empty description={`未找到与“${query.trim()}”相关的入口`} image={Empty.PRESENTED_IMAGE_SIMPLE} /> : null}
        {results.length > 0 ? (
          <AxiTable
            columns={columns}
            data={results}
            pagination={false}
            rowKey="id"
            onRow={(hit) => ({ onClick: () => navigate(hit.path), style: { cursor: 'pointer' } })}
          />
        ) : null}
      </AxiTableGroup>
    </DesktopCrudFrame>
  );
};

export default SearchPage;
