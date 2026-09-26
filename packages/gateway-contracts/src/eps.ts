import { z } from "zod";

export const epsPlatformSchema = z.enum(["web", "mobile", "desktop", "backend", "contract"]);
export const epsSeveritySchema = z.enum(["blocker", "high", "warning", "info"]);
export const epsRunStatusSchema = z.enum(["pending", "running", "completed", "failed"]);

export const epsAssetSchema = z.object({
  id: z.string(), project: z.string(), application: z.string(), platform: epsPlatformSchema,
  method: z.string(), path: z.string(), owner: z.string(), service: z.string().nullable(),
  contractRef: z.string().nullable(), environment: z.string(), status: z.string(), source: z.string(),
});
export const epsFindingSchema = z.object({ id: z.string(), severity: epsSeveritySchema, message: z.string(), refs: z.array(z.string()) });
export const epsAuditSchema = z.object({
  id: z.string(), status: epsRunStatusSchema, createdAt: z.string(), workspaceRoot: z.string(),
  summary: z.object({ assets: z.number(), backendRoutes: z.number(), clientCalls: z.number(), ports: z.number(), findings: z.number() }),
  assets: z.array(epsAssetSchema), ports: z.array(z.object({ hostPort: z.number(), containerPort: z.number(), source: z.string() })), findings: z.array(epsFindingSchema),
});
export type EpsAsset = z.infer<typeof epsAssetSchema>;
export type EpsFinding = z.infer<typeof epsFindingSchema>;
export type EpsAudit = z.infer<typeof epsAuditSchema>;
