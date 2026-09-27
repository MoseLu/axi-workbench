import { ResourceBrokerLogo } from "./ResourceBrokerLogo";

export function EmptyConversation() {
  return (
    <div className="empty-conversation">
      <div className="empty-brand" aria-label="资源调度中心">
        <ResourceBrokerLogo />
        <div className="empty-brand-lockup">
          <span className="empty-brand-overline">LOCAL RESOURCE BROKER</span>
          <strong className="empty-brand-title">资源调度中心</strong>
        </div>
      </div>
    </div>
  );
}
