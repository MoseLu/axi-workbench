import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient, controlPlaneClient } from "../client"
import type {
  ControlRun,
  ControlSnapshot,
  ControlJob,
  TaskEvent,
  AgentTask,
  ApprovalRequest,
  Project,
  ProjectListResponse,
} from "@axi/workstation-contracts"
import type { AxiosRequestConfig } from "axios"

// ============================================
// Project Hooks
// ============================================

/**
 * Compatibility read model backed by the retiring Spring/H2 core-service.
 * New work must use useTenantProjects from ./platform instead.
 */
export const useLegacyProjects = (params?: { page?: number; pageSize?: number }, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["projects", params],
    queryFn: () =>
      apiClient
        .get<ProjectListResponse>("/api/v1/projects", { params, ...options })
        .then((res) => res.data),
  })
}

/** @deprecated Use tenant-scoped platform hooks for new code. */
export const useLegacyProject = (id: string, options?: AxiosRequestConfig) => {
  return useQuery({
    queryKey: ["project", id],
    queryFn: () =>
      apiClient.get<Project>(`/api/v1/projects/${id}`, options).then((res) => res.data),
    enabled: !!id,
  })
}

// Mutation and task hooks for /api/v1/projects and /api/v1/tasks were removed
// intentionally: the legacy core-service is read-only compatibility only.

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
    // Control plane is a local process; brief restarts should recover without a hard empty state.
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 10_000,
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
