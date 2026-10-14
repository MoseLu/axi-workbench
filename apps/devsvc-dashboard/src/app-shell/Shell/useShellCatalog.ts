import { useEffect, useState } from "react";

import type { AppTFunction } from "../../app-registry";
import { listAxiResources, type AxiResource } from "../../features/axi-resources/axiResources";
import { listHostedApps, type HostedApp } from "../../features/hosted/hostedApps";

type ShellCatalogNotifier = {
  warning: (config: { description: string; message: string }) => void;
};

/**
 * Loads the two navigation catalogs the shell renders: hosted apps and Axi
 * resources. Failures are surfaced through the Ant Design notification API and
 * degrade to an empty catalog so the shell chrome keeps rendering.
 */
export function useShellCatalog({
  notification,
  t
}: {
  notification: ShellCatalogNotifier;
  t: AppTFunction;
}) {
  const [hostedApps, setHostedApps] = useState<HostedApp[]>([]);
  const [axiResources, setAxiResources] = useState<AxiResource[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listHostedApps()
      .then((apps) => {
        if (!cancelled) setHostedApps(apps);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setHostedApps([]);
        notification.warning({
          description: error instanceof Error ? error.message : String(error),
          message: t("子应用列表加载失败")
        });
      });
    return () => {
      cancelled = true;
    };
  }, [notification, t]);

  useEffect(() => {
    let cancelled = false;
    void listAxiResources()
      .then((resources) => {
        if (!cancelled) setAxiResources(resources);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setAxiResources([]);
        notification.warning({
          description: error instanceof Error ? error.message : String(error),
          message: t("Axi 资源列表加载失败")
        });
      });
    return () => {
      cancelled = true;
    };
  }, [notification, t]);

  return { axiResources, hostedApps };
}
