import { useState } from 'react';
import { MobileIcon } from '../components/MobileIcons';
import { useMobileI18n } from '../i18n';

const initialMessages = [
  { id: 'review', title: 'Axi WorkBench', text: '导航组件审查已完成，等待你的确认。', time: '刚刚', unread: true, tone: 'blue' },
  { id: 'graph', title: 'Story Graph', text: '时间线有 3 个待补充的证据节点。', time: '28 分钟前', unread: true, tone: 'violet' },
  { id: 'sync', title: '工作台', text: '本地同步已完成，没有发现冲突。', time: '昨天', unread: false, tone: 'mint' },
];

export default function InboxPage() {
  const [messages, setMessages] = useState(initialMessages);
  const { t } = useMobileI18n();
  const unread = messages.some((message) => message.unread);

  return (
    <section className="axi-mobile-page">
      <div className="axi-mobile-page-intro axi-mobile-page-intro--with-action">
        <div><h1>{t('page.inbox')}</h1><p>{t('inbox.subtitle')}</p></div>
        {unread && <button type="button" onClick={() => setMessages((items) => items.map((item) => ({ ...item, unread: false })))}>{t('inbox.markAll')}</button>}
      </div>
      <div className="axi-mobile-inbox-list">
        {messages.map((message) => (
          <button type="button" key={message.id} className={`axi-mobile-message ${message.unread ? 'is-unread' : ''}`} onClick={() => setMessages((items) => items.map((item) => item.id === message.id ? { ...item, unread: false } : item))}>
            <span className={`axi-mobile-message__mark is-${message.tone}`}>{message.title.slice(0, 1)}</span>
            <span className="axi-mobile-message__body"><strong>{message.title}</strong><small>{message.text}</small></span>
            <span className="axi-mobile-message__time">{message.unread && <i aria-hidden="true" />}{message.time}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
