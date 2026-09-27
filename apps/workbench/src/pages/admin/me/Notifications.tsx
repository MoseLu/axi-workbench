import React from 'react';
// axi-ui-escape-hatch: Button 在 @axi/core 仅导出 AxiIconButton（图标按钮变体），
// 没有等价的主操作按钮组件；保留 antd Button 维持现有 size="small" / type="link" 行为。
// axi-ui-escape-hatch: Empty 渲染通知列表的占位，@axi/* 未提供等价 Empty 组件。
// axi-ui-escape-hatch: Spin 用于通知加载中的行内旋转占位，@axi/* 未提供等价 Spin 组件；
// 保留 antd Spin size="small" 与原视觉一致。
import { Button, Empty, Spin } from 'antd';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiTable, AxiTableGroup, type AxiTableColumn } from '@axi/crud';
import { AxiBanner } from '@axi/widgets';
import {
  announceNotificationChange,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type WorkbenchNotification,
} from '@axi/workbench-foundation';
import { useI18n } from '../../../i18n';
import { DesktopCrudFrame } from '../DesktopCrudFrame';
import { formatNotificationTime } from './notificationPresentation';
import './Notifications.css';

const notificationQueryKey = ['axi', 'notifications'] as const;

function categoryLabel(
  category: WorkbenchNotification['category'],
  t: (key: string, fallback?: string) => string,
) {
  if (category === 'projects') return t('notification.category.projects');
  if (category === 'workspace') return t('notification.category.workspace');
  if (category === 'me') return t('notification.category.me');
  return t('notification.category.home');
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
  const columns: AxiTableColumn<WorkbenchNotification>[] = [
    {
      dataIndex: 'category',
      render: (category) => categoryLabel(category, t),
      title: t('notification.column.category'),
      width: 92,
    },
    {
      align: 'left',
      dataIndex: 'subject',
      render: (_, notification) => (
        <span className="wb-notification-center__copy">
          <strong>{notification.subject}</strong>
          <small>{notification.content}</small>
        </span>
      ),
      title: t('notification.column.subject'),
    },
    {
      dataIndex: 'createdAt',
      render: (createdAt) => formatNotificationTime(createdAt, locale),
      title: t('notification.column.time'),
      width: 160,
    },
    {
      dataIndex: 'read',
      render: (read) => read ? t('notification.read') : t('notification.unread'),
      title: t('notification.column.status'),
      width: 78,
    },
  ];

  return (
    <DesktopCrudFrame ariaLabel={t('notification.center')} className="wb-notification-page">
      <section
        aria-busy={inbox.isFetching || markRead.isPending || markAllRead.isPending}
        className="wb-notification-center"
      >
        <AxiTableGroup
          actions={unreadCount > 0 ? (
            <Button
              disabled={markAllRead.isPending}
              size="small"
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? t('notification.marking') : t('notification.markAllRead')}
            </Button>
          ) : null}
          description={unreadCount > 0 ? `${unreadCount} ${t('notification.unread')}` : t('notification.allRead')}
          title={t('notification.center')}
        >
          {inbox.isPending ? (
            <div className="wb-notification-center__state" role="status"><Spin size="small" /><span>{t('notification.loading')}</span></div>
          ) : null}
          {inbox.isError || mutationError ? (
            <AxiBanner
              action={<Button size="small" type="link" onClick={retry}>{t('notification.retry')}</Button>}
              message={t('notification.failed')}
              tone="warning"
            />
          ) : null}
          {!inbox.isPending && !inbox.isError && notifications.length === 0 ? (
            <div className="wb-notification-center__empty">
              <Empty description={t('notification.empty')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
          ) : null}
          {notifications.length > 0 ? (
            <AxiTable
              columns={columns}
              data={notifications}
              pagination={false}
              rowClassName={(notification) => notification.read ? 'wb-notification-center__row is-read' : 'wb-notification-center__row is-unread'}
              rowKey="id"
              onRow={(notification) => ({
                onClick: () => {
                  if (!notification.read && !markRead.isPending) markRead.mutate(notification.id);
                },
                style: { cursor: notification.read ? 'default' : 'pointer' },
              })}
            />
          ) : null}
        </AxiTableGroup>
      </section>
    </DesktopCrudFrame>
  );
};

export default Notifications;
