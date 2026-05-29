export async function api(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export function logsText(body: any) {
  return [body.stdout, body.stderr].filter(Boolean).join("\n") || "暂无日志输出。";
}

export async function loadLogText(serviceId: string, lines = 180) {
  const body = await api(`/api/logs?service=${encodeURIComponent(serviceId)}&lines=${lines}`);
  return logsText(body);
}

export function requestErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
