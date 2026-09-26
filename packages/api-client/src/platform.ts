import { apiClient } from './client';

export type TenantRole = 'owner' | 'admin' | 'editor' | 'viewer';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export interface TenantMembership {
  tenantId: string;
  subject: string;
  role: TenantRole;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  subject: string;
  locale: string;
  theme: 'light' | 'dark' | 'system';
  timezone: string;
  notificationsMuted: boolean;
  updatedAt: string;
}

export interface TenantDictionary {
  tenantId: string;
  key: string;
  version: number;
  entries: Record<string, unknown>;
  updatedAt: string;
}

export interface TenantProject {
  id: string;
  tenantId: string;
  name: string;
  description: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TenantTask {
  id: string;
  tenantId: string;
  projectId: string;
  title: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const platformApi = {
  listTenants: async (): Promise<Tenant[]> =>
    (await apiClient.get<{ items: Tenant[] }>('/api/v1/tenants')).data.items,
  createTenant: async (data: Pick<Tenant, 'name' | 'slug'>): Promise<Tenant> =>
    (await apiClient.post<Tenant>('/api/v1/tenants', data)).data,
  listMembers: async (tenantId: string): Promise<TenantMembership[]> =>
    (await apiClient.get<{ items: TenantMembership[] }>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/members`)).data.items,
  saveMember: async (tenantId: string, subject: string, role: TenantRole): Promise<TenantMembership> =>
    (await apiClient.put<TenantMembership>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/members/${encodeURIComponent(subject)}`, { role })).data,
  getPreferences: async (): Promise<UserPreferences> =>
    (await apiClient.get<UserPreferences>('/api/v1/me/preferences')).data,
  savePreferences: async (data: Partial<Omit<UserPreferences, 'subject' | 'updatedAt'>>): Promise<UserPreferences> =>
    (await apiClient.patch<UserPreferences>('/api/v1/me/preferences', data)).data,
  getDictionary: async (tenantId: string, key: string): Promise<TenantDictionary> =>
    (await apiClient.get<TenantDictionary>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/dictionaries/${encodeURIComponent(key)}`)).data,
  saveDictionary: async (tenantId: string, key: string, entries: Record<string, unknown>): Promise<TenantDictionary> =>
    (await apiClient.put<TenantDictionary>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/dictionaries/${encodeURIComponent(key)}`, { entries })).data,
  listProjects: async (tenantId: string): Promise<TenantProject[]> =>
    (await apiClient.get<{ items: TenantProject[] }>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/projects`)).data.items,
  createProject: async (tenantId: string, data: Pick<TenantProject, 'name' | 'description'>): Promise<TenantProject> =>
    (await apiClient.post<TenantProject>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/projects`, data)).data,
  listTasks: async (tenantId: string): Promise<TenantTask[]> =>
    (await apiClient.get<{ items: TenantTask[] }>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/tasks`)).data.items,
  createTask: async (tenantId: string, data: Pick<TenantTask, 'projectId' | 'title' | 'status'>): Promise<TenantTask> =>
    (await apiClient.post<TenantTask>(`/api/v1/tenants/${encodeURIComponent(tenantId)}/tasks`, data)).data,
};
