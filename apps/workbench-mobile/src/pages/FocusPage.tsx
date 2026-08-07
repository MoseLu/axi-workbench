import { useState } from 'react';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const initialTasks = [
  { id: 'review', title: '完成后台导航与标签栏审查', meta: '10:30 · Axi WorkBench', priority: 'high' },
  { id: 'timeline', title: '核对 Story Graph 时间线证据', meta: '14:00 · Story Graph', priority: 'normal' },
  { id: 'brief', title: '整理本周交付简报', meta: '17:30 · 工作台', priority: 'normal' },
];

export default function FocusPage() {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const { t } = useMobileI18n();

  return (
    <section className="axi-mobile-page">
      <div className="axi-mobile-page-intro">
        <h1>{t('page.workspace')}</h1>
        <p>{t('focus.subtitle')}</p>
      </div>
      <div className="axi-mobile-day-pill"><span>{t('focus.today')}</span><strong>08 / 07</strong></div>
      <div className="axi-mobile-task-list">
        {initialTasks.map((task) => {
          const isDone = done.has(task.id);
          return (
            <button
              type="button"
              key={task.id}
              className={`axi-mobile-task ${isDone ? 'is-done' : ''}`}
              onClick={() => setDone((previous) => {
                const next = new Set(previous);
                if (next.has(task.id)) next.delete(task.id); else next.add(task.id);
                return next;
              })}
            >
              <span className="axi-mobile-task__check"><MobileIcon name="check" size={15} /></span>
              <span className="axi-mobile-task__body"><strong>{task.title}</strong><small>{task.meta}</small></span>
              <span className={`axi-mobile-priority is-${task.priority}`}>{task.priority === 'high' ? t('common.priority.high') : t('common.priority.normal')}</span>
            </button>
          );
        })}
      </div>
      <div className="axi-mobile-section-heading"><h2>{t('focus.later')}</h2></div>
      <div className="axi-mobile-empty-card"><MobileIcon name="focus" size={20} /><span>2</span><small>{t('home.focus')}</small></div>
    </section>
  );
}
