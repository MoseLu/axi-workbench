export type StatusKind = "info" | "ok" | "warn" | "bad";

export interface CodeAccount {
  id: string;
  index: string;
  label: string;
  email: string;
  source: string;
  sourceLabel: string;
  note: string;
  available: boolean;
  canAuthorize: boolean;
  accountPassword: string;
  emailPassword: string;
  isCockpit: boolean;
}

export interface AccountStats {
  total: number;
  imap: number;
  otp: number;
  pool: number;
  available: number;
}

export interface AccountListPayload {
  accounts: CodeAccount[];
  stats: AccountStats;
}

export interface MessageView {
  mailbox: string;
  from: string;
  subject: string;
  date: string;
}

export interface ReceiveCodeResult {
  status: "done" | "waiting" | "timeout" | "error";
  statusLabel: string;
  statusKind: StatusKind;
  code: string;
  message: MessageView | null;
  stale: boolean;
  error: string;
}

export interface OutlookAuthorizationBeginResult {
  status: "pending" | "error";
  statusLabel: string;
  statusKind: StatusKind;
  email?: string;
  clientId?: string;
  deviceCode?: string;
  userCode?: string;
  verificationUri?: string;
  interval?: number;
  expiresIn?: number;
}

export interface OutlookAuthorizationCompleteResult {
  status: "done" | "error";
  statusLabel: string;
  statusKind: StatusKind;
  account: CodeAccount | null;
}

export interface RowState {
  busy: boolean;
  code: string;
  statusLabel: string;
  statusKind: StatusKind;
  message: MessageView | null;
}
