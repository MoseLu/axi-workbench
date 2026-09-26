import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ControlPlaneState } from './ControlPlaneState';

describe('ControlPlaneState behavior', () => {
  it('lets the user retry a failed control-plane connection', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <ControlPlaneState
        actionLabel="重新连接"
        description="控制面暂时不可用。"
        onAction={onAction}
        title="工作区暂不可用"
      />,
    );

    expect(screen.getByRole('status')).toHaveTextContent('工作区暂不可用');
    await user.click(screen.getByRole('button', { name: '重新连接' }));
    expect(onAction).toHaveBeenCalledOnce();
  });
});
