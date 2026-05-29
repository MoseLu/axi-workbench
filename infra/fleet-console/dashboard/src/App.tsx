import { Alert, ConfigProvider, Layout, Spin, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AxiThemeProvider, axiThemePresets, createAxiAntdTheme, useAxiTheme, type AxiThemePreset } from "@axi/core";
import { useMemo, type ReactNode } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { FleetShell } from "./components/fleet-shell";
import { useFleetData } from "./lib/fleet-data";
import { buildFleetModel } from "./lib/fleet-model";
import type { FleetModel } from "./lib/fleet-types";
import { CredentialsPage } from "./routes/credentials-page";
import { DashboardPage } from "./routes/dashboard-page";
import { DevicesPage } from "./routes/devices-page";
import { ProjectsPage } from "./routes/projects-page";
import { ServicesPage } from "./routes/services-page";

const hostedBase = (import.meta.env.VITE_AXI_APP_BASE || "/").replace(/\/$/u, "");
const routerBasename = hostedBase === "" ? undefined : hostedBase;
const isHostedApp = import.meta.env.VITE_AXI_HOSTED_APP === "1";
const fleetThemePreset = { color: "#22d3ee", label: "Axi Fleet", name: "fleet" } satisfies AxiThemePreset;
const fleetThemePresets = [fleetThemePreset, ...axiThemePresets];

function HostedContentShell({ model }: { model: FleetModel }) {
  return (
    <main className="hosted-content-scope admin-shell">
      <Outlet context={model} />
    </main>
  );
}

function FleetThemeSurface({ children }: { children: ReactNode }) {
  const { mode, preset } = useAxiTheme();
  const antdTheme = useMemo(() => ({
    algorithm: mode === "dark" ? theme.darkAlgorithm : theme.defaultAlgorithm,
    ...createAxiAntdTheme(mode, preset, {
      borderRadius: 6,
      token: {
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      },
    }),
  }), [mode, preset]);

  return (
    <ConfigProvider locale={zhCN} button={{ autoInsertSpace: false }} theme={antdTheme}>
      {children}
    </ConfigProvider>
  );
}

export function App() {
  const { data, error } = useFleetData();
  const model = useMemo(() => (data ? buildFleetModel(data) : null), [data]);

  return (
    <AxiThemeProvider defaultPresetName="fleet" defaultPreference="dark" presets={fleetThemePresets} storageNamespace="fleet-console">
      <FleetThemeSurface>
        {error ? (
          <Layout className="admin-shell shell-centered">
            <Alert type="error" message="Fleet data failed to load" description={error} showIcon />
          </Layout>
        ) : !model ? (
          <Layout className="admin-shell shell-centered">
            <Spin size="large" tip="Loading fleet registry" />
          </Layout>
        ) : (
          <BrowserRouter basename={routerBasename}>
            <Routes>
              <Route path="/" element={isHostedApp ? <HostedContentShell model={model} /> : <FleetShell model={model} />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="devices" element={<DevicesPage />} />
                <Route path="services" element={<ServicesPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="credentials" element={<CredentialsPage />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </BrowserRouter>
        )}
      </FleetThemeSurface>
    </AxiThemeProvider>
  );
}
