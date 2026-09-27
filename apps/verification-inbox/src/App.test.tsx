import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { listAccounts, receiveCode } from './services/imap'

vi.mock('./services/imap', () => ({
  listAccounts: vi.fn().mockResolvedValue({ accounts: [] }),
  receiveCode: vi.fn(),
  beginOutlookAuthorization: vi.fn(),
  completeOutlookAuthorization: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ setBackgroundColor: vi.fn().mockResolvedValue(undefined) }),
}))

describe('Verification Inbox', () => {
  const account = {
    id: 'gmail-1',
    index: '1',
    label: 'Primary Gmail',
    email: 'primary@gmail.com',
    source: 'imap',
    sourceLabel: 'Gmail',
    note: '',
    available: true,
    canAuthorize: false,
    accountPassword: 'account-password',
    emailPassword: 'email-password',
    isCockpit: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listAccounts).mockResolvedValue({
      accounts: [],
      stats: { total: 0, imap: 0, otp: 0, pool: 0, available: 0 },
    })
  })

  it('renders the empty inbox and keeps the navigation usable', async () => {
    const user = userEvent.setup()
    render(<App />)

    expect(await screen.findByText('没有匹配的账号')).toBeInTheDocument()
    const nav = screen.getByRole('navigation')
    expect(nav).toBeInTheDocument()
    const accountFilter = screen.getByRole('button', { name: 'Gmail' })
    await user.click(accountFilter)
    expect(accountFilter).toHaveClass('active')
  })

  it('receives a code through the visible account action', async () => {
    vi.mocked(listAccounts).mockResolvedValue({
      accounts: [account],
      stats: { total: 1, imap: 1, otp: 0, pool: 0, available: 1 },
    })
    vi.mocked(receiveCode).mockResolvedValue({
      status: 'done',
      statusLabel: '验证码已获取',
      statusKind: 'ok',
      code: '123456',
      message: null,
      stale: false,
      error: '',
    })

    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '接收' }))

    expect(receiveCode).toHaveBeenCalledWith('gmail-1')
    expect(await screen.findByText('123456')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('验证码已获取')
  })

  it('surfaces a receive error and leaves the action recoverable', async () => {
    vi.mocked(listAccounts).mockResolvedValue({
      accounts: [account],
      stats: { total: 1, imap: 1, otp: 0, pool: 0, available: 1 },
    })
    vi.mocked(receiveCode).mockRejectedValue(new Error('IMAP 连接失败'))

    const user = userEvent.setup()
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '接收' }))

    expect(await screen.findByRole('status')).toHaveTextContent('IMAP 连接失败')
    expect(screen.getByRole('button', { name: '接收' })).toBeEnabled()
  })
})
