import React from 'react';
import { Spin } from 'antd';
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
import { formatNotificationTime } from './notificationPresentation';
import './Notifications.css';

const notificationQueryKey = ['axi', 'notifications'] as const;

function categoryIcon(category: WorkbenchNotification['category']): AxiWorkbenchIconName {
  if (category === 'projects') return 'project';
  if (category === 'workspace') return 'workspace';
  if (category === 'me') return 'account';
  return 'home';
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
    <section
      className="wb-notification-center"
      aria-busy={inbox.isFetching || markRead.isPending || markAllRead.isPending}
      aria-labelledby="wb-notification-center-title"
    >
      <h1 className="wb-notification-center__visually-hidden" id="wb-notification-center-title">{t('notification.center')}</h1>
      <header className="wb-notification-center__toolbar">
        <div>
          <strong>{t('notification.center')}</strong>
          <span>{unreadCount > 0 ? `${unreadCount} ${t('notification.unread')}` : t('notification.markAllRead')}</span>
        </div>
        {unreadCount > 0 ? (
          <button
            className="wb-notification-center__action"
            disabled={markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
            type="button"
          >
            {markAllRead.isPending ? t('notification.marking') : t('notification.markAllRead')}
          </button>
        ) : null}
      </header>

      {inbox.isPending ? (
        <div className="wb-notification-center__state" role="status">
          <Spin size="small" />
          <span>{t('notification.loading')}</span>
        </div>
      ) : null}

      {inbox.isError || mutationError ? (
        <div className="wb-notification-center__error" role="alert">
          <span><WorkbenchIcon name="notification" size={16} />{t('notification.failed')}</span>
          <button onClick={retry} type="button">{t('notification.retry')}</button>
        </div>
      ) : null}

      {!inbox.isPending && !inbox.isError && notifications.length === 0 ? (
        <div className="wb-notification-center__state">
          <WorkbenchIcon name="notification" size={18} />
          <span>{t('notification.empty')}</span>
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
                </span>
                <time className="wb-notification-center__item-time" dateTime={notification.createdAt}>
                  {isMarking ? t('notification.marking') : formatNotificationTime(notification.createdAt, locale)}
                </time>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
};

export default Notifications;
