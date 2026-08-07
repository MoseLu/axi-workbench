import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, CloseCircleFilled, FileTextOutlined, FolderOutlined, SearchOutlined } from '@ant-design/icons';
import { filterSearchCorpus, SEARCH_SECTIONS } from '../../lib/search-data';
import './Search.css';

/**
 * 全局联想搜索二级页：项目 / 文档 / 项目相关内容
 */
const SearchPage: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const results = useMemo(() => filterSearchCorpus(query), [query]);

  const grouped = useMemo(
    () =>
      SEARCH_SECTIONS.map((s) => ({
        ...s,
        items: results.filter((h) => h.kind === s.key),
      })).filter((s) => s.items.length > 0),
    [results],
  );

  return (
    <div className="wb-search">
      <div className="wb-search__bar">
        <button type="button" className="wb-search__icon-btn" onClick={() => navigate(-1)} aria-label="返回">
          <ArrowLeftOutlined />
        </button>
        <div className="wb-search__field">
          <SearchOutlined className="wb-search__field-icon" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索项目、文档、相关内容"
            enterKeyHint="search"
          />
          {query ? (
            <button type="button" className="wb-search__clear" onClick={() => setQuery('')} aria-label="清除">
              <CloseCircleFilled />
            </button>
          ) : null}
        </div>
        <button type="button" className="wb-search__cancel" onClick={() => navigate(-1)}>
          取消
        </button>
      </div>

      <div className="wb-search__body">
        {!query.trim() && (
          <div className="wb-search__hints">
            <div className="wb-search__section-label">试试搜索</div>
            {['Mobile', '文档', '设计', '扫一扫'].map((h) => (
              <button key={h} type="button" className="wb-search__hint" onClick={() => setQuery(h)}>
                {h}
              </button>
            ))}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="wb-search__empty">未找到与「{query}」相关的结果</div>
        )}

        {grouped.map((section) => (
          <div key={section.key} className="wb-search__group">
            <div className="wb-search__section-label">{section.label}</div>
            <div className="wb-search__card">
              {section.items.map((hit, i) => (
                <button
                  key={hit.id}
                  type="button"
                  className={`wb-search__row ${i < section.items.length - 1 ? 'has-divider' : ''}`}
                  onClick={() => navigate(hit.path)}
                >
                  <span className="wb-search__row-icon">
                    {hit.kind === 'project' ? <FolderOutlined /> : null}
                    {hit.kind === 'doc' ? <FileTextOutlined /> : null}
                    {hit.kind === 'content' ? <SearchOutlined /> : null}
                  </span>
                  <span className="wb-search__row-text">
                    <span className="wb-search__row-title">{hit.title}</span>
                    <span className="wb-search__row-sub">{hit.subtitle}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchPage;
