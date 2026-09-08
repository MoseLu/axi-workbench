export type AxiSuiteSnapshot = {
  productName: "Axi Coder";
  desktop: {
    shell: "tauri";
    status: string;
    capabilities: string[];
  };
  mobile: {
    owner: "axi-mobile";
    packageName: string;
    projectPath: string;
    latestGoal70Artifact: string | null;
    deepLinks: string[];
  };
  notify: {
    owner: "axi-notify";
    endpoints: string[];
    authHeader: "X-Axi-Notify-Api-Key";
  };
};

export const expectedAxiDeepLinks = ["axi://chat", "axi://todo", "axi://workbench"] as const;
export const expectedNotifyEndpoints = ["POST /v1/events", "GET /v1/events"] as const;
const axiNotifyAndroidRef = "workspace://project/axi-notify/android-app";

export function assertAxiSuiteSnapshot(snapshot: AxiSuiteSnapshot): void {
  if (snapshot.productName !== "Axi Coder") {
    throw new Error("Axi suite snapshot must identify the product as Axi Coder.");
  }

  for (const deepLink of expectedAxiDeepLinks) {
    if (!snapshot.mobile.deepLinks.includes(deepLink)) {
      throw new Error(`Axi Mobile snapshot is missing deep link: ${deepLink}`);
    }
  }

  for (const endpoint of expectedNotifyEndpoints) {
    if (!snapshot.notify.endpoints.includes(endpoint)) {
      throw new Error(`Axi Notify snapshot is missing endpoint: ${endpoint}`);
    }
  }

  if (snapshot.notify.authHeader !== "X-Axi-Notify-Api-Key") {
    throw new Error("Axi Notify snapshot must expose only the ref-safe auth header name.");
  }

  const serialized = JSON.stringify(snapshot);
  for (const secretMarker of ["sk-", "Bearer ", "access_token", "refresh_token", "fcmToken"]) {
    if (serialized.includes(secretMarker)) {
      throw new Error(`Axi suite snapshot contains forbidden secret marker: ${secretMarker}`);
    }
  }
}

export function buildMockAxiSuiteSnapshot(): AxiSuiteSnapshot {
  return {
    productName: "Axi Coder",
    desktop: {
      shell: "tauri",
      status: "browser-preview",
      capabilities: ["provider profiles", "CLI routes", "terminal sessions", "request logs"],
    },
    mobile: {
      owner: "axi-mobile",
      packageName: "com.mosscoder.notify",
      projectPath: axiNotifyAndroidRef,
      latestGoal70Artifact: `${axiNotifyAndroidRef}/docs/verification/goal70-20260525-093736`,
      deepLinks: [...expectedAxiDeepLinks],
    },
    notify: {
      owner: "axi-notify",
      endpoints: [...expectedNotifyEndpoints],
      authHeader: "X-Axi-Notify-Api-Key",
    },
  };
}
