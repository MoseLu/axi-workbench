import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  announceNotificationChange,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type WorkbenchNotification,
} from '@axi/workbench-foundation';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const notificationQueryKey = ['axi', 'notifications'] as const;

function messageTone(category: WorkbenchNotification['category']): 'blue' | 'violet' | 'mint' {
  if (category === 'workspace') return 'violet';
  if (category === 'me') return 'mint';
  return 'blue';
}

function formatMessageTime(value: string, locale: string): string {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return '';

  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1_000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, 'second');
  if (Math.abs(elapsedSeconds) < 3_600) return formatter.format(Math.round(elapsedSeconds / 60), 'minute');
  if (Math.abs(elapsedSeconds) < 86_400) return formatter.format(Math.round(elapsedSeconds / 3_600), 'hour');
  if (Math.abs(elapsedSeconds) < 604_800) return formatter.format(Math.round(elapsedSeconds / 86_400), 'day');

  return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(new Date(timestamp));
}

export default function InboxPage() {
  const { locale, t } = useMobileI18n();
  const queryClient = useQueryClient();
  const inbox = useQuery({
    queryKey: notificationQueryKey,
    queryFn: ({ signal }) => fetchNotifications({ signal }),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const sync = async () => {
    await queryClient.invalidateQueries({ queryKey: notificationQueryKey });
    announceNotificationChange();
  };
  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: sync,
  });
  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(),
    onSuccess: sync,
  });

  const messages = inbox.data ?? [];
  const hasUnread = messages.some((message) => !message.read);
  const mutationError = markRead.error || markAllRead.error;

  return (
    <section className="axi-mobile-page" aria-busy={inbox.isFetching || markRead.isPending || markAllRead.isPending}>
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div><h1>{t('page.inbox')}</h1><p>{t('inbox.subtitle')}</p></div>
        {hasUnread ? (
          <button type="button" disabled={markAllRead.isPending} onClick={() => markAllRead.mutate()}>
            {markAllRead.isPending ? t('inbox.marking') : t('inbox.markAll')}
          </button>
        ) : null}
      </div>

      {inbox.isPending ? <div className="axi-mobile-inbox-state" role="status">{t('inbox.loading')}</div> : null}
      {inbox.isError || mutationError ? (
        <div className="axi-mobile-inbox-state is-error" role="alert">
          <span>{t('inbox.failed')}</span>
          <button type="button" onClick={() => void inbox.refetch()}>{t('inbox.retry')}</button>
        </div>
      ) : null}
      {!inbox.isPending && !inbox.isError && messages.length === 0 ? (
        <div className="axi-mobile-inbox-state">{t('inbox.empty')}</div>
      ) : null}
      {messages.length > 0 ? (
        <div className="axi-mobile-inbox-list" aria-live="polite">
          {messages.map((message) => {
            const isMarking = markRead.isPending && markRead.variables === message.id;
            return (
              <button
                type="button"
                key={message.id}
                className={`axi-mobile-message ${message.read ? '' : 'is-unread'}`}
                disabled={message.read || isMarking}
                onClick={() => {
                  if (!message.read) markRead.mutate(message.id);
                }}
              >
                <span className={`axi-mobile-message__mark is-${messageTone(message.category)}`}><MobileIcon name="bell" size={18} /></span>
                <span className="axi-mobile-message__body"><strong>{message.subject}</strong><small>{message.content}</small></span>
                <span className="axi-mobile-message__time">{!message.read && <i aria-hidden="true" />}{isMarking ? t('inbox.marking') : formatMessageTime(message.createdAt, locale)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
