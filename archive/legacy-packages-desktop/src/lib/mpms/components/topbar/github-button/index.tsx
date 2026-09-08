import React from 'react';

export interface GithubButtonProps {
  url?: string;
  icon: React.ReactNode;
  tooltip?: string;
}

const GithubButton: React.FC<GithubButtonProps> = ({
  url = 'https://github.com',
  icon,
  tooltip = 'GitHub',
}) => (
  <button
    className="mpms-icon-btn mpms-icon-btn--md"
    title={tooltip}
    onClick={() => window.open(url, '_blank')}
    type="button"
  >
    {icon}
  </button>
);

export default GithubButton;
