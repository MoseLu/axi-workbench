/**
 * A domain approval QR is deliberately opaque: axi://approval/<scanId>.
 * It contains no identity credential, project id, action id, or business credential.  The
 * server resolves the current object and policy after a paired device scans.
 */
export function parseApprovalScanPayload(rawValue: string): { scanToken: string } {
  const value = rawValue.trim();
  const parsed = new URL(value);
  if (parsed.protocol !== 'axi:' || parsed.hostname !== 'approval' || parsed.search || parsed.hash) {
    throw new Error('invalid approval scan URI');
  }
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 1 || !/^scan_[A-Za-z0-9_-]{8,}$/.test(segments[0])) {
    throw new Error('invalid approval scan token');
  }
  return { scanToken: segments[0] };
}
