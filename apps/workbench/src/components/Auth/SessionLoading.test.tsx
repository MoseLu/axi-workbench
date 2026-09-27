import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WorkbenchLocaleProvider } from '@axi/workbench-foundation';
import { I18nProvider } from '../../i18n';
import { AuthProvider } from '../../contexts/AuthContext';
import SessionLoading from './SessionLoading';

describe('SessionLoading', () => {
  it('renders the warm dango orbit while the session is being checked', () => {
    render(
      <AuthProvider>
        <WorkbenchLocaleProvider>
          <I18nProvider>
            <SessionLoading />
          </I18nProvider>
        </WorkbenchLocaleProvider>
      </AuthProvider>,
    );

    expect(screen.getByRole('main', { name: '正在检查 Axi 会话…' })).toHaveClass('session-loading');
    expect(screen.getByText('正在检查 Axi 会话…')).toBeInTheDocument();
    expect(screen.getAllByTestId('session-loading-dango')).toHaveLength(7);
  });
});
