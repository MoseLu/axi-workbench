import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Handoff from './Handoff';

vi.mock('@axi/crud', async () => {
  const actual = await vi.importActual<typeof import('@axi/crud')>('@axi/crud');
  return {
    ...actual,
    AxiTable: ({ columns, data, onRow }: { columns: Array<{ dataIndex: string; render?: (value: unknown, row: any) => React.ReactNode }>; data: Array<any>; onRow?: (row: any) => { onClick?: () => void } }) => (
      <table><tbody>{data.map((row) => <tr key={String(row.id)} onClick={onRow?.(row).onClick}>{columns.map((column, index) => <td key={`${column.dataIndex}-${index}`}>{column.render ? column.render(row[column.dataIndex], row) : String(row[column.dataIndex] ?? '')}</td>)}</tr>)}</tbody></table>
    ),
  };
});

const pendingHandoff = {
  id: 'handoff_12345678-1234-4234-8234-123456789abc',
  handoffCorrelationId: 'handoff:scan_abcdefgh',
  sourceSurface: 'mobile',
  targetSurface: 'web',
  status: 'opened',
  approvalId: 'approval_1',
  object: { projectId: 'sample-app', actionId: 'diagnose', actionType: 'project_diagnosis' },
  impact: '需要在 Web 完成复杂处理。',
  riskLevel: 'high',
  createdAt: '2026-09-13T00:00:00.000Z',
};

describe('Handoff', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    vi.stubGlobal('ResizeObserver', class {
      observe() {}
      unobserve() {}
      disconnect() {}
    });
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => String(input).includes('/api/v1/control-plane/snapshot')
        ? { generatedAt: '2026-09-13T00:05:00.000Z', resources: [{ id: 'sample-app', name: '当前示例项目', status: 'available' }] }
        : init?.method === 'POST'
          ? { ...pendingHandoff, status: 'rejected', rejectedBy: 'owner@example.test', rejectionReason: '当前责任范围不匹配' }
          : pendingHandoff,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('requires a reason and records a rejected terminal handoff', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={[`/admin/handoff/${pendingHandoff.id}`]}>
        <Routes>
          <Route path="/admin/handoff/:id" element={<Handoff />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole('button', { name: '拒绝续办' })).toBeEnabled());
    expect(screen.getByText('available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开项目详情' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '拒绝续办' }));
    const confirm = screen.getByRole('button', { name: '确认拒绝' });
    expect(confirm).toBeDisabled();
    await user.type(screen.getByPlaceholderText('请说明拒绝原因'), '当前责任范围不匹配');
    expect(confirm).toBeEnabled();
    await user.click(confirm);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/control-plane/snapshot'),
      expect.objectContaining({ credentials: 'include' }),
    ));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/handoffs/${pendingHandoff.id}`),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'reject', reason: '当前责任范围不匹配' }),
      }),
    ));
    expect(await screen.findByText('rejected')).toBeInTheDocument();
  });

  it('renders server-backed handoff history and applies a status filter', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => ({ handoffs: [pendingHandoff] }),
    }));
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/admin/handoff']}>
        <Routes>
          <Route path="/admin/handoff" element={<Handoff />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('交接历史')).toBeInTheDocument();
    expect(screen.getByText('sample-app')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('交接状态筛选'), 'completed');
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/handoffs?status=completed'),
      expect.objectContaining({ credentials: 'include' }),
    ));
  });

  it('does not fall back to the handoff snapshot when current project refresh fails', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => ({
      ok: !String(input).includes('/api/v1/control-plane/snapshot'),
      json: async () => pendingHandoff,
    }));
    render(
      <MemoryRouter initialEntries={[`/admin/handoff/${pendingHandoff.id}`]}>
        <Routes>
          <Route path="/admin/handoff/:id" element={<Handoff />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('无法从控制面读取交接记录或当前对象状态；未显示静态替代数据。')).toBeInTheDocument();
    expect(screen.queryByText('需要在 Web 完成复杂处理。')).not.toBeInTheDocument();
  });
});
