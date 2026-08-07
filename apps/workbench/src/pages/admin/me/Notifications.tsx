import React from 'react';
import { Alert, Badge, Button, Empty, Spin } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  announceNotificationChange,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type WorkbenchNotification,
} from '@axi/workbench-foundation';
import type { AxiWorkbenchIconName } from '@axi/workbench-foundation/icons';
import { WorkbenchIcon } from '../../../components/WorkbenchIcon';
import { useI18n } from '../../../i18n';
import './Notifications.css';

const notificationQueryKey = ['axi', 'notifications'] as const;

function categoryIcon(category: WorkbenchNotification['category']): AxiWorkbenchIconName {
  if (category === 'projects') return 'project';
  if (category === 'workspace') return 'workspace';
  if (category === 'me') return 'account';
  return 'home';
}

function formatNotificationTime(value: string, locale: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  if (Math.abs(elapsedSeconds) < 3_600) return formatter.format(Math.round(elapsedSeconds / 60), 'minute');
  if (Math.abs(elapsedSeconds) < 86_400) return formatter.format(Math.round(elapsedSeconds / 3_600), 'hour');
  if (Math.abs(elapsedSeconds) < 604_800) return formatter.format(Math.round(elapsedSeconds / 86_400), 'day');

  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(timestamp));
}

const Notifications: React.FC = () => {
  const { locale, t } = useI18n();
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: notificationQueryKey,
    queryFn: ({ signal }) => fetchNotifications({ signal }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const syncNotifications = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    announceNotificationChange();
  };
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: syncNotifications,
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: syncNotifications,
  });

  const notifications = inbox.data ?? [];
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const mutationError = markRead.error || markAllRead.error;
  const retry = () => {
    markRead.reset();
    markAllRead.reset();
    void inbox.refetch();
  };

  return (
    <section className="wb-notification-center" aria-busy={inbox.isFetching || markRead.isPending || markAllRead.isPending}>
      <header className="wb-notification-center__header">
        <div className="wb-notification-center__heading">
          <Badge count={unreadCount} overflowCount={99}>
            <span className="wb-notification-center__heading-icon" aria-hidden="true">
              <WorkbenchIcon name="notification" />
            </span>
          </Badge>
          <div>
            <h1>{t('notification.center')}</h1>
            <p>{t('notification.description')}</p>
          </div>
        </div>
        {unreadCount > 0 ? (
          <Button type="primary" size="small" loading={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            {markAllRead.isPending ? t('notification.marking') : t('notification.markAllRead')}
          </Button>
        ) : null}
      </header>

      <div className="wb-notification-center__panel">
        {inbox.isPending ? (
          <div className="wb-notification-center__state" role="status">
            <Spin size="small" />
            <span>{t('notification.loading')}</span>
          </div>
        ) : null}

        {inbox.isError || mutationError ? (
          <Alert
            className="wb-notification-center__error"
            type="error"
            showIcon
            message={t('notification.failed')}
            action={<Button size="small" onClick={retry}>{t('notification.retry')}</Button>}
          />
        ) : null}

        {!inbox.isPending && !inbox.isError && notifications.length === 0 ? (
          <div className="wb-notification-center__state">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('notification.empty')} />
          </div>
        ) : null}

        {notifications.length > 0 ? (
          <div className="wb-notification-center__list" aria-live="polite">
            {notifications.map((notification) => {
              const isMarking = markRead.isPending && markRead.variables === notification.id;
              return (
                <button
                  type="button"
                  key={notification.id}
                  className={`wb-notification-center__item ${notification.read ? 'is-read' : 'is-unread'}`}
                  disabled={notification.read || isMarking}
                  onClick={() => {
                    if (!notification.read) markRead.mutate(notification.id);
                  }}
                  aria-label={`${notification.subject} ${notification.read ? t('notification.read') : t('notification.unread')}`}
                >
                  <span className={`wb-notification-center__item-icon is-${notification.category}`} aria-hidden="true">
                    <WorkbenchIcon name={categoryIcon(notification.category)} />
                  </span>
                  <span className="wb-notification-center__item-body">
                    <span className="wb-notification-center__item-title">{notification.subject}</span>
                    <span className="wb-notification-center__item-content">{notification.content}</span>
                    <span className="wb-notification-center__item-channel">
                      {t(`notification.channel.${notification.type}`)} · {t(`notification.category.${notification.category}`)}
                    </span>
                  </span>
                  <span className="wb-notification-center__item-meta">
                    <time dateTime={notification.createdAt}>{isMarking ? t('notification.marking') : formatNotificationTime(notification.createdAt, locale)}</time>
                    <span className={`wb-notification-center__status is-${notification.status}`}>
                      {t(`notification.status.${notification.status}`)}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
};

export default Notifications;
