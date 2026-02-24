import React from 'react';

const Home: React.FC = () => {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        Welcome to EPAP Portal
      </h1>
      <p style={{ color: 'rgba(255, 255, 255, 0.65)', lineHeight: 1.6 }}>
        Enterprise Project Automation Platform - Your central hub for project management,
        workflow automation, and knowledge collaboration.
      </p>
      <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
        <div style={{
          padding: 24,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Projects</h3>
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)' }}>
            Manage your enterprise projects
          </p>
        </div>
        <div style={{
          padding: 24,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Workflows</h3>
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)' }}>
            Automate business processes
          </p>
        </div>
        <div style={{
          padding: 24,
          background: 'rgba(255, 255, 255, 0.03)',
          borderRadius: 8,
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Knowledge Base</h3>
          <p style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.45)' }}>
            Access AI-powered documentation
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
