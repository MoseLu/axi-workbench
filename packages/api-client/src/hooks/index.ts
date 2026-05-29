import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, controlPlaneClient } from "../client"
import type {
  ControlRun,
  ControlSnapshot,
  ControlJob,
  TaskEvent,
  AgentTask,
  ApprovalRequest,
  LoginInput,
  RegisterInput,
  TokenResponse,
  User,
  Project,
  ProjectListResponse,
  Task,
  TaskListResponse,
} from "@axi/workstation-contracts"
import type { AxiosRequestConfig } from "axios"

// ============================================
// Auth Hooks
// ============================================

export const useLogin = () => {
  return useMutation({
    mutationFn: (data: LoginInput) =>
      apiClient.post<TokenResponse>("/api/v1/auth/login", data).then((res) => res.data),
  })
}

export const useRegister = () => {
  return useMutation({
    mutationFn: (data: RegisterInput) =>
      apiClient.post<TokenResponse>("/api/v1/auth/register", data).then((res) => res.data),
  })
}

export const useCurrentUser = (options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: () =>
      apiClient.get<User>("/api/v1/auth/me", options).then((res) => res.data),
  })
}

// ============================================
// Project Hooks
// ============================================

export const useProjects = (params?: { page?: number; pageSize?: number }, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["projects", params],
    queryFn: () =>
      apiClient
        .get<ProjectListResponse>("/api/v1/projects", { params, ...options })
        .then((res) => res.data),
  })
}

export const useProject = (id: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      apiClient.get<Project>(`/api/v1/projects/${id}`, options).then((res) => res.data),
    enabled: !!id,
  })
}

export const useCreateProject = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Project>) =>
      apiClient.post<Project>("/api/v1/projects", data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

export const useUpdateProject = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Project>) =>
      apiClient
        .put<Project>(`/api/v1/projects/${id}`, data)
        .then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
      queryClient.invalidateQueries({ queryKey: ["project", variables.id] })
    },
  })
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/projects/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] })
    },
  })
}

// ============================================
// Task Hooks
// ============================================

export const useTasks = (
  params?: { projectId?: string; page?: number; pageSize?: number },
  options?: AxiosRequestConfig
) => {
  return useQuery({
    queryKey: ["tasks", params],
    queryFn: () =>
      apiClient
        .get<TaskListResponse>("/api/v1/tasks", { params, ...options })
        .then((res) => res.data),
  })
}

export const useTask = (id: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () =>
      apiClient.get<Task>(`/api/v1/tasks/${id}`, options).then((res) => res.data),
    enabled: !!id,
  })
}

export const useCreateTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Task>) =>
      apiClient.post<Task>("/api/v1/tasks", data).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      if (variables.projectId) {
        queryClient.invalidateQueries({ queryKey: ["tasks", { projectId: variables.projectId }] })
      }
    },
  })
}

export const useUpdateTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<Task>) =>
      apiClient.put<Task>(`/api/v1/tasks/${id}`, data).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
      queryClient.invalidateQueries({ queryKey: ["task", variables.id] })
    },
  })
}

export const useDeleteTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.delete(`/api/v1/tasks/${id}`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] })
    },
  })
}

// ============================================
// Control Plane Hooks
// ============================================

export const useControlSnapshot = (options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["controlSnapshot"],
    queryFn: () =>
      controlPlaneClient
        .get<ControlSnapshot>("/snapshot", options)
        .then((res) => res.data),
  })
}

export const useControlQuery = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { text: string; channel?: string; dryRun?: boolean }) =>
      controlPlaneClient
        .post<ControlRun>("/query", data)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
    },
  })
}

export const useRunControlCommand = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (commandId: string) =>
      controlPlaneClient
        .post<ControlRun>(`/commands/${encodeURIComponent(commandId)}/run`)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
    },
  })
}

export const useCreateControlJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: { envelope: { id: string; channel: string; conversationId: string; senderId: string; text: string; receivedAt?: string; raw?: Record<string, unknown> } }) =>
      controlPlaneClient
        .post<{ accepted: boolean; job: ControlJob; latestEvent?: TaskEvent; response?: unknown }>("/jobs", data)
        .then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
      if (data?.job?.id) {
        queryClient.invalidateQueries({ queryKey: ["controlJob", data.job.id] })
        queryClient.invalidateQueries({ queryKey: ["controlJobEvents", data.job.id] })
      }
    },
  })
}

export const useControlJob = (jobId: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["controlJob", jobId],
    enabled: Boolean(jobId),
    queryFn: () =>
      controlPlaneClient
        .get<ControlJob>(`/jobs/${encodeURIComponent(jobId)}`, options)
        .then((res) => res.data),
  })
}

export const useControlJobEvents = (jobId: string, afterEventId?: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["controlJobEvents", jobId, afterEventId || ""],
    enabled: Boolean(jobId),
    queryFn: () =>
      controlPlaneClient
        .get<{ events: TaskEvent[] }>(`/jobs/${encodeURIComponent(jobId)}/events`, {
          ...options,
          params: { ...(options?.params || {}), ...(afterEventId ? { afterEventId } : {}) },
        })
        .then((res) => res.data),
  })
}

export const useControlJobArtifacts = (jobId: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["controlJobArtifacts", jobId],
    enabled: Boolean(jobId),
    queryFn: () =>
      controlPlaneClient
        .get<{ artifacts: { path: string }[] }>(`/jobs/${encodeURIComponent(jobId)}/artifacts`, options)
        .then((res) => res.data),
  })
}

export const useCancelControlJob = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (jobId: string) =>
      controlPlaneClient
        .post<ControlJob>(`/jobs/${encodeURIComponent(jobId)}/cancel`)
        .then((res) => res.data),
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
      queryClient.invalidateQueries({ queryKey: ["controlJob", job.id] })
      queryClient.invalidateQueries({ queryKey: ["controlJobEvents", job.id] })
    },
  })
}

export const useCancelAgentTask = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (taskId: string) =>
      controlPlaneClient
        .post<AgentTask>(`/agent-tasks/${encodeURIComponent(taskId)}/cancel`)
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
    },
  })
}

export const useDecideApproval = () => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, decisionText }: { id: string; decision: "approved" | "rejected"; decisionText?: string }) =>
      controlPlaneClient
        .post<ApprovalRequest>(`/approvals/${encodeURIComponent(id)}/decision`, { decision, decisionText })
        .then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["controlSnapshot"] })
    },
  })
}
