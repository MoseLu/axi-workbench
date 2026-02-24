import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { apiClient } from "../client"
import type {
  LoginInput,
  RegisterInput,
  TokenResponse,
  User,
  Project,
  ProjectListResponse,
  Task,
  TaskListResponse,
} from "@epap/schemas"
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
