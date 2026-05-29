import type { CredentialReference, CredentialRow, FleetData, FleetModel, Lifecycle, MachineRow, MonitorRow, MonitorTarget, ProjectRow } from "./fleet-types";

type ProjectSpec = {
  id: string;
  name: string;
  description: string;
  owner: string;
  machineIds: string[];
  scope: string;
  tags: string[];
};

export const lifecycleColor: Record<Lifecycle, string> = {
  active: "success",
  staging: "warning",
  maintenance: "processing",
  retired: "default",
};

export const lifecycleText: Record<Lifecycle, string> = {
  active: "Active",
  staging: "Staging",
  maintenance: "Maintenance",
  retired: "Retired",
};

export const providerText: Record<string, string> = {
  homelab: "本地",
  "tencent-cloud": "腾讯云",
  aliyun: "阿里云",
};

export const credentialStatusText: Record<string, string> = {
  ok: "ready",
  managed_by_bitwarden: "Bitwarden",
  missing_ssh_key: "missing",
};

export const machineNameText: Record<string, string> = {
  "homelab-ubuntu-vm": "VM Workspace",
  "tencent-2c2g": "腾讯云 2核2G",
  "ielts-vocab-prod": "腾讯云 2核4G / IELTS 生产",
  "aliyun-main": "阿里云 Tokyo",
};

export const monitorNameText: Record<string, string> = {
  "homelab ssh": "本地 SSH",
  "tencent ssh": "腾讯云 SSH",
  "ielts-vocab ssh": "IELTS SSH",
  "ielts-vocab https": "IELTS 站点 HTTPS",
  "ielts-vocab api books": "IELTS Books API",
  "aliyun ssh": "阿里云 SSH",
};

const projectSpecs = [
  {
    id: "ops-base",
    name: "运维底座",
    description: "承载 Cockpit、Portainer、Uptime Kuma 和基础纳管能力。",
    owner: "平台",
    machineIds: ["homelab-ubuntu-vm"],
    scope: "management",
    tags: ["core", "docker", "monitoring"],
  },
  {
    id: "ielts-vocab",
    name: "IELTS Vocabulary",
    description: "雅思词汇生产服务与 API，带外网探针和应用探针。",
    owner: "产品",
    machineIds: ["ielts-vocab-prod"],
    scope: "production",
    tags: ["app", "db", "public"],
  },
  {
    id: "cloud-fleet",
    name: "云资源池",
    description: "腾讯云与阿里云主机的统一纳管层。",
    owner: "基础设施",
    machineIds: ["tencent-2c2g", "aliyun-main"],
    scope: "multi-cloud",
    tags: ["public", "utility"],
  },
] satisfies ProjectSpec[];

export function hostOf(target: MonitorTarget) {
  if (target.type === "http") return target.url ?? "-";
  return `${target.host ?? "-"}:${target.port ?? "-"}`;
}

export function machineDisplayName(id: string) {
  return machineNameText[id] ?? id;
}

export function monitorDisplayName(name: string) {
  return monitorNameText[name] ?? name;
}

export function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

export function credentialStatusIsReady(status?: string | null) {
  return !status || status === "ok" || status === "managed_by_bitwarden" || status === "verified" || status === "imported";
}

export function buildMachineRows(data: FleetData): MachineRow[] {
  return data.machines.map((machine) => ({
    ...machine,
    display_name: machineDisplayName(machine.id),
    live_probe_count: data.monitor_targets.filter((target) => target.machine_id === machine.id).length,
    service_count: data.monitor_targets.filter((target) => target.machine_id === machine.id && target.type === "http").length,
  }));
}

function buildMonitorRows(data: FleetData): MonitorRow[] {
  return data.monitor_targets.map((target) => ({
    ...target,
    id: `${target.machine_id}:${target.name}`,
    display_name: monitorDisplayName(target.name),
    machine_name: machineDisplayName(target.machine_id),
    target: hostOf(target),
  }));
}

function buildCredentialRows(rows: MachineRow[]): CredentialRow[] {
  return rows.map((row) => ({
    machine_id: row.id,
    machine_name: row.display_name,
    provider: row.provider,
    ssh_user: row.ssh_user,
    lifecycle: row.lifecycle,
    credential_status: row.credential_status ?? (row.credential_ref ? "managed_by_bitwarden" : row.ssh_key_path ? "ok" : "missing_ssh_key"),
    storage_path: row.ssh_key_path ?? row.credential_ref ?? null,
    credential_ref: row.credential_ref ?? null,
    credential_profile: row.credential_profile ?? null,
    storage_kind: row.credential_ref ? "secret_ref" : row.ssh_key_path ? "path" : "missing",
  }));
}

function buildCredentialRefs(data: FleetData): CredentialReference[] {
  return [...(data.credential_refs ?? [])].sort((left, right) => {
    const leftRisk = riskRank(left.risk);
    const rightRisk = riskRank(right.risk);
    if (leftRisk !== rightRisk) return rightRisk - leftRisk;
    return (left.title || left.id).localeCompare(right.title || right.id, "zh-Hans-CN");
  });
}

function riskRank(risk?: string) {
  if (risk === "critical") return 3;
  if (risk === "high") return 2;
  if (risk === "medium") return 1;
  return 0;
}

function aggregateLifecycle(rows: MachineRow[]): Lifecycle {
  if (rows.some((row) => row.lifecycle === "staging")) return "staging";
  if (rows.some((row) => row.lifecycle === "maintenance")) return "maintenance";
  if (rows.some((row) => row.lifecycle === "retired")) return "retired";
  return "active";
}

export function buildProjectRows(rows: MachineRow[], data: FleetData): ProjectRow[] {
  const rowMap = new Map(rows.map((row) => [row.id, row]));

  return projectSpecs.map((spec) => {
    const machines = spec.machineIds.map((id) => rowMap.get(id)).filter(Boolean) as MachineRow[];
    const probeCount = data.monitor_targets.filter((target) => spec.machineIds.includes(target.machine_id)).length;

    return {
      id: spec.id,
      name: spec.name,
      description: spec.description,
      owner: spec.owner,
      lifecycle: aggregateLifecycle(machines),
      machine_ids: [...spec.machineIds],
      machine_names: machines.map((machine) => machine.display_name),
      probe_count: probeCount,
      tags: [...spec.tags],
      scope: spec.scope,
    };
  });
}

export function buildFleetModel(data: FleetData): FleetModel {
  const rows = buildMachineRows(data);
  const monitorRows = buildMonitorRows(data);
  const serverProbes = monitorRows.filter((target) => target.type === "tcp");
  const services = monitorRows.filter((target) => target.type === "http");
  const credentials = buildCredentialRows(rows);
  const credentialRefs = buildCredentialRefs(data);
  const activeCount = rows.filter((row) => row.lifecycle === "active").length;
  const stagingCount = rows.filter((row) => row.lifecycle === "staging").length;
  const missingCredentials = credentials.filter((row) => !credentialStatusIsReady(row.credential_status)).length;
  const activeProbeCount = data.monitor_targets.filter((target) => target.lifecycle === "active").length;
  const probeCount = data.monitor_targets.length;
  const coverage = rows.length ? Math.round((rows.filter((row) => row.live_probe_count > 0).length / rows.length) * 100) : 0;
  const projects = buildProjectRows(rows, data);
  const publicCount = rows.filter((row) => row.tags.includes("public")).length;

  return {
    data,
    rows,
    serverProbes,
    services,
    credentials,
    credentialRefs,
    credentialVault: data.credential_vault ?? null,
    projects,
    summary: {
      machines: rows.length,
      activeCount,
      stagingCount,
      missingCredentials,
      serverProbeCount: serverProbes.length,
      serviceCount: services.length,
      activeProbeCount,
      probeCount,
      coverage,
      projectCount: projects.length,
      publicCount,
      credentialRefCount: credentialRefs.length,
      criticalCredentialRefs: credentialRefs.filter((row) => row.risk === "critical").length,
    },
  };
}
