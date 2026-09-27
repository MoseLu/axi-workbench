export type QRApprovalPayload = Readonly<{
  transactionId: string;
  ticket: string;
}>;

const approvalPathPrefix = ['api', 'v1', 'auth', 'qr', 'transactions'] as const;
const transactionIDPattern = /^[A-Za-z0-9_-]{1,128}$/;
const ticketPattern = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Parse only the opaque Axi QR approval URI emitted by Identity Adapter.
 * The ticket remains in local function scope and is never persisted or logged.
 */
export function parseQRApprovalPayload(rawValue: string): QRApprovalPayload {
  const payload = new URL(rawValue);
  if ((payload.protocol !== 'https:' && payload.protocol !== 'http:') || !payload.hostname || payload.username || payload.password || payload.hash) {
    throw new Error('Unsupported QR approval URI');
  }

  const segments = payload.pathname.split('/').filter(Boolean);
  const [api, version, auth, qr, transactions, transactionId, approve] = segments;
  if (
    segments.length !== 7
    || api !== approvalPathPrefix[0]
    || version !== approvalPathPrefix[1]
    || auth !== approvalPathPrefix[2]
    || qr !== approvalPathPrefix[3]
    || transactions !== approvalPathPrefix[4]
    || approve !== 'approve'
    || !transactionIDPattern.test(transactionId || '')
  ) {
    throw new Error('Invalid QR approval path');
  }

  const tickets = payload.searchParams.getAll('ticket');
  if (tickets.length !== 1 || !ticketPattern.test(tickets[0])) {
    throw new Error('Invalid QR approval ticket');
  }

  return { transactionId: transactionId as string, ticket: tickets[0] };
}

/** Build the gateway endpoint without carrying the opaque ticket in a URL. */
export function qrApprovalEndpoint(transactionId: string): string {
  return `/api/v1/auth/qr/transactions/${encodeURIComponent(transactionId)}/approve`;
}
