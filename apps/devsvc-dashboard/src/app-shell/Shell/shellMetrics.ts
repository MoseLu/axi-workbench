/** Project health rollup shown on the overview page header cards. */
export type ShellProjectMetricSource = {
  health: { ok: boolean };
  pm2: { status: string };
};

export function makeOverviewMetrics(projects: ShellProjectMetricSource[]) {
  return {
    total: projects.length,
    healthy: projects.filter((project) => project.pm2.status === "online" && project.health.ok).length,
    online: projects.filter((project) => project.pm2.status === "online").length,
    idle: projects.filter((project) => project.pm2.status === "missing").length
  };
}
