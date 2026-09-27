import React, { useMemo, useState } from 'react';
// axi-ui-escape-hatch: antd Input.Search 是 DesktopCrudFrame 的 search 槽位
// 唯一带 allowClear + 受控 value 的搜索框；@axi/widgets 暂无等价组合，等
// @axi/widgets.AxiSearchInput 上线后再替换。
import { Input } from 'antd';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../../i18n';
import { DesktopCrudFrame } from './DesktopCrudFrame';
import { filterSearchCorpus, type SearchHit } from '../../lib/search-data';
import './Search.css';

/** 桌面端全局搜索：只检索已登记的真实工作台入口。 */
const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const results = useMemo(() => filterSearchCorpus(query), [query]);
  const kindLabels = {
    navigation: t('search.section.navigation'),
    utility: t('search.section.utility'),
  };
  const columns: AxiTableColumn<SearchHit>[] = [
    {
      dataIndex: 'kind',
      render: (kind) => kindLabels[kind as keyof typeof kindLabels] ?? kind,
      title: t('search.column.kind'),
      width: 90,
    },
    { align: 'left', dataIndex: 'title', title: t('search.column.title'), width: 230 },
    { align: 'left', dataIndex: 'subtitle', title: t('search.column.subtitle') },
  ];

  return (
    <DesktopCrudFrame
      ariaLabel={t('search.title')}
      className="wb-search"
      search={(
        <Input.Search
          allowClear
          autoFocus
          aria-label={t('search.input.ariaLabel')}
          placeholder={t('search.input.placeholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      )}
      top={<span className="wb-crud-page__context">{t('search.title')}</span>}
    >
      <AxiTableGroup
        description={query.trim() ? t('search.results.count', `${results.length}`) : t('search.results.idle')}
        title={t('search.results.title')}
      >
        {!query.trim() ? (
          <div className="wb-search__empty" role="status">
            {t('search.results.waiting')}
          </div>
        ) : null}
        {query.trim() && results.length === 0 ? (
          <div className="wb-search__empty" role="status">
            {t('search.results.empty', query.trim())}
          </div>
        ) : null}
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
