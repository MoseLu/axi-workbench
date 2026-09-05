import { resolveGatewayURL } from './auth';

export type WorkbenchNotificationType = 'email' | 'in_app';
export type WorkbenchNotificationCategory = 'home' | 'projects' | 'workspace' | 'me';

export type WorkbenchNotification = {
  id: string;
  type: WorkbenchNotificationType;
  userId: string;
  recipient: string;
  subject: string;
  content: string;
  category: WorkbenchNotificationCategory;
  dotOnly: boolean;
  read: boolean;
  status: 'pending' | 'sent' | 'failed';
  createdAt: string;
  sentAt?: string;
};

export class NotificationApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'NotificationApiError';
    this.status = status;
  }
}

export const NOTIFICATIONS_CHANGED_EVENT = 'axi:notifications-changed';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new Error(`notification payload is missing ${field}`);
  return value;
}

function readBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`notification payload is missing ${field}`);
  return value;
}

function readType(value: unknown): WorkbenchNotificationType {
  if (value === 'email' || value === 'in_app') return value;
  throw new Error('notification payload has an unsupported type');
}

function readCategory(value: unknown): WorkbenchNotificationCategory {
  if (value === 'home' || value === 'projects' || value === 'workspace' || value === 'me') return value;
  throw new Error('notification payload has an unsupported category');
}

function readStatus(value: unknown): WorkbenchNotification['status'] {
  if (value === 'pending' || value === 'sent' || value === 'failed') return value;
  throw new Error('notification payload has an unsupported status');
}

function decodeNotification(value: unknown): WorkbenchNotification {
  if (!isRecord(value)) throw new Error('notification payload item is invalid');
  const sentAt = value.sentAt;
  if (sentAt !== undefined && typeof sentAt !== 'string') {
    throw new Error('notification payload has an invalid sentAt');
  }

  return {
    id: readString(value.id, 'id'),
    type: readType(value.type),
    userId: readString(value.userId, 'userId'),
    recipient: readString(value.recipient, 'recipient'),
    subject: readString(value.subject, 'subject'),
    content: readString(value.content, 'content'),
    category: readCategory(value.category),
    dotOnly: readBoolean(value.dotOnly, 'dotOnly'),
    read: readBoolean(value.read, 'read'),
    status: readStatus(value.status),
    createdAt: readString(value.createdAt, 'createdAt'),
    ...(sentAt ? { sentAt } : {}),
  };
}

async function requestJSON(path: string, init: RequestInit = {}): Promise<unknown> {
  const response = await fetch(resolveGatewayURL(path), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = `notification request failed (${response.status})`;
    try {
      const body = await response.json() as unknown;
      if (isRecord(body) && typeof body.error === 'string' && body.error.trim()) {
        message = body.error;
      }
    } catch {
      // Keep the status-derived error when an intermediary returns non-JSON.
    }
    throw new NotificationApiError(message, response.status);
  }

  return response.json();
}

/** Returns only notifications persisted for the verified gateway subject. */
export async function fetchNotifications(options: {
  unreadOnly?: boolean;
  signal?: AbortSignal;
} = {}): Promise<WorkbenchNotification[]> {
  const suffix = options.unreadOnly ? '?unreadOnly=true' : '';
  const payload = await requestJSON(`/api/v1/notifications${suffix}`, { signal: options.signal });
  if (!isRecord(payload) || !Array.isArray(payload.notifications)) {
    throw new Error('notification list payload is invalid');
  }
  return payload.notifications.map(decodeNotification);
}

/** Persists a single read transition for the verified gateway subject. */
export async function markNotificationRead(id: string, signal?: AbortSignal): Promise<WorkbenchNotification> {
  const notificationID = id.trim();
  if (!notificationID) throw new Error('notification id is required');
  const payload = await requestJSON(`/api/v1/notifications/${encodeURIComponent(notificationID)}/read`, {
    method: 'PUT',
    signal,
  });
  return decodeNotification(payload);
}

/** Persists read transitions for every unread notification visible to the subject. */
export async function markAllNotificationsRead(signal?: AbortSignal): Promise<number> {
  const payload = await requestJSON('/api/v1/notifications/read-all', {
    method: 'PUT',
    signal,
  });
  if (!isRecord(payload) || typeof payload.marked !== 'number') {
    throw new Error('notification mark-all payload is invalid');
  }
  return Math.max(0, Math.trunc(payload.marked));
}

/** Lets independently rendered navigation badges refresh immediately after a read mutation. */
export function announceNotificationChange(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}
