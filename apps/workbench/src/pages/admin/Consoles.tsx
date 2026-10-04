import React, { useMemo, useState } from 'react';
import { AxiTag } from '@axi/core';
import { AxiSearchKey } from '@axi/crud';
import { AxiRow } from '@axi/widgets';
import { useControlSnapshot } from '@axi/api-client';
import { getUserRole } from '../../config';
import { useI18n } from '../../i18n';
import { useWorkbenchEnvironment } from '../../lib/useWorkbenchEnvironment';
import { consoleSearchText, getVisibleConsoles, resolveConsoleUrl } from '../../lib/consoleDirectory';
import { ControlPlaneState } from './ControlPlaneState';
import './Consoles.css';

export const pageContract = {
  route: '/admin/consoles',
  surface: 'workbench-web',
  identitySource: ['sidebar', 'tabs', 'breadcrumbs'],
  pageHeader: 'forbidden',
} as const;

const Consoles: React.FC = () => {
  const { t } = useI18n();
  const environment = useWorkbenchEnvironment();
  const role = getUserRole();
  const { data: snapshot, error, isLoading, refetch } = useControlSnapshot();
  const [query, setQuery] = useState('');
  const consoles = useMemo(
    () => getVisibleConsoles(snapshot?.consoleCatalog, role)
      .filter((entry) => !query.trim() || consoleSearchText(entry).includes(query.trim().toLocaleLowerCase('zh-CN'))),
    [query, role, snapshot?.consoleCatalog],
  );

  return (
    <main aria-label={t('consoles.title')} className="wb-consoles">
      <AxiRow className="wb-consoles__toolbar" style={{ gap: 12 }}>
        <div aria-label={t('consoles.search.ariaLabel')} className="wb-consoles__search">
          <AxiSearchKey
            field="console"
            placeholder={t('consoles.search.placeholder')}
            value={query}
            onChange={(value) => setQuery(value ?? '')}
          />
        </div>
        <AxiTag type="info">{environment}</AxiTag>
      </AxiRow>

      {error ? (
        <ControlPlaneState
          actionLabel={t('consoles.retry')}
          description={t('consoles.error.description')}
          onAction={() => void refetch()}
          title={t('consoles.error.title')}
        />
      ) : isLoading ? (
        <ControlPlaneState description={t('consoles.loading.description')} loading title={t('consoles.loading.title')} />
      ) : consoles.length === 0 ? (
        <ControlPlaneState description={t('consoles.empty.description')} title={t('consoles.empty.title')} />
      ) : (
        <section aria-label={t('consoles.list.ariaLabel')} className="wb-consoles__grid">
          {consoles.map((entry) => {
            const url = resolveConsoleUrl(entry, environment);
            const release = entry.release?.version || t('consoles.release.unknown');
            const state = entry.status === 'active' && url ? t('consoles.status.available') : t('consoles.status.unavailable');
            return (
              <article className="wb-console-card" data-console-id={entry.id} key={entry.id}>
                <div className="wb-console-card__topline">
                  <span aria-hidden="true" className="wb-console-card__icon">{entry.icon}</span>
                  <AxiTag type={entry.status === 'active' && url ? 'success' : 'warning'}>{state}</AxiTag>
                </div>
                <h2>{entry.title}</h2>
                <p>{entry.description || t('consoles.noDescription')}</p>
                <dl className="wb-console-card__facts">
                  <div><dt>{t('consoles.owner')}</dt><dd>{entry.owner}</dd></div>
                  <div><dt>{t('consoles.version')}</dt><dd>{release}</dd></div>
                  <div><dt>{t('consoles.environment')}</dt><dd>{environment}</dd></div>
                </dl>
                <div className="wb-console-card__capabilities">
                  {entry.capabilities.map((capability) => <AxiTag key={capability}>{capability}</AxiTag>)}
                </div>
                {url ? (
                  <a className="wb-console-card__open" href={url} rel="noopener noreferrer" target="_blank">
                    {t('consoles.open')}
                  </a>
                ) : (
                  <span className="wb-console-card__disabled">{t('consoles.unconfigured')}</span>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
};

export default Consoles;
