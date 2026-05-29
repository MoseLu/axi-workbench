type ManagedWebview = {
  close(): Promise<void>;
  hide(): Promise<void>;
  once(event: "tauri://created" | "tauri://error", handler: (event: { payload: unknown }) => void): Promise<() => void>;
  setFocus(): Promise<void>;
  setPosition(position: unknown): Promise<void>;
  setSize(size: unknown): Promise<void>;
  show(): Promise<void>;
};

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export function canUseNativeWebviews() {
  return Boolean(window.__TAURI_INTERNALS__);
}

function isMissingWebviewError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  return message.toLowerCase().includes("webview not found");
}

export function isIgnorableHostedWebviewCloseError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason);
  const normalized = message.toLowerCase();
  return isMissingWebviewError(reason) || normalized.includes("not allowed by acl");
}

async function waitForCreatedWebview(webview: ManagedWebview) {
  return new Promise<ManagedWebview>((resolve, reject) => {
    let unlistenCreated: (() => void) | undefined;
    let unlistenError: (() => void) | undefined;

    const cleanup = () => {
      unlistenCreated?.();
      unlistenError?.();
    };

    void webview.once("tauri://created", () => {
      cleanup();
      resolve(webview);
    }).then((unlisten) => {
      unlistenCreated = unlisten;
    });

    void webview.once("tauri://error", ({ payload }) => {
      cleanup();
      reject(payload);
    }).then((unlisten) => {
      unlistenError = unlisten;
    });
  });
}

function nativeWebviewBounds(rect: DOMRect) {
  const widthDelta = Math.max(0, window.outerWidth - window.innerWidth);
  const heightDelta = Math.max(0, window.outerHeight - window.innerHeight);
  const leftInset = widthDelta / 2;
  const topInset = Math.max(0, heightDelta - leftInset);

  return {
    height: Math.max(1, rect.height),
    width: Math.max(1, rect.width),
    x: Math.max(0, rect.left + leftInset),
    y: Math.max(0, rect.top + topInset)
  };
}

export async function syncHostedWebview(appId: string, route: string, rect: DOMRect) {
  const [{ Webview }, { LogicalPosition, LogicalSize }, { getCurrentWindow }] = await Promise.all([
    import("@tauri-apps/api/webview"),
    import("@tauri-apps/api/dpi"),
    import("@tauri-apps/api/window")
  ]);
  const label = `axi-hosted-${appId}`;
  const bounds = nativeWebviewBounds(rect);
  const current = await Webview.getByLabel(label) as ManagedWebview | null;
  const webview = current || await waitForCreatedWebview(new Webview(getCurrentWindow(), label, {
    height: bounds.height,
    url: route,
    width: bounds.width,
    x: bounds.x,
    y: bounds.y
  }) as ManagedWebview);
  await webview.setPosition(new LogicalPosition(bounds.x, bounds.y));
  await webview.setSize(new LogicalSize(bounds.width, bounds.height));
  await webview.show();
  await webview.setFocus();
}

export async function closeHostedWebview(appId: string) {
  if (!canUseNativeWebviews()) return;
  const { Webview } = await import("@tauri-apps/api/webview");
  let webview: ManagedWebview | null = null;
  try {
    webview = await Webview.getByLabel(`axi-hosted-${appId}`) as ManagedWebview | null;
  } catch (reason: unknown) {
    if (isIgnorableHostedWebviewCloseError(reason)) return;
    throw reason;
  }
  await webview?.close().catch((reason: unknown) => {
    if (!isIgnorableHostedWebviewCloseError(reason)) throw reason;
  });
}
