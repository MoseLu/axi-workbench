export type Lifecycle = "active" | "staging" | "maintenance" | "retired";

export type MonitorTarget = {
  machine_id: string;
  provider: string;
  role: string;
  lifecycle: Lifecycle;
  name: string;
  type: "tcp" | "http";
  host?: string;
  port?: number;
  url?: string;
};

export type Machine = {
  id: string;
  provider: string;
  role: string;
  ssh_user: string;
  public_ip: string;
  bootstrap_host?: string;
  tailscale_name: string;
  ssh_key_path?: string | null;
  credential_ref?: string | null;
  credential_profile?: string | null;
  credential_status?: string;
  selected_host?: string | null;
  lifecycle: Lifecycle;
  tags: string[];
  monitors?: Array<Record<string, unknown>>;
};

export type CredentialVault = {
  path: string;
  loaded: boolean;
  metadata_only: boolean;
};

export type CredentialReference = {
  id: string;
  path: string;
  type: "credential-ref" | "server";
  title: string;
  aliases?: string[];
  service?: string;
  environment?: string;
  secret_ref?: string;
  source_location?: string;
  risk?: "medium" | "high" | "critical" | string;
  rotation?: string;
  last_verified?: string;
  agent_use?: string;
  migration_status?: string;
  profile?: string;
  related?: string[];
  metadata_only: boolean;
};

export type FleetData = {
  generated_at: string;
  network: string;
  machines: Machine[];
  monitor_targets: MonitorTarget[];
  credential_vault?: CredentialVault;
  credential_refs?: CredentialReference[];
};

export type MachineRow = Machine & {
  display_name: string;
  live_probe_count: number;
  service_count: number;
};

export type MonitorRow = MonitorTarget & {
  id: string;
  display_name: string;
  machine_name: string;
  target: string;
};

export type CredentialRow = {
  machine_id: string;
  machine_name: string;
  provider: string;
  ssh_user: string;
  lifecycle: Lifecycle;
  credential_status: string;
  storage_path: string | null;
  credential_ref: string | null;
  credential_profile: string | null;
  storage_kind: "path" | "secret_ref" | "missing";
};

export type ProjectRow = {
  id: string;
  name: string;
  description: string;
  owner: string;
  lifecycle: Lifecycle;
  machine_ids: string[];
  machine_names: string[];
  probe_count: number;
  tags: string[];
  scope: string;
};

export type FleetSummary = {
  machines: number;
  activeCount: number;
  stagingCount: number;
  missingCredentials: number;
  serverProbeCount: number;
  serviceCount: number;
  activeProbeCount: number;
  probeCount: number;
  coverage: number;
  projectCount: number;
  publicCount: number;
  credentialRefCount: number;
  criticalCredentialRefs: number;
};

export type FleetModel = {
  data: FleetData;
  rows: MachineRow[];
  serverProbes: MonitorRow[];
  services: MonitorRow[];
  credentials: CredentialRow[];
  credentialRefs: CredentialReference[];
  credentialVault: CredentialVault | null;
  projects: ProjectRow[];
  summary: FleetSummary;
};
