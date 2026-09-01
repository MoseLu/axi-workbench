import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AxiSvgIcon } from '@axi/core';
import { AxiViewGroup } from '@axi/shell';
import {
  usePersonalOsFocus,
  usePersonalOsQueue,
  useUpdatePersonalOsFocus,
  useUpdatePersonalOsProject,
} from '@epap/api-client';
import type { PersonalOsLifecycle, PersonalOsView, ProjectQueueItem } from '@axi/workstation-contracts';
import { axiWorkbenchIconMap } from '@axi/workbench-foundation/icons';
import { useI18n } from '../../i18n';
import './PersonalOs.css';

type PersonalOsPageProps = {
  mode: 'today' | 'workbench';
};

type DraftOverlay = {
  finishLine: string;
  lifecycleOverride: PersonalOsLifecycle | null;
  usesAxiUi: boolean;
};

const lifecycleValues: PersonalOsLifecycle[] = [
  'exploration',
  'building',
  'stalled',
  'usable',
  'shipped',
  'archived',
];

const workbenchViews: Array<{ labelKey: string; value: PersonalOsView }> = [
  { labelKey: 'personalOs.filter.today', value: 'today' },
  { labelKey: 'personalOs.filter.inProgress', value: 'in-progress' },
  { labelKey: 'personalOs.filter.stalled', value: 'stalled' },
  { labelKey: 'personalOs.filter.all', value: 'all' },
];

export const PersonalOsToday: React.FC = () => <PersonalOsPage mode="today" />;
export const PersonalOsWorkbench: React.FC = () => <PersonalOsPage mode="workbench" />;

const PersonalOsPage: React.FC<PersonalOsPageProps> = ({ mode }) => {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const [view, setView] = useState<PersonalOsView>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [draft, setDraft] = useState<DraftOverlay | null>(null);
  const requestView = mode === 'today' ? 'today' : view;
  const queueQuery = usePersonalOsQueue({ view: requestView, query });
  const focusQuery = usePersonalOsFocus();
  const updateProject = useUpdatePersonalOsProject();
  const updateFocus = useUpdatePersonalOsFocus();
  const items = queueQuery.data?.items ?? [];
  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const warningText = queueQuery.data?.warnings.includes('control_plane_snapshot_stale')
    ? t('personalOs.warning.snapshotStale')
    : t('personalOs.warning.runtimeUnavailable');

  useEffect(() => {
    if (items.length === 0) {
      setSelectedId('');
      return;
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) setSelectedId(items[0].id);
  }, [items, selectedId]);

  useEffect(() => {
    if (!selectedItem) {
      setDraft(null);
      return;
    }
    setDraft({
      finishLine: selectedItem.finishLine,
      lifecycleOverride: selectedItem.overlay.lifecycleOverride,
      usesAxiUi: selectedItem.usesAxiUi,
    });
  }, [selectedItem?.id, selectedItem?.overlay.revision, selectedItem?.lifecycle, selectedItem?.finishLine, selectedItem?.usesAxiUi]);

  const pageTitle = mode === 'today' ? t('personalOs.page.today.title') : t('personalOs.page.workbench.title');
  const queueLabel = mode === 'today' ? t('personalOs.queue.todayLabel') : t('personalOs.queue.workbenchLabel');

  const saveOverlay = async () => {
    if (!selectedItem || !draft) return;
    try {
      await updateProject.mutateAsync({
        projectId: selectedItem.id,
        lifecycleOverride: draft.lifecycleOverride,
        finishLine: draft.finishLine,
        usesAxiUi: draft.usesAxiUi,
        revision: selectedItem.overlay.revision,
      });
    } catch {
      // React Query exposes the mutation error in the Inspector.
    }
  };

  const setFocus = async () => {
    if (!selectedItem || !focusQuery.data) return;
    try {
      await updateFocus.mutateAsync({
        projectId: selectedItem.id,
        revision: focusQuery.data.focus.revision,
      });
    } catch {
      // A stale focus revision is surfaced by the next queue refresh.
    }
  };

  return (
    <main aria-label={pageTitle} className="personal-os-page">
      <div className="personal-os-page__toolbar">
        <div className="personal-os-page__toolbar-leading">
          {mode === 'workbench' ? (
            <div aria-label={t('personalOs.filter.label')} className="personal-os-page__filters" role="tablist">
              {workbenchViews.map((entry) => (
                <button
                  aria-selected={view === entry.value}
                  className={`personal-os-filter${view === entry.value ? ' is-active' : ''}`}
                  key={entry.value}
                  onClick={() => setView(entry.value)}
                  role="tab"
                  type="button"
                >
                  {t(entry.labelKey)}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="personal-os-page__toolbar-actions">
          <label className="personal-os-page__search">
            <AxiSvgIcon name={axiWorkbenchIconMap.search} size={16} />
            <span className="personal-os-visually-hidden">{t('personalOs.search.ariaLabel')}</span>
            <input
              aria-label={t('personalOs.search.ariaLabel')}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('personalOs.search.placeholder')}
              type="search"
              value={query}
            />
          </label>
          <button
            aria-label={t('personalOs.action.refresh')}
            className="personal-os-action-button"
            disabled={queueQuery.isFetching}
            onClick={() => void queueQuery.refetch()}
            title={queueQuery.isFetching ? t('personalOs.action.refreshing') : t('personalOs.action.refresh')}
            type="button"
          >
            <AxiSvgIcon name={axiWorkbenchIconMap.refresh} size={16} />
            <span className="personal-os-visually-hidden">{queueQuery.isFetching ? t('personalOs.action.refreshing') : t('personalOs.action.refresh')}</span>
          </button>
        </div>
      </div>

      {queueQuery.data?.warnings.length ? (
        <div className="personal-os-page__warning" role="status">
          <AxiSvgIcon name={axiWorkbenchIconMap.info} size={16} />
          <span>{warningText}</span>
        </div>
      ) : null}

      {queueQuery.error && !queueQuery.data ? (
        <PersonalOsEmptyState
          actionLabel={t('personalOs.error.retry')}
          description={t('personalOs.error.description')}
          onAction={() => void queueQuery.refetch()}
          title={t('personalOs.error.title')}
        />
      ) : queueQuery.isLoading && !queueQuery.data ? (
        <PersonalOsLoadingState title={t('personalOs.loading.title')} />
      ) : items.length === 0 ? (
        <PersonalOsEmptyState
          actionLabel={mode === 'today' ? t('personalOs.empty.today.action') : undefined}
          description={mode === 'today' ? t('personalOs.empty.today.description') : t('personalOs.empty.workbench.description')}
          onAction={mode === 'today' ? () => navigate('/admin/personal-os/workbench') : undefined}
          title={mode === 'today' ? t('personalOs.empty.today.title') : t('personalOs.empty.workbench.title')}
        />
      ) : (
        <AxiViewGroup
          aria-label={t('personalOs.inspector.label')}
          aside={(
            <div className="personal-os-queue__list" role="list">
              {items.map((item) => (
                <ProjectQueueRow
                  item={item}
                  key={item.id}
                  locale={locale}
                  onSelect={() => setSelectedId(item.id)}
                  selected={item.id === selectedItem?.id}
                  t={t}
                />
              ))}
            </div>
          )}
          asideAriaLabel={queueLabel}
          asideTitle={queueLabel}
          className="personal-os-page__workspace"
          collapseAsideLabel={t('personalOs.action.collapseQueue')}
          collapsible
          data-testid="personal-os-view-group"
          asideWidth={340}
          expandAsideLabel={t('personalOs.action.expandQueue')}
        >
          <ProjectInspector
            draft={draft}
            focusPending={updateFocus.isPending}
            isSaving={updateProject.isPending}
            item={selectedItem}
            locale={locale}
            mutationError={updateProject.error}
            onDraftChange={setDraft}
            onFocus={() => void setFocus()}
            onSave={() => void saveOverlay()}
            t={t}
          />
        </AxiViewGroup>
      )}
    </main>
  );
};

type Translation = (key: string, fallback?: string) => string;

function ProjectQueueRow({ item, locale, onSelect, selected, t }: { item: ProjectQueueItem; locale: string; onSelect: () => void; selected: boolean; t: Translation }) {
  const activeRun = item.recentAgentRuns.some((run) => ['queued', 'running', 'awaiting_approval'].includes(run.status));
  return (
    <button
      aria-current={selected ? 'true' : undefined}
      className={`personal-os-queue-row${selected ? ' is-selected' : ''}`}
      data-testid="personal-os-project-row"
      onClick={onSelect}
      role="listitem"
      type="button"
    >
      <span className={`personal-os-status-dot is-${item.lifecycle}`} aria-hidden="true" />
      <span className="personal-os-queue-row__copy">
        <strong>{item.name}</strong>
        <span>{item.summary}</span>
      </span>
      <span className="personal-os-queue-row__meta">
        <span>{lifecycleLabel(item.lifecycle, t)}</span>
        <span>{runtimeLabel(item.runtime.state, t)}</span>
        <time dateTime={item.activity.lastActivityAt || undefined}>{formatTime(item.activity.lastActivityAt, locale, t('personalOs.time.unknown'))}</time>
      </span>
      {activeRun ? <AxiSvgIcon className="personal-os-queue-row__activity" name={axiWorkbenchIconMap.play} size={14} /> : null}
    </button>
  );
}

function ProjectInspector({
  draft,
  focusPending,
  isSaving,
  item,
  locale,
  mutationError,
  onDraftChange,
  onFocus,
  onSave,
  t,
}: {
  draft: DraftOverlay | null;
  focusPending: boolean;
  isSaving: boolean;
  item: ProjectQueueItem | null;
  locale: string;
  mutationError: unknown;
  onDraftChange: React.Dispatch<React.SetStateAction<DraftOverlay | null>>;
  onFocus: () => void;
  onSave: () => void;
  t: Translation;
}) {
  if (!item || !draft) {
    return (
      <aside className="personal-os-inspector personal-os-inspector--empty" aria-label={t('personalOs.inspector.label')}>
        <AxiSvgIcon name={axiWorkbenchIconMap.project} size={22} />
        <strong>{t('personalOs.inspector.empty.title')}</strong>
        <p>{t('personalOs.inspector.empty.description')}</p>
      </aside>
    );
  }
  return (
    <aside className="personal-os-inspector" aria-label={t('personalOs.inspector.label')}>
      <header className="personal-os-inspector__header">
        <div>
          <span className="personal-os-page__kicker">{item.partition}</span>
          <h3>{item.name}</h3>
        </div>
        <button
          aria-pressed={item.focus}
          className={`personal-os-focus-button${item.focus ? ' is-active' : ''}`}
          disabled={focusPending}
          onClick={onFocus}
          type="button"
        >
          <AxiSvgIcon name={axiWorkbenchIconMap.pin} size={15} />
          <span>{item.focus ? t('personalOs.action.focused') : t('personalOs.action.setFocus')}</span>
        </button>
      </header>

      <dl className="personal-os-facts">
        <div>
          <dt>{t('personalOs.inspector.lifecycle')}</dt>
          <dd><span className={`personal-os-status-dot is-${item.lifecycle}`} aria-hidden="true" />{lifecycleLabel(item.lifecycle, t)}</dd>
        </div>
        <div>
          <dt>{t('personalOs.inspector.runtime')}</dt>
          <dd><span className={`personal-os-status-dot is-runtime-${item.runtime.state}`} aria-hidden="true" />{runtimeLabel(item.runtime.state, t)}</dd>
        </div>
        <div>
          <dt>{t('personalOs.inspector.activity')}</dt>
          <dd>{formatTime(item.activity.lastActivityAt, locale, t('personalOs.time.unknown'))}</dd>
        </div>
        <div>
          <dt>{t('personalOs.inspector.path')}</dt>
          <dd className="personal-os-facts__path">{item.path || t('personalOs.inspector.pathUnknown')}</dd>
        </div>
      </dl>

      <section className="personal-os-inspector__section">
        <div className="personal-os-inspector__section-heading">
          <h4>{t('personalOs.inspector.ownerMetadata')}</h4>
          <span>v{item.overlay.revision}</span>
        </div>
        <label className="personal-os-field">
          <span>{t('personalOs.inspector.lifecycle')}</span>
          <select
            aria-label={t('personalOs.inspector.lifecycle')}
            onChange={(event) => onDraftChange((current) => current ? { ...current, lifecycleOverride: event.target.value === '__auto' ? null : event.target.value as PersonalOsLifecycle } : current)}
            value={draft.lifecycleOverride ?? '__auto'}
          >
            <option value="__auto">{t('personalOs.lifecycle.auto')} ({lifecycleLabel(item.lifecycle, t)})</option>
            {lifecycleValues.map((value) => <option key={value} value={value}>{lifecycleLabel(value, t)}</option>)}
          </select>
        </label>
        <label className="personal-os-field">
          <span>{t('personalOs.inspector.finishLine')}</span>
          <input
            aria-label={t('personalOs.inspector.finishLine')}
            maxLength={500}
            onChange={(event) => onDraftChange((current) => current ? { ...current, finishLine: event.target.value } : current)}
            placeholder={t('personalOs.inspector.finishLinePlaceholder')}
            value={draft.finishLine}
          />
        </label>
        <label className="personal-os-checkbox">
          <input
            checked={draft.usesAxiUi}
            onChange={(event) => onDraftChange((current) => current ? { ...current, usesAxiUi: event.target.checked } : current)}
            type="checkbox"
          />
          <span>{t('personalOs.inspector.usesAxiUi')}</span>
        </label>
        {mutationError ? <p className="personal-os-field-error" role="alert">{t('personalOs.inspector.saveFailed')}</p> : null}
        <button className="personal-os-save-button" disabled={isSaving} onClick={onSave} type="button">
          <AxiSvgIcon name={axiWorkbenchIconMap.edit} size={15} />
          <span>{isSaving ? t('personalOs.inspector.saving') : t('personalOs.inspector.save')}</span>
        </button>
      </section>

      <section className="personal-os-inspector__section">
        <div className="personal-os-inspector__section-heading">
          <h4>{t('personalOs.inspector.recentRuns')}</h4>
          <span>{item.recentAgentRuns.length}</span>
        </div>
        {item.recentAgentRuns.length ? (
          <ul className="personal-os-runs">
            {item.recentAgentRuns.map((run) => (
              <li key={run.id}>
                <span className={`personal-os-status-dot is-run-${run.status}`} aria-hidden="true" />
                <span><strong>{run.summary}</strong><small>{run.runtime} · {formatTime(run.updatedAt, locale, t('personalOs.time.unknown'))}</small></span>
              </li>
            ))}
          </ul>
        ) : <p className="personal-os-muted">{t('personalOs.inspector.noRuns')}</p>}
      </section>

      <section className="personal-os-inspector__section personal-os-inspector__relationships">
        <div className="personal-os-inspector__section-heading"><h4>{t('personalOs.inspector.relationships')}</h4></div>
        <p>{t('personalOs.inspector.provides')}: {item.relationships.provides.length || 0}</p>
        <p>{t('personalOs.inspector.consumes')}: {item.relationships.consumes.length || 0}</p>
        <p>{t('personalOs.inspector.consumers')}: {item.relationships.consumers.length || 0}</p>
      </section>
    </aside>
  );
}

function PersonalOsEmptyState({ actionLabel, description, onAction, title }: { actionLabel?: string; description: string; onAction?: () => void; title: string }) {
  return (
    <section className="personal-os-state" role="status">
      <span className="personal-os-state__mark"><AxiSvgIcon name={axiWorkbenchIconMap.project} size={22} /></span>
      <h3>{title}</h3>
      <p>{description}</p>
      {actionLabel && onAction ? <button className="personal-os-action-button personal-os-state__action" onClick={onAction} type="button">{actionLabel}</button> : null}
    </section>
  );
}

function PersonalOsLoadingState({ title }: { title: string }) {
  return (
    <section aria-busy="true" className="personal-os-state personal-os-state--loading" role="status">
      <span className="personal-os-state__spinner" aria-hidden="true" />
      <h3>{title}</h3>
      <div className="personal-os-skeleton" />
      <div className="personal-os-skeleton personal-os-skeleton--short" />
    </section>
  );
}

function lifecycleLabel(value: PersonalOsLifecycle, t: Translation) {
  return t(`personalOs.lifecycle.${value}`);
}

function runtimeLabel(value: ProjectQueueItem['runtime']['state'], t: Translation) {
  return t(`personalOs.runtime.${value}`);
}

function formatTime(value: string | null, locale: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export default PersonalOsPage;
