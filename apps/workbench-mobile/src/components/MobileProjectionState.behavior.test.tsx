import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { MobileProjectionState } from './MobileProjectionState';

describe('MobileProjectionState behavior', () => {
  it('exposes an actionable retry for an authorized request failure', async () => {
    const user = userEvent.setup();
    const onRefresh = vi.fn();
    render(
      <MemoryRouter>
        <MobileProjectionState
          error={{ status: 503 }}
          isLoading={false}
          onRefresh={onRefresh}
          session={{ deviceId: 'device-1', expiresAt: Date.now() / 1000 + 60 }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('控制面暂时不可用');
    await user.click(screen.getByRole('button', { name: '重新连接' }));
    expect(onRefresh).toHaveBeenCalledOnce();
  });
});
