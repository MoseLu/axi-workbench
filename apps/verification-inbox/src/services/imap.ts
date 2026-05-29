import { invoke } from "@tauri-apps/api/core";
import type {
  AccountListPayload,
  OutlookAuthorizationBeginResult,
  OutlookAuthorizationCompleteResult,
  ReceiveCodeResult,
} from "../types";
import { isHostedBrowser } from "../hosted";

const hostedBridgeMessage = "Axi Verification Inbox 当前在 Dashboard 托管预览中，真实接码操作需要桌面 Tauri 后端。";

function hostedAccountPayload(): AccountListPayload {
  return {
    accounts: [],
    stats: {
      total: 0,
      imap: 0,
      otp: 0,
      pool: 0,
      available: 0,
    },
  };
}

function requireNativeBridge<T>(): Promise<T> {
  return Promise.reject(new Error(hostedBridgeMessage));
}

export async function listAccounts(): Promise<AccountListPayload> {
  if (isHostedBrowser) return hostedAccountPayload();
  return invoke<AccountListPayload>("list_accounts");
}

export async function receiveCode(accountId: string): Promise<ReceiveCodeResult> {
  if (isHostedBrowser) return requireNativeBridge();
  return invoke<ReceiveCodeResult>("receive_code", { accountId });
}

export async function beginOutlookAuthorization(accountId: string): Promise<OutlookAuthorizationBeginResult> {
  if (isHostedBrowser) return requireNativeBridge();
  return invoke<OutlookAuthorizationBeginResult>("begin_outlook_authorization", { accountId });
}

export async function completeOutlookAuthorization(params: {
  email: string;
  clientId: string;
  deviceCode: string;
  interval: number;
  expiresIn: number;
}): Promise<OutlookAuthorizationCompleteResult> {
  if (isHostedBrowser) return requireNativeBridge();
  return invoke<OutlookAuthorizationCompleteResult>("complete_outlook_authorization", params);
}
