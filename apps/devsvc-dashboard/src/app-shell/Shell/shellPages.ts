import { lazy } from "react";

/**
 * Lazily loaded host route pages rendered by the shell router. Kept in a
 * separate module so the shell entry only wires the route table.
 */
export const AxiResourcesPage = lazy(() => import("../../features/axi-resources/AxiResourcesPage").then((m) => ({ default: m.AxiResourcesPage })));
export const AlertsPage = lazy(() => import("../../features/alerts/AlertsPage").then((m) => ({ default: m.AlertsPage })));
export const DeployPage = lazy(() => import("../../features/deploy/DeployPage").then((m) => ({ default: m.DeployPage })));
export const HostedAppPage = lazy(() => import("../../features/hosted/HostedAppPage").then((m) => ({ default: m.HostedAppPage })));
export const ObservabilityPage = lazy(() => import("../../features/observability/ObservabilityPage").then((m) => ({ default: m.ObservabilityPage })));
export const ServersPage = lazy(() => import("../../features/servers/ServersPage").then((m) => ({ default: m.ServersPage })));
export const ServicesPage = lazy(() => import("../../features/services/ServicesPage").then((m) => ({ default: m.ServicesPage })));
