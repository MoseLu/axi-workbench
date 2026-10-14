import React from 'react';
import { useI18n } from '../i18n';

const HomeCard: React.FC<{ title: string; description: string }> = React.memo(({ title, description }) => (
  <div style={{
    padding: 24,
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.06)'
  }}>
    <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{title}</h3>
    <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)' }}>{description}</p>
  </div>
));
HomeCard.displayName = 'HomeCard';

const HOME_CARDS: ReadonlyArray<{ title: string; description: string }> = [
  { title: 'Projects', description: 'Manage your enterprise projects' },
  { title: 'Workflows', description: 'Automate business processes' },
  { title: 'Knowledge Base', description: 'Access AI-powered documentation' },
];

const Home: React.FC = () => {
  const { t } = useI18n();
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        {t("home.title")}
      </h1>
      <p style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.6 }}>
        Enterprise Project Automation Platform - Your central hub for project management,
        workflow automation, and knowledge collaboration.
      </p>
      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        {HOME_CARDS.map((card) => (
          <HomeCard key={card.title} description={card.description} title={card.title} />
        ))}
      </div>
    </div>
  );
};

export default Home;
