import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { controlPlaneClient } from "../client";

// Types
export type HandoffSurface = "web" | "mobile";
export type HandoffActionLevel = "A" | "B" | "C" | "D";
export type HandoffStatus = "pending" | "opened" | "completed" | "rejected" | "expired";
export type HandoffObject = { type: string; id: string };

export interface Handoff {
  id: string;
  source: HandoffSurface;
  targetSurface: HandoffSurface;
  actionLevel?: HandoffActionLevel;
  object: HandoffObject;
  status: HandoffStatus;
  reason?: string;
  impact?: string;
  createdAt: string;
  expiresAt?: string;
}

export type CreateHandoffParams = {
  direction: HandoffSurface;
  targetSurface: HandoffSurface;
  actionLevel: HandoffActionLevel;
  object: HandoffObject;
  context?: Record<string, unknown>;
};

export type ListHandoffsParams = {
  status?: HandoffStatus;
  direction?: HandoffSurface;
  limit?: number;
};

// API functions
export async function createHandoff(params: CreateHandoffParams): Promise<{ id: string }> {
  const response = await controlPlaneClient.post<{ id: string }>("/handoffs", params);
  return response.data;
}

export async function listHandoffs(params?: ListHandoffsParams): Promise<Handoff[]> {
  const response = await controlPlaneClient.get<Handoff[]>("/handoffs", { params });
  return response.data;
}

export async function getHandoff(handoffId: string): Promise<Handoff> {
  const response = await controlPlaneClient.get<Handoff>(`/handoffs/${encodeURIComponent(handoffId)}`);
  return response.data;
}

export async function acceptHandoff(handoffId: string): Promise<Handoff> {
  const response = await controlPlaneClient.post<Handoff>(`/handoffs/${encodeURIComponent(handoffId)}/accept`, {});
  return response.data;
}

export async function rejectHandoff(handoffId: string, reason: string): Promise<Handoff> {
  const response = await controlPlaneClient.post<Handoff>(`/handoffs/${encodeURIComponent(handoffId)}/reject`, { reason });
  return response.data;
}

// React Query hooks
export function useCreateHandoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: CreateHandoffParams) => createHandoff(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs"] });
    },
  });
}

export function useHandoffs(params?: ListHandoffsParams) {
  return useQuery({
    queryKey: ["handoffs", params],
    queryFn: () => listHandoffs(params),
  });
}

export function useHandoff(handoffId: string) {
  return useQuery({
    queryKey: ["handoff", handoffId],
    queryFn: () => getHandoff(handoffId),
    enabled: Boolean(handoffId),
  });
}

export function useAcceptHandoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (handoffId: string) => acceptHandoff(handoffId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs"] });
      queryClient.invalidateQueries({ queryKey: ["handoff"] });
    },
  });
}

export function useRejectHandoff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ handoffId, reason }: { handoffId: string; reason: string }) =>
      rejectHandoff(handoffId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["handoffs"] });
      queryClient.invalidateQueries({ queryKey: ["handoff"] });
    },
  });
}
