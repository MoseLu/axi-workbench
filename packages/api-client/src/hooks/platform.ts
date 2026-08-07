import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { platformApi, type TenantDictionary, type TenantRole, type TenantTask, type UserPreferences } from '../platform';

export const platformQueryKeys = {
  tenants: ['platform', 'tenants'] as const,
  members: (tenantId: string) => ['platform', 'tenants', tenantId, 'members'] as const,
  preferences: ['platform', 'preferences'] as const,
  dictionary: (tenantId: string, key: string) => ['platform', 'tenants', tenantId, 'dictionaries', key] as const,
  projects: (tenantId: string) => ['platform', 'tenants', tenantId, 'projects'] as const,
  tasks: (tenantId: string) => ['platform', 'tenants', tenantId, 'tasks'] as const,
};

export const useTenants = () => useQuery({ queryKey: platformQueryKeys.tenants, queryFn: platformApi.listTenants });

export const useCreateTenant = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: platformApi.createTenant,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.tenants }),
  });
};

export const useTenantMembers = (tenantId: string) => useQuery({
  queryKey: platformQueryKeys.members(tenantId),
  enabled: Boolean(tenantId),
  queryFn: () => platformApi.listMembers(tenantId),
});

export const useSaveTenantMember = (tenantId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subject, role }: { subject: string; role: TenantRole }) => platformApi.saveMember(tenantId, subject, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.members(tenantId) }),
  });
};

export const usePreferences = () => useQuery({ queryKey: platformQueryKeys.preferences, queryFn: platformApi.getPreferences });

export const useSavePreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Partial<Omit<UserPreferences, 'subject' | 'updatedAt'>>) => platformApi.savePreferences(preferences),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.preferences }),
  });
};

export const useTenantDictionary = (tenantId: string, key: string) => useQuery({
  queryKey: platformQueryKeys.dictionary(tenantId, key),
  enabled: Boolean(tenantId && key),
  queryFn: () => platformApi.getDictionary(tenantId, key),
});

export const useSaveTenantDictionary = (tenantId: string, key: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entries: TenantDictionary['entries']) => platformApi.saveDictionary(tenantId, key, entries),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.dictionary(tenantId, key) }),
  });
};

export const useTenantProjects = (tenantId: string) => useQuery({
  queryKey: platformQueryKeys.projects(tenantId),
  enabled: Boolean(tenantId),
  queryFn: () => platformApi.listProjects(tenantId),
});

export const useCreateTenantProject = (tenantId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string }) => platformApi.createProject(tenantId, { name: data.name, description: data.description ?? '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.projects(tenantId) }),
  });
};

export const useTenantTasks = (tenantId: string) => useQuery({
  queryKey: platformQueryKeys.tasks(tenantId),
  enabled: Boolean(tenantId),
  queryFn: () => platformApi.listTasks(tenantId),
});

export const useCreateTenantTask = (tenantId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Pick<TenantTask, 'projectId' | 'title' | 'status'>) => platformApi.createTask(tenantId, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: platformQueryKeys.tasks(tenantId) }),
  });
};
